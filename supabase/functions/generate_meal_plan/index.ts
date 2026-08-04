import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
  const timingNote =
    p.timing_pattern === 'pre'
      ? 'The athlete eats BEFORE training, so keep fat moderate and avoid very high volume or heavy cream — it must sit comfortably during the session.'
      : p.timing_pattern === 'overlap'
      ? 'Training falls inside the eating window, so the meal is split around it. Make the dish easy to portion into a smaller pre-training plate and a larger post-training plate.'
      : 'The athlete trains fasted and breaks the fast afterwards. Favour fast-digesting carbs and lean protein to start recovery quickly.';

  return `You are a Michelin-trained sports nutritionist. Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

Design ONE meal that hits these exact targets (do not change them):
- ${p.target_kcal} kcal, ${p.target_protein_g}g protein, ${p.target_carbs_g}g carbs, ${p.target_fat_g}g fat
- Athlete: ${p.weight_kg}kg, ${p.height_cm}cm, ${p.age}y, ${p.sex}, goal ${p.goal}
- Session: ${p.sport_type}, ${p.duration_min}min, ${p.intensity} intensity at ${p.planned_start_time}

${timingNote}

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

    const supabase =
      SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        : null;

    // Server-side quota, when the caller is a signed-in user. Anonymous callers
    // are limited client-side; this is the authoritative check once auth exists.
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (supabase && authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    if (supabase && userId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .maybeSingle();

      if (!sub || sub.plan === 'free') {
        const startOfWeek = new Date();
        // Monday-anchored, matching the client's quota window.
        const day = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('meal_plans')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfWeek.toISOString());

        if ((count ?? 0) >= 3) {
          return json(
            {
              error: 'LIMIT_REACHED',
              message: 'Free tier limit (3 plans/week) reached. Upgrade for unlimited plans.',
            },
            402
          );
        }
      }
    }

    let recipe: any = null;
    // Why the recipe is missing, when it is. Reported back so a deploy can be
    // verified without guessing from the shape of the response.
    let reason: string | null = GEMINI_API_KEY ? null : 'no_key';

    if (GEMINI_API_KEY) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: buildPrompt(payload) }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
            }),
            signal: controller.signal,
          }
        ).finally(() => clearTimeout(timer));

        if (!geminiRes.ok) {
          const detail = await geminiRes.text().catch(() => '');
          console.error('Gemini error', geminiRes.status, detail.slice(0, 500));
          reason = geminiRes.status === 429 ? 'quota' : geminiRes.status === 400 || geminiRes.status === 403 ? 'auth' : 'upstream';
        } else {
          const geminiJson = await geminiRes.json();
          const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(String(rawText).replace(/```json|```/g, '').trim());
            const candidate = parsed?.recipe ?? parsed;
            if (isUsableRecipe(candidate)) recipe = candidate;
            else reason = 'malformed';
          } else {
            reason = 'empty';
          }
        }
      } catch (e) {
        console.error('Gemini call failed', e);
        reason = 'exception';
      }
    }

    if (!recipe) {
      // The client has its own offline recipe; tell it explicitly rather than
      // returning a half-built object it would have to guess about.
      return json({ recipe: null, source: 'unavailable', reason, key_shape: keyShape(GEMINI_API_KEY) });
    }

    // Persist for signed-in users. Never let a storage failure lose the plan
    // the user is waiting on — log it and still return the plan.
    if (supabase && userId) {
      try {
        const { data: mealPlan } = await supabase
          .from('meal_plans')
          .insert({
            user_id: userId,
            date: new Date().toISOString().split('T')[0],
            eating_window_start: payload.eating_window_start ?? null,
            eating_window_end: payload.eating_window_end ?? null,
            total_kcal: payload.target_kcal,
            protein_g: payload.target_protein_g,
            carbs_g: payload.target_carbs_g,
            fat_g: payload.target_fat_g,
            pre_training_snack_time: payload.pre_training_snack_time ?? null,
            main_meal_time: payload.main_meal_time ?? null,
            ai_reasoning: payload.ai_reasoning ?? null,
          })
          .select()
          .single();

        if (mealPlan) {
          await supabase.from('recipes').insert({
            meal_plan_id: mealPlan.id,
            title: recipe.title,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            reheat_instructions: recipe.reheat_instructions ?? null,
            prep_time_min: recipe.prep_time_min ?? 30,
            macros: {
              kcal: payload.target_kcal,
              protein: payload.target_protein_g,
              carbs: payload.target_carbs_g,
              fat: payload.target_fat_g,
            },
            is_meal_prep: recipe.is_meal_prep ?? true,
          });
        }
      } catch (e) {
        console.error('Failed to persist meal plan', e);
      }
    }

    return json({ recipe, source: 'ai' });
  } catch (err) {
    console.error('generate_meal_plan failed', err);
    // Don't leak internal error text to the client.
    return json({ error: 'INTERNAL', message: 'Could not generate a plan.' }, 500);
  }
});
