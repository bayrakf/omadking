import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

/**
 * Model is configurable because a hardcoded one is an outage waiting to happen:
 * `gemini-2.0-flash` was pinned here and had a free-tier quota of exactly 0,
 * which surfaced as a generic failure. `gemini-flash-latest` is an alias that
 * tracks Google's current Flash model, so it does not 404 on retirement.
 * Override with `supabase secrets set GEMINI_MODEL=...`.
 */
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

/** The client computes macros and timing locally and sends them here. This
 *  function only writes the recipe prose, so the two can never disagree. */
function buildPrompt(p: Record<string, any>): string {
  // Capped and flattened here as well as on the client. The client is not a
  // trust boundary — this string is interpolated into a prompt, and a newline
  // in it is a free instruction to the model.
  const avoid = typeof p.avoid === 'string'
    ? p.avoid.replace(/\s+/g, ' ').trim().slice(0, 120)
    : '';

  const timingNote =
    p.timing_pattern === 'pre'
      ? 'The athlete eats BEFORE training, so keep fat moderate and avoid very high volume or heavy cream — it must sit comfortably during the session.'
      : p.timing_pattern === 'overlap'
      ? 'Training falls inside the eating window, so the meal is split around it. Make the dish easy to portion into a smaller pre-training plate and a larger post-training plate.'
      : 'The athlete trains fasted and breaks the fast afterwards. Favour fast-digesting carbs and lean protein to start recovery quickly.';

  return `You are a Michelin-trained sports nutritionist. Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

Design ONE meal that hits these exact targets (do not change them):
- ${p.target_kcal} kcal, ${p.target_protein_g}g protein, ${p.target_carbs_g}g carbs, ${p.target_fat_g}g fat
- Goal: ${p.goal}
- Session: ${p.sport_type}, ${p.duration_min}min, ${p.intensity} intensity at ${p.planned_start_time}

${timingNote}

${avoid ? `HARD CONSTRAINT — the athlete cannot or will not eat: ${avoid}\nNo ingredient may contain any of it, including as a garnish or a sauce. If a target is impossible without it, get as close as you can and choose something they can eat.\n` : ''}
Rules:
- Every ingredient needs an exact gram or millilitre amount, and the amounts must plausibly add up to the macro targets above.
- Instructions: numbered culinary steps ("1. ", "2. ", ...), specific temperatures and times.
- Reheat instructions: numbered, covering skillet, air fryer and microwave, because this is cooked the day before.
- Real, buyable ingredients. No supplements as a main component.

Return exactly this shape:
{
  "recipe": {
    "title": "string",
    "ingredients": ["320g chicken breast", "..."],
    "instructions": "1. ... 2. ... 3. ...",
    "reheat_instructions": "1. Skillet: ... 2. Air fryer: ... 3. Microwave: ...",
    "prep_time_min": 30,
    "is_meal_prep": true
  }
}`;
}

function isUsableRecipe(r: any): boolean {
  return (
    r &&
    typeof r.title === 'string' &&
    r.title.trim() &&
    Array.isArray(r.ingredients) &&
    r.ingredients.length > 0 &&
    r.ingredients.every((i: unknown) => typeof i === 'string') &&
    typeof r.instructions === 'string' &&
    r.instructions.trim()
  );
}

/**
 * Classifies the configured key by shape so a misconfiguration is obvious
 * without ever revealing the value. Google AI Studio keys are `AIza…` (39
 * chars); Supabase keys are JWTs (`eyJ…`) or `sb_publishable_` / `sb_secret_`.
 * Pasting the wrong one is the single most common cause of an auth failure here.
 */
