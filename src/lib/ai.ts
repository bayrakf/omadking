/**
 * Calls to the Supabase edge functions.
 *
 * The Gemini key stays server-side. A previous version read
 * EXPO_PUBLIC_GEMINI_API_KEY in the client, which ships the key inside the JS
 * bundle where anyone can lift it out of devtools and bill it to this project.
 */

import { dailyTargets, mealTiming, type Training, type UserProfile } from './nutrition';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
  }
}

export type RecipeSource = 'ai' | 'offline';

/**
 * Why the built-in recipe appeared instead of a generated one.
 *
 * Every message says the same two things: this is the standard plate, and the
 * numbers are unaffected. The macros and timing are computed on the device, so
 * a model outage never makes the *plan* wrong — only the meal suggestion
 * duller. Saying so is what stops a silent fallback looking like a bad app.
 */
export function describeRecipeFallback(reason: string | null | undefined, detail?: string | null): string {
  switch (reason) {
    case 'quota':
      return `${describeQuotaError(detail)} This is the standard plate meanwhile — your macros and timing are unaffected.`;
    case 'auth':
    case 'no_key':
      return 'The recipe service is not set up, so this is the standard plate. Your macros and timing are unaffected.';
    case 'network':
      return 'No connection to the recipe service, so this is the standard plate. Your macros and timing are unaffected.';
    case 'truncated':
    case 'unparseable':
    case 'malformed':
    case 'empty':
      return 'The recipe came back unreadable, so this is the standard plate. Try again for a tailored one.';
    default:
      return 'This is the standard plate rather than a tailored recipe. Your macros and timing are unaffected.';
  }
}

/**
 * Turns a rate-limit failure into something true.
 *
 * Every 429 used to become "try again in a minute". Gemini has at least two,
 * and they are not the same thing: a per-minute rate limit that clears in
 * seconds, and the free tier's daily request cap that clears tomorrow. Telling
 * someone to wait a minute for a daily cap makes them retry all evening.
 *
 * The "please retry in Xs" hint cannot be used to tell them apart — when the
 * daily cap was hit here it still reported under a minute. The metric name in
 * Google's own detail is what actually distinguishes them, so that is what this
 * reads, and when it recognises neither it makes no claim about timing at all.
 */
export function describeQuotaError(detail?: string | null): string {
  const text = String(detail ?? '').toLowerCase();

  if (/per_?minute|per-minute/.test(text)) {
    return 'That was too many requests in one minute. Give it a moment and try again.';
  }
  if (/free_?tier|per_?day|daily/.test(text)) {
    return 'The free daily limit is used up. It resets tomorrow.';
  }
  return 'The coach is rate limited right now. Try again later.';
}

export type Recipe = {
  title: string;
  ingredients: string[];
  instructions: string;
  reheat_instructions: string | null;
  prep_time_min: number;
  is_meal_prep: boolean;
};

export type MealPlan = {
  date: string;
  eating_window_start: string;
  eating_window_end: string;
  total_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  pre_training_snack_time: string | null;
  main_meal_time: string;
  ai_reasoning: string;
  timing_warning: string | null;
  training_burn_kcal: number;
  /** Whether the recipe came from the model or the built-in fallback. */
  recipe_source: RecipeSource;
  /** One calm sentence explaining a fallback, or null when the model answered. */
  recipe_note: string | null;
  /** Which side of the window training falls on. The agenda needs this to
   *  place a pre-training snack before or after the opening. */
  timing_pattern: 'pre' | 'post' | 'overlap';
  /** The session this plan was built around; null on a rest day. */
  training_start_time: string | null;
  training_duration_min: number;
  recipe: Recipe;
};

/** Chat answers in ~2s; a full recipe measures 19-22s server-side. */
const TIMEOUT_CHAT_MS = 30000;
const TIMEOUT_PLAN_MS = 75000;

async function postJSON(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  // Without a timeout a hung request leaves the spinner up forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isUsableRecipe(r: any): r is Recipe {
  return (
    r &&
    typeof r.title === 'string' &&
    r.title.trim().length > 0 &&
    Array.isArray(r.ingredients) &&
    r.ingredients.length > 0 &&
    typeof r.instructions === 'string' &&
    r.instructions.trim().length > 0
  );
}

