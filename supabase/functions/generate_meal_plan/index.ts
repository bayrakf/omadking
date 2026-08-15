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

  /**
   * How long there is to eat it in.
   *
   * This is the constraint the prompt was missing entirely. The macros say how
   * much food; the window says whether a human can physically get through it
   * in one sitting. 3,200 kcal is a reasonable plate over four hours and an
   * ordeal in one, and the model has no way to know which it is writing for
   * unless it is told.
   */
  const hours = Number(p.window_hours);
  const windowNote = !isFinite(hours) || hours <= 0
    ? ''
    : hours <= 1
    ? `The entire eating window is ${hours} hour — ONE sitting, and then nothing for 23 hours. Energy density is the binding constraint: choose calorie-dense whole foods (olive oil, nuts, fatty fish, full-fat dairy) over high-volume ones, and keep the cooked weight of the plate under about 900g. A salad the size of a bucket is a failed recipe here, however well its macros add up.`
    : hours <= 2
    ? `The eating window is ${hours} hours — one meal, with time to finish it. Keep the plate to something one person can comfortably eat in a sitting; favour density over volume, but it need not be extreme.`
    : hours <= 4
    ? `The eating window is ${hours} hours, so this is one long meal or two courses. Design it to be eaten in two passes — a first plate and a second — and say so in the method. Volume is much less of a constraint than it is at one hour.`
    : `The eating window is ${hours} hours, so this is two proper meals rather than one. Split the targets into a first and a second meal in the instructions, and make the second one reheat well.`;

  /**
   * The prose language.
   *
   * Written in the target language rather than translated afterwards: cooking
   * vocabulary is exactly what a translation pass loses, and "anbraten" is not
   * "fry" with a different spelling. The JSON keys stay English because the
   * client parses them.
   */
  const language = p.language === 'de' ? 'de' : 'en';
  const languageNote = language === 'de'
    ? `Write ALL prose — the title, every ingredient line, the method and the reheating steps — in German, using the informal "du" where a person is addressed. Use German culinary terms and German supermarket ingredient names. Keep units metric (g, ml, EL, TL) and keep the JSON keys exactly as given below, in English.`
    : 'Write all prose in English. Keep units metric (g, ml, tbsp, tsp).';

  /**
   * Complexity block — the single biggest driver of what Gemini actually cooks.
   *
   * Three levels, each a self-contained constraint set:
   *   quick    = one-pan, ≤15 min, ≤5 ingredients, no oven
   *   balanced = meal-prep, ≤30 min, 2-3 components (default)
   *   chef     = premium gourmet, multistep, plating note (premium-gated on client)
   *
   * The client gates chef behind Premium; the server trusts it without a
   * server-side check because the only damage from spoofing it is a fancier
   * recipe — not a quota bypass or data leak.
   */
  const complexity = String(p.complexity ?? 'balanced');

  const complexityBlock = complexity === 'quick'
    ? (language === 'de'
      ? `KOCHSTUFE: BLITZ-REZEPT
- Maximale Zubereitungszeit: 15 Minuten.
- Maximal 1 Pfanne oder 1 Topf. Kein Ofen, keine Grillplatte.
- Maximal 5 Zutaten (Öl, Salz und Pfeffer zählen nicht).
- Keine Marinierzeit, keine Saucen, keine Beilagenkomponenten.
- Bevorzuge bei Makro-Zwang: Eier, Hüttenkäse, Avocado, Thunfisch aus der Dose, Edamame.
- Zubereitungsschritte: maximal 3, sehr kurz formuliert.
- Aufwärmanleitung: ausschließlich Mikrowelle, 2 Minuten, kein Skillet nötig.
Das Rezept muss für jemanden funktionieren, der nach der Arbeit müde ist und keine Zeit hat.`
      : `COOKING LEVEL: BLITZ RECIPE (ultra-quick, one-pan)
- Maximum prep + cook time: 15 minutes total.
- Maximum 1 pan or pot. No oven, no grill.
- Maximum 5 ingredients (oil, salt, pepper don't count).
- No marinating time, no sauces, no separate side components.
- Prioritise when macros allow: eggs, cottage cheese, avocado, canned tuna, edamame.
- Method: 3 steps maximum, very brief.
- Reheat: microwave only, 2 minutes, no skillet needed.
This recipe must work for someone who is tired after work and has no time.`)
    : complexity === 'chef'
    ? (language === 'de'
      ? `KOCHSTUFE: CHEF-LEVEL MAHLZEIT-ARCHITEKTUR

Du bist ein Michelin-ausgezeichneter Sternekoch, der gleichzeitig Sporternährung auf Leistungssport-Niveau beherrscht. Der Athlet hat Premium gebucht — er erwartet ein Rezept, das sich wirklich besonders anfühlt, nicht die übliche Hähnchenbrust mit Reis.

Was erlaubt und erwünscht ist:
- Schmoren, Niedrigtemperatur-Garen (60–65 °C Kerntemperatur), Miso-Glasuren
- Fermentierte Komponenten (Kimchi, Joghurt-Marinaden, Miso)
- Mehrere Garmethoden kombiniert (anbraten + backen + dampfgaren)
- Strukturierte Textur-Kontraste: knusprig / cremig / zart
- Spezialzutaten sind willkommen: Miso, Tahini, Za'atar, Harissa, Sumach, Ponzu, Gochujang, Misopaste, Granatapfelmelasse
- Bis zu 12 Zutaten
- Zubereitungszeit 35–60 Minuten ist ausdrücklich akzeptabel

Pflichtformat in der instructions-Zeichenkette:
1. Beginne mit einem Flavour-Profile-Satz in Kursiv-Stil (ohne echtes Markdown):
   "Geschmacksprofil: [Adjektiv 1], [Adjektiv 2], [Adjektiv 3] — [ein kurzer, poetischer Satz]."
2. Dann die nummerierten Kochschritte wie üblich.
3. Schließe mit einem "Anrichte-Hinweis:" am Ende der instructions ab.

Aufwärmanleitung: hochwertig, alle 3 Methoden mit Textur-Hinweis was wie bleibt.
Der Athlet bezahlt für dieses Erlebnis. Mach es denkwürdig.`
      : `COOKING LEVEL: CHEF-LEVEL MEAL ARCHITECTURE

You are a Michelin-starred chef who also masters sports nutrition at elite athlete level.
The athlete has purchased Premium — they expect a recipe that feels genuinely special,
not the usual chicken breast and rice.

What is allowed and encouraged:
- Braising, low-temperature cooking (60–65°C core temp), miso glazes
- Fermented components (kimchi, yoghurt marinades, miso)
- Multiple cooking methods combined (sear + roast + steam)
- Structured texture contrasts: crispy / creamy / tender
- Specialty ingredients welcome: miso, tahini, za'atar, harissa, sumac, ponzu, gochujang,
  pomegranate molasses, preserved lemon, truffle oil (small amounts)
- Up to 12 ingredients
- Prep time of 35–60 minutes is explicitly acceptable

Required format within the instructions string:
1. Open with a Flavour Profile sentence (italic-style, no actual markdown):
   "Flavour profile: [adjective], [adjective], [adjective] — [one poetic descriptive sentence]."
2. Then numbered cooking steps as usual.
3. Close with a "Plating note:" at the end of the instructions.

Reheat: premium-quality for all 3 methods with a note on which textures hold and which don't.
The athlete is paying for this experience. Make it memorable.`)
    // balanced (default)
    : (language === 'de'
      ? `KOCHSTUFE: AUSGEWOGENE ALLTAGSMAHLZEIT (Meal-Prep tauglich)
- Maximale Zubereitungszeit: 30 Minuten.
- 2–3 Komponenten erlaubt: Protein + Kohlenhydrat + Gemüse separat gegart.
- Ofen für Kohlenhydrate erlaubt (22 Min bei 200 °C), Pfanne für Protein.
- Meal-Prep-Design: Rezept so konzipieren, dass es sich für 2 Tage im Voraus kochen lässt.
- Aufwärmanleitung: Pfanne, Airfryer und Mikrowelle vollständig beschreiben.`
      : `COOKING LEVEL: BALANCED EVERYDAY MEAL (meal-prep ready)
- Maximum prep + cook time: 30 minutes.
- 2–3 components allowed: protein + carbohydrate + vegetable, cooked separately.
- Oven for carbs is fine (22 min at 200°C), pan for protein.
- Meal-prep design: build the recipe so it can be batch-cooked for 2 days ahead.
- Reheat: full instructions for skillet, air fryer and microwave.`);

  return `You are a Michelin-trained sports nutritionist. Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

Design ONE meal that hits these exact targets (do not change them):
- ${p.target_kcal} kcal, ${p.target_protein_g}g protein, ${p.target_carbs_g}g carbs, ${p.target_fat_g}g fat
- Goal: ${p.goal}
- Session: ${p.sport_type}, ${p.duration_min}min, ${p.intensity} intensity at ${p.planned_start_time}

${timingNote}

${windowNote}

${complexityBlock}

${languageNote}

${avoid ? `HARD CONSTRAINT — the athlete cannot or will not eat: ${avoid}\nNo ingredient may contain any of it, including as a garnish or a sauce. If a target is impossible without it, get as close as you can and choose something they can eat.\n` : ''}Rules:
- Every ingredient needs an exact gram or millilitre amount, and the amounts must plausibly add up to the macro targets above.
- Instructions: numbered culinary steps ("1. ", "2. ", ...), specific temperatures and times.
- Reheat instructions: as specified by the cooking level above.
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
}

The values above are examples of SHAPE only. Their language must follow the instruction above, not the example.`;
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
