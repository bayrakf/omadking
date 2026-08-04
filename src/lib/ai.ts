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

  if (SUPABASE_URL) {
    try {
      const res = await postJSON('generate_meal_plan', {
        ...profile,
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
      }
    } catch (e) {
      if (e instanceof QuotaError) throw e;
      console.warn('Meal plan request failed, using offline recipe', e);
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
    training_start_time: training?.start_time ?? null,
    training_duration_min: training?.duration_min ?? 0,
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

/**
 * Sends to the `chat` edge function, which holds the Gemini key.
 * Throws on failure — the caller shows the error rather than a canned tip
 * dressed up as a real answer.
 */
export async function askCoach(
  message: string,
  history: ChatTurn[],
  profile?: UserProfile | null
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
  }, TIMEOUT_CHAT_MS);

  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? 'Too many questions right now — try again in a minute.'
        : 'Coach is unavailable right now.'
    );
  }

  const data = await res.json();
  const reply = ['response', 'reply', 'message']
    .map((k) => data?.[k])
    .find((v) => typeof v === 'string' && v.trim());
  if (!reply) throw new Error('Coach returned an empty answer.');
  return String(reply).trim();
}