/**
 * Macros and timing are computed locally from `nutrition.ts` and are always
 * correct. Only the recipe prose comes from the model, so a model outage
 * degrades the meal *suggestion* rather than the plan.
 */
export async function generateMealPlan(
  profile: UserProfile,
  training: Training | null
): Promise<MealPlan> {
  const targets = dailyTargets(profile, training);
  const timing = mealTiming(profile, training);

  let recipe: Recipe | null = null;
  // The function already reports both; discarding them is what made an outage
  // indistinguishable from a working app serving a boring recipe.
  let reason: string | null = SUPABASE_URL ? null : 'no_key';
  let detail: string | null = null;

  if (SUPABASE_URL) {
    try {
      const res = await postJSON('generate_meal_plan', {
        // Deliberately not the whole profile. The targets below already encode
        // weight, height, age and sex, so sending them as well would ship the
        // most identifying fields we hold to a third country for nothing.
        goal: profile.goal,
        sport_type: training?.sport ?? 'rest',
        duration_min: training?.duration_min ?? 0,
        intensity: training?.intensity ?? 'low',
        planned_start_time: training?.start_time ?? profile.default_training_time,
        // The function must build its recipe around the numbers we already
        // committed to, rather than recomputing its own and disagreeing.
        target_kcal: targets.kcal,
        target_protein_g: targets.protein_g,
        target_carbs_g: targets.carbs_g,
        target_fat_g: targets.fat_g,
        timing_pattern: timing.pattern,
      }, TIMEOUT_PLAN_MS);

      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        throw new QuotaError(body.message ?? 'Free plan limit reached.');
      }
      if (res.ok) {
        const data = await res.json();
        if (isUsableRecipe(data?.recipe)) recipe = data.recipe;
        else {
          reason = typeof data?.reason === 'string' ? data.reason : 'empty';
          detail = typeof data?.detail === 'string' ? data.detail : null;
        }
      } else {
        reason = 'upstream';
      }
    } catch (e) {
      if (e instanceof QuotaError) throw e;
      console.warn('Meal plan request failed, using offline recipe', e);
      reason = 'network';
    }
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    eating_window_start: timing.eating_window_start,
    eating_window_end: timing.eating_window_end,
    total_kcal: targets.kcal,
    protein_g: targets.protein_g,
    carbs_g: targets.carbs_g,
    fat_g: targets.fat_g,
    pre_training_snack_time: timing.pre_training_snack_time,
    main_meal_time: timing.main_meal_time,
    ai_reasoning: timing.reasoning,
    timing_warning: timing.warning,
    training_burn_kcal: targets.burn_kcal,
    timing_pattern: timing.pattern,
    training_start_time: training?.start_time ?? null,
    training_duration_min: training?.duration_min ?? 0,
    recipe_source: recipe ? 'ai' : 'offline',
    recipe_note: recipe ? null : describeRecipeFallback(reason, detail),
    recipe: recipe ?? offlineRecipe(profile, training, targets),
  };
}

/** Deterministic fallback so the planner still produces something actionable offline. */
function offlineRecipe(
  profile: UserProfile,
  training: Training | null,
  targets: { protein_g: number; carbs_g: number; fat_g: number }
): Recipe {
  const proteinRaw = Math.round(targets.protein_g / 0.26); // ~26g protein per 100g cooked lean meat
  const carbRaw = Math.round(targets.carbs_g / 0.2); // ~20g carbs per 100g cooked rice/potato
  const oilTbsp = Math.max(1, Math.round(targets.fat_g / 28));
  const sport = training?.sport ?? 'rest day';

  return {
    title: training ? `${sport[0].toUpperCase()}${sport.slice(1)} Recovery Plate` : 'OMAD Maintenance Plate',
    ingredients: [
      `${proteinRaw}g chicken breast, salmon or firm tofu`,
      `${carbRaw}g sweet potato or jasmine rice (raw weight ~${Math.round(carbRaw / 2.5)}g)`,
      '250g mixed greens — broccoli, spinach, asparagus',
      `${oilTbsp} tbsp extra virgin olive oil`,
      '1 tsp sea salt, plus lemon, garlic and black pepper',
    ],
    instructions:
      '1. Season the protein with salt, garlic and pepper and rest it 10 minutes at room temperature. ' +
      '2. Cube the carb source, toss in half the oil and roast at 200°C for 22 minutes. ' +
      '3. Sear the protein 5–6 minutes per side until just cooked through, then rest 5 minutes. ' +
      '4. Steam the greens 4 minutes and finish with the remaining oil and lemon.',
    reheat_instructions:
      '1. Skillet: 1 tsp oil, medium heat, 4 minutes, turning once — best texture. ' +
      '2. Air fryer: 180°C for 4 minutes to re-crisp the protein and the roast carbs. ' +
      '3. Microwave: cover with a damp paper towel, 800W for 2.5 minutes, and add the greens only for the last 30 seconds.',
    prep_time_min: 30,
    is_meal_prep: true,
  };
}