function keyShape(key: string): string {
  if (!key) return 'missing';
  if (key !== key.trim()) return 'has_whitespace';
  // Google issues two API key formats: the legacy `AIza…` (39 chars) and the
  // newer `AQ.…`. Both are valid for the Generative Language API.
  if (key.startsWith('AQ.')) return 'google_ok';
  if (key.startsWith('AIza')) return key.length === 39 ? 'google_ok' : `google_bad_length_${key.length}`;
  if (key.startsWith('eyJ')) return 'supabase_jwt';
  if (key.startsWith('sb_')) return 'supabase_key';
  if (key.startsWith('sk_')) return 'secret_key_other_service';
  return `unknown_prefix_${key.slice(0, 3)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json().catch(() => ({}));

    // Reject nonsense before spending a model call on it.
    const targetKcal = Number(payload.target_kcal);
    if (!isFinite(targetKcal) || targetKcal < 800 || targetKcal > 8000) {
      return json({ error: 'INVALID_TARGETS', message: 'Calorie target out of range.' }, 400);
    }

    // No server-side quota here on purpose. The version that used to live in
    // this spot counted rows in `meal_plans`, which meant enforcing a limit
    // required storing a copy of every meal the user was served. Quota needs a
    // counter, not a transcript. It returns as a counter keyed by user id once
    // accounts ship; until then the client-side limit is the only one.

    let recipe: any = null;
    // Why the recipe is missing, when it is. Reported back so a deploy can be
    // verified without guessing from the shape of the response.
    let reason: string | null = GEMINI_API_KEY ? null : 'no_key';
    let detailOut: string | null = null;

    if (GEMINI_API_KEY) {
      try {
        const controller = new AbortController();
        // Measured at 19-22s for a full recipe. A 25s abort was close enough
        // to the happy path that a slow day looked like an outage.
        const timer = setTimeout(() => controller.abort(), 55000);
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: buildPrompt(payload) }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                // A full recipe plus reheat steps is long, and reasoning
                // tokens come out of the same budget — at 2048 the JSON was
                // cut off mid-object and failed to parse.
                maxOutputTokens: 8192,
                temperature: 0.9,
              },
            }),
            signal: controller.signal,
          }
        ).finally(() => clearTimeout(timer));

        if (!geminiRes.ok) {
          const detail = await geminiRes.text().catch(() => '');
          console.error('Gemini error', geminiRes.status, detail.slice(0, 500));
          reason = geminiRes.status === 429 ? 'quota' : geminiRes.status === 400 || geminiRes.status === 403 ? 'auth' : 'upstream';
          try { detailOut = JSON.parse(detail)?.error?.message?.slice(0, 400); } catch { detailOut = detail.slice(0, 400); }
        } else {
          const geminiJson = await geminiRes.json();
          const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          const finish = geminiJson?.candidates?.[0]?.finishReason;
          if (rawText) {
            let parsed: any;
            try {
              parsed = JSON.parse(String(rawText).replace(/```json|```/g, '').trim());
            } catch {
              // Almost always an output-token cap, not malformed model output.
              reason = finish === 'MAX_TOKENS' ? 'truncated' : 'unparseable';
              detailOut = `finishReason=${finish} len=${String(rawText).length}`;
              throw new Error(reason);
            }
            const candidate = parsed?.recipe ?? parsed;
            if (isUsableRecipe(candidate)) recipe = candidate;
            else { reason = 'malformed'; detailOut = JSON.stringify(candidate).slice(0, 400); }
          } else {
            reason = 'empty';
            detailOut = JSON.stringify(geminiJson).slice(0, 400);
          }
        }
      } catch (e) {
        console.error('Gemini call failed', e);
        reason = 'exception';
        detailOut = String(e).slice(0, 400);
      }
    }

    if (!recipe) {
      // The client has its own offline recipe; tell it explicitly rather than
      // returning a half-built object it would have to guess about.
      return json({ recipe: null, source: 'unavailable', reason, key_shape: keyShape(GEMINI_API_KEY), detail: detailOut });
    }

    // Deliberately not persisted. The server has no business holding the
    // athlete's meals, and once anonymous accounts ship this block would have
    // started doing exactly that without anyone deciding to.

    return json({ recipe, source: 'ai' });
  } catch (err) {
    console.error('generate_meal_plan failed', err);
    // Don't leak internal error text to the client.
    return json({ error: 'INTERNAL', message: 'Could not generate a plan.' }, 500);
  }
});