export type ChatTurn = { role: 'user' | 'ai'; content: string };

export type StoredMessage = { id: string; sender: 'user' | 'ai'; text: string; failed?: boolean };

/** Cap on what is kept. Long enough to hold a real thread, short enough that
 *  the transcript never grows without bound on a device with no accounts. */
export const CHAT_KEEP = 40;

/**
 * What counts as conversation.
 *
 * The canned greeting is generated, not said, and a failed send is an error
 * message dressed as a reply — feeding either back to the coach teaches it to
 * imitate them. The same rule decides what gets persisted, so the thread the
 * user sees and the context the model receives can never drift apart.
 */
export function conversationOf(messages: StoredMessage[], max = CHAT_KEEP): StoredMessage[] {
  return (messages ?? [])
    .filter((m) => m && m.id !== 'greeting' && !m.failed && typeof m.text === 'string' && m.text.trim())
    .slice(-max)
    .map(({ id, sender, text }) => ({ id, sender, text }));
}

/**
 * Sends to the `chat` edge function, which holds the Gemini key.
 * Throws on failure — the caller shows the error rather than a canned tip
 * dressed up as a real answer.
 */
export async function askCoach(
  message: string,
  history: ChatTurn[],
  profile?: UserProfile | null,
  plan?: MealPlan | null
): Promise<string> {
  if (!SUPABASE_URL) throw new Error('Coach is not configured.');

  const res = await postJSON('chat', {
    message,
    // Trim to the last few turns: the whole transcript would grow the prompt
    // (and the bill) without improving the answer.
    history: history.slice(-8),
    // Lets the coach answer "how much protein should I have" with a number
    // instead of a general range.
    profile: profile
      ? {
          weight_kg: profile.weight_kg,
          goal: profile.goal,
          fitness_level: profile.fitness_level,
          eating_window: `${profile.omad_window_start} for ${profile.omad_window_hours}h`,
          training_time: profile.default_training_time,
        }
      : null,
    // Without this the coach cannot answer "what am I eating tonight" or
    // "is that enough protein" — it only knew the profile. Deliberately a
    // summary, not the whole recipe: the ingredient list would triple the
    // prompt without improving the answer.
    plan: plan
      ? {
          eating_window: `${plan.eating_window_start}-${plan.eating_window_end}`,
          main_meal_time: plan.main_meal_time,
          pre_training_snack_time: plan.pre_training_snack_time,
          kcal: plan.total_kcal,
          protein_g: plan.protein_g,
          carbs_g: plan.carbs_g,
          fat_g: plan.fat_g,
          meal: plan.recipe.title,
        }
      : null,
  }, TIMEOUT_CHAT_MS);

  if (!res.ok) {
    // The function reports reason and Google's own detail; both were discarded.
    const body = await res.json().catch(() => ({} as any));
    if (res.status === 429 || body?.reason === 'quota') {
      throw new Error(describeQuotaError(body?.detail));
    }
    throw new Error('Coach is unavailable right now.');
  }

  const data = await res.json();
  const reply = ['response', 'reply', 'message']
    .map((k) => data?.[k])
    .find((v) => typeof v === 'string' && v.trim());
  if (!reply) throw new Error('Coach returned an empty answer.');
  return String(reply).trim();
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const quota = describeRecipeFallback('quota');
  assert(quota.includes('rate limited'), `quota names the limit, got: ${quota}`);
  assert(quota.includes('unaffected'), 'and still reassures that the numbers hold');
  assert(describeRecipeFallback('auth') === describeRecipeFallback('no_key'), 'auth and no_key read the same to a user');
  assert(describeRecipeFallback('network').includes('No connection'), 'network says so plainly');
  assert(describeRecipeFallback('truncated') === describeRecipeFallback('unparseable'), 'unreadable output reads the same however it broke');

  // Unknown and missing reasons must still produce a usable sentence.
  for (const r of [null, undefined, '', 'something_new']) {
    const msg = describeRecipeFallback(r as any);
    assert(msg.length > 20, `a reason of ${JSON.stringify(r)} still explains itself`);
  }

  // The reassurance is the point: a fallback must never imply the plan is wrong.
  for (const r of ['quota', 'auth', 'no_key', 'network', null]) {
    assert(
      describeRecipeFallback(r as any).includes('unaffected'),
      `reason ${r} reassures that the numbers still hold`
    );
  }
  assert(describeRecipeFallback('truncated').includes('Try again'), 'a transient failure invites a retry');

  // Quota wording: never promise a minute unless it is a minute.
  const perMinute = describeQuotaError('Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_requests_per_minute_per_project_per_model');
  assert(perMinute.includes('one minute'), `a per-minute limit says a minute, got: ${perMinute}`);

  const daily = describeQuotaError('Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20');
  assert(daily.includes('resets tomorrow'), 'a daily cap says tomorrow');
  assert(!/minute/i.test(daily), 'and never claims a minute — that is the bug this exists for');

  // The retry hint is not evidence: a daily cap reported under a minute here.
  const misleading = describeQuotaError('Please retry in 39.5s. Quota exceeded for metric: generate_content_free_tier_requests');
  assert(!/minute/i.test(misleading), 'a short retry hint does not turn a daily cap into a minute');

  for (const unknown of [null, undefined, '', 'something new from Google']) {
    const msg = describeQuotaError(unknown as any);
    assert(msg.length > 20, 'an unrecognised limit still explains itself');
    assert(!/minute|tomorrow/i.test(msg), `an unknown limit makes no timing claim, got: ${msg}`);
  }

  // The recipe fallback carries the same distinction rather than its own words.
  const recipeDaily = describeRecipeFallback('quota', 'generate_content_free_tier_requests, limit: 20');
  assert(recipeDaily.includes('resets tomorrow'), 'the planner says tomorrow too');
  assert(recipeDaily.includes('unaffected'), 'and still reassures that the numbers hold');

  // conversationOf: the greeting and failed sends are not conversation.
  const thread: StoredMessage[] = [
    { id: 'greeting', sender: 'ai', text: 'Ask me anything.' },
    { id: 'u1', sender: 'user', text: 'How much sodium?' },
    { id: 'a1', sender: 'ai', text: '3-5g.' },
    { id: 'e1', sender: 'ai', text: 'Coach is unavailable.', failed: true },
    { id: 'u2', sender: 'user', text: 'And potassium?' },
  ];
  const kept = conversationOf(thread);
  assert(kept.length === 3, `three real messages survive, got ${kept.length}`);
  assert(!kept.some((m) => m.id === 'greeting'), 'the canned greeting is not conversation');
  assert(!kept.some((m) => m.id === 'e1'), 'a failed send is not conversation');
  assert(!('failed' in kept[0]), 'the failed flag is not persisted');
  assert(kept[0].id === 'u1' && kept[2].id === 'u2', 'order is preserved');

  // Blank text is dropped, and the cap keeps the newest.
  assert(conversationOf([{ id: 'x', sender: 'user', text: '   ' }]).length === 0, 'whitespace is not a message');
  const many = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, sender: 'user' as const, text: `n${i}` }));
  const capped = conversationOf(many);
  assert(capped.length === CHAT_KEEP, `capped at ${CHAT_KEEP}, got ${capped.length}`);
  assert(capped[capped.length - 1].id === 'm59', 'the cap keeps the newest, not the oldest');
  assert(conversationOf([]).length === 0, 'an empty thread is empty');
  assert(conversationOf(null as any).length === 0, 'a missing thread does not throw');

  return 'ai.ts: all checks passed';
}
