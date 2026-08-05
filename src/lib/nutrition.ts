/**
 * Single source of truth for every number the app shows.
 *
 * Before this file the same user got four different TDEEs (dashboard, planner,
 * profile, edge function each had their own formula). Everything routes here now.
 * Pure functions only — no IO, no React — so `demo()` at the bottom can check them.
 */

export type Sex = 'male' | 'female' | 'other';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'performance' | 'weight_loss' | 'muscle_gain';
export type Intensity = 'low' | 'medium' | 'high' | 'max';

export type UserProfile = {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  fitness_level: FitnessLevel;
  goal: Goal;
  /** HH:MM, when the eating window opens */
  omad_window_start: string;
  /** length of the eating window in hours (1–12) */
  omad_window_hours: number;
  default_training_time: string;
};

export type Training = {
  sport: string;
  duration_min: number;
  intensity: Intensity;
  /** HH:MM */
  start_time: string;
};

export type Macros = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export const DEFAULT_PROFILE: UserProfile = {
  weight_kg: 75,
  height_cm: 175,
  age: 30,
  sex: 'male',
  fitness_level: 'intermediate',
  goal: 'performance',
  omad_window_start: '18:00',
  omad_window_hours: 2,
  default_training_time: '18:00',
};

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Onboarding used to write 'Male' / 'Weight Loss' / 'Intermediate'; the rest of
 *  the app compares against 'male' / 'weight_loss'. Every read goes through here
 *  so old stored profiles keep working instead of silently falling back. */
function normEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  const key = String(raw ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  return (allowed as readonly string[]).includes(key) ? (key as T) : fallback;
}

function normNumber(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** HH:MM, clamped to a real clock time. Accepts "9:5", "09:05", "18.30". */
export function normTime(raw: unknown, fallback: string): string {
  const m = String(raw ?? '').match(/^(\d{1,2})[:.h]?(\d{2})?$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2] ?? '0', 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function normalizeProfile(raw: any): UserProfile {
  const d = DEFAULT_PROFILE;
  if (!raw || typeof raw !== 'object') return d;

  // Legacy profiles stored the *fasting* length here (e.g. 20 or 23) rather than
  // the eating window. Anything over 12 is unambiguously a fast length.
  let windowHours = normNumber(raw.omad_window_hours, d.omad_window_hours, 1, 23);
  if (windowHours > 12) windowHours = 24 - windowHours;

  return {
    weight_kg: normNumber(raw.weight_kg, d.weight_kg, 30, 300),
    height_cm: normNumber(raw.height_cm, d.height_cm, 120, 250),
    age: normNumber(raw.age, d.age, 14, 100),
    sex: normEnum(raw.sex, ['male', 'female', 'other'] as const, d.sex),
    fitness_level: normEnum(
      raw.fitness_level,
      ['beginner', 'intermediate', 'advanced'] as const,
      d.fitness_level
    ),
    goal: normEnum(
      raw.goal,
      ['performance', 'weight_loss', 'muscle_gain'] as const,
      d.goal
    ),
    omad_window_start: normTime(raw.omad_window_start, d.omad_window_start),
    omad_window_hours: Math.max(1, Math.round(windowHours)),
    default_training_time: normTime(raw.default_training_time, d.default_training_time),
  };
}

/**
 * Named fasting protocols.
 *
 * The onboarding asked for "1h / 2h / 4h" without saying what any of them are.
 * These are the recognised shapes of the same idea, so the choice reads as a
 * decision rather than a number entry.
 *
 * `windowHours` is the only thing that actually drives the maths — everything
 * downstream already works from the eating window — so a free-form window
 * remains valid and simply matches no protocol.
 */
export type Protocol = {
  id: string;
  label: string;
  windowHours: number;
  /** What choosing this one costs and buys, in one line. */
  note: string;
};

export const PROTOCOLS: Protocol[] = [
  {
    id: 'omad-strict',
    label: 'Strict OMAD',
    windowHours: 1,
    note: 'One sitting, 23 hours off. Hardest to hit a large calorie target in.',
  },
  {
    id: 'omad',
    label: 'OMAD',
    windowHours: 2,
    note: 'One meal with room to finish it. The usual starting point.',
  },
  {
    id: 'warrior',
    label: 'Warrior 20:4',
    windowHours: 4,
    note: 'A long meal or a small one and a large one. Easier on heavy training days.',
  },
  {
    id: '18-6',
    label: '18:6',
    windowHours: 6,
    note: 'Two proper meals. Less strict, and simpler to eat enough protein in.',
  },
  {
    id: '16-8',
    label: '16:8',
    windowHours: 8,
    note: 'The gentlest version. Often where people start before shortening the window.',
  },
];

/** The protocol matching a window length, or null for a custom one. */
export function protocolForHours(hours: number): Protocol | null {
  return PROTOCOLS.find((p) => p.windowHours === hours) ?? null;
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

/** Mifflin-St Jeor — more accurate than Harris-Benedict for modern populations. */
export function bmr(p: UserProfile): number {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  // 'other' sits between the two sex-specific constants rather than defaulting to male.
  const offset = p.sex === 'female' ? -161 : p.sex === 'other' ? -78 : 5;
  return Math.round(base + offset);
}

/** Non-exercise activity only. Training is added separately so a hard session
 *  actually changes the numbers instead of being averaged into a multiplier. */
function neatMultiplier(level: FitnessLevel): number {
  return level === 'advanced' ? 1.4 : level === 'intermediate' ? 1.3 : 1.2;
}

const MET: Record<string, number> = {
  running: 9.8,
  cycling: 8.0,
  soccer: 7.0,
  boxing: 9.0,
  weights: 5.0,
  yoga: 3.0,
};

/** The sports the burn estimate knows. Also the whitelist a restored session
 *  is validated against, so a hand-edited store cannot smuggle in an unknown
 *  sport that would silently fall back to a generic MET value. */
export const SPORT_IDS = Object.keys(MET);

const INTENSITY_FACTOR: Record<Intensity, number> = {
  low: 0.8,
  medium: 1.0,
  high: 1.2,
  max: 1.4,
};

/** MET-based estimate. Sport/duration/intensity were collected but ignored before. */
export function trainingBurnKcal(p: UserProfile, t: Training | null): number {
  if (!t || t.duration_min <= 0) return 0;
  const met = MET[t.sport.toLowerCase()] ?? 6.0;
  const hours = Math.min(360, Math.max(0, t.duration_min)) / 60;
  return Math.round(met * INTENSITY_FACTOR[t.intensity] * p.weight_kg * hours);
}

/**
 * Daily targets. Pass today's training (or null for a rest day) — the same
 * profile on a rest day and a max-intensity day must not return the same kcal.
 */
export function dailyTargets(p: UserProfile, t: Training | null = null): Macros & { burn_kcal: number; maintenance_kcal: number } {
  const restingKcal = bmr(p);
  const burn = trainingBurnKcal(p, t);
  const maintenance = Math.round(restingKcal * neatMultiplier(p.fitness_level)) + burn;

  let kcal = maintenance;
  if (p.goal === 'weight_loss') kcal -= 500;
  if (p.goal === 'muscle_gain') kcal += 300;

  // Safety floor: never prescribe below BMR — an aggressive deficit stacked on a
  // 23h fast is how people lose muscle and stall their thyroid.
  kcal = Math.max(kcal, restingKcal);

  const proteinPerKg = p.goal === 'weight_loss' ? 2.2 : p.goal === 'muscle_gain' ? 2.0 : 1.8;
  const protein_g = Math.round(p.weight_kg * proteinPerKg);

  // 25% of intake from fat, but never under 0.8 g/kg (hormone production floor).
  const fat_g = Math.max(Math.round((kcal * 0.25) / 9), Math.round(p.weight_kg * 0.8));

  const carbs_g = Math.max(0, Math.round((kcal - (protein_g * 4 + fat_g * 9)) / 4));

  return { kcal, protein_g, carbs_g, fat_g, burn_kcal: burn, maintenance_kcal: maintenance };
}

/**
 * Daily fluid target. A fixed 3.5L told a 60kg and a 100kg athlete the same
 * thing, which is simply wrong. ~40ml/kg, with a bump on training days for
 * sweat loss, clamped to a range that stays sensible at both extremes.
 */
export function hydrationTargetMl(p: UserProfile, t: Training | null = null): number {
  const base = p.weight_kg * 40 + (t && t.duration_min > 0 ? 500 : 0);
  // Round to 100ml — false precision on a number nobody measures exactly.
  return Math.round(Math.min(5000, Math.max(2000, base)) / 100) * 100;
}

/**
 * The planner's last input, so the same session does not have to be dialled in
 * five times a week. Validated on read: everything here comes back from device
 * storage, and an unknown sport or a duration of 10000 would otherwise flow
 * straight into the burn estimate.
 */
export type SessionDraft = {
  restDay: boolean;
  sport: string;
  duration_min: number;
  intensity: Intensity;
  start_time: string;
};

export function normalizeSession(raw: any, fallbackTime: string): SessionDraft {
  const base: SessionDraft = {
    restDay: false,
    sport: 'weights',
    duration_min: 60,
    intensity: 'medium',
    start_time: normTime(fallbackTime, DEFAULT_PROFILE.default_training_time),
  };
  if (!raw || typeof raw !== 'object') return base;

  const sport = String(raw.sport ?? '').toLowerCase();
  const intensity = String(raw.intensity ?? '').toLowerCase();

  return {
    restDay: raw.restDay === true,
    sport: SPORT_IDS.includes(sport) ? sport : base.sport,
    duration_min: Math.round(normNumber(raw.duration_min, base.duration_min, 5, 360)),
    intensity: (['low', 'medium', 'high', 'max'] as const).includes(intensity as Intensity)
      ? (intensity as Intensity)
      : base.intensity,
    start_time: normTime(raw.start_time, base.start_time),
  };
}

// ---------------------------------------------------------------------------
// Clock helpers
// ---------------------------------------------------------------------------

export function toMinutes(hhmm: string): number {
  const [h, m] = normTime(hhmm, '00:00').split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins: number): string {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Fasting state
// ---------------------------------------------------------------------------

export type FastingState = {
  isEating: boolean;
  /** 0–100. While fasting: how far through the fast. While eating: through the window. */
  progressPct: number;
  /** ms until the window opens (fasting) or closes (eating) */
  remainingMs: number;
  windowStart: string;
  windowEnd: string;
  fastingHours: number;
};

export function fastingState(p: UserProfile, now: Date = new Date()): FastingState {
  const startMin = toMinutes(p.omad_window_start);
  const windowMin = p.omad_window_hours * 60;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // Minutes since the window opened, wrapped into a 24h cycle. This handles a
  // window that crosses midnight (e.g. 23:00 + 2h) without special-casing it.
  const sinceOpen = ((nowMin - startMin) % 1440 + 1440) % 1440;
  const isEating = sinceOpen < windowMin;

  const fastingMin = 1440 - windowMin;
  const remainingMin = isEating ? windowMin - sinceOpen : 1440 - sinceOpen;
  const progressPct = isEating
    ? (sinceOpen / windowMin) * 100
    : ((sinceOpen - windowMin) / fastingMin) * 100;

  return {
    isEating,
    progressPct: Math.min(100, Math.max(0, progressPct)),
    remainingMs: Math.max(0, remainingMin * 60 * 1000),
    windowStart: fromMinutes(startMin),
    windowEnd: fromMinutes(startMin + windowMin),
    fastingHours: Math.round((fastingMin / 60) * 10) / 10,
  };
}

/**
 * Seconds only appear inside the final hour. Nineteen hours out they are noise,
 * and the three-part string is too wide to sit inside the dial.
 */
/**
 * Roughly what the body is doing at a given point in a fast.
 *
 * This is the thing someone opens a fasting app to see, and it is also the
 * easiest place to overclaim. So the rules here are strict:
 *
 * - Bands are **approximate**. The transitions are gradual and move with the
 *   last meal, training, sleep and the person. The UI says so.
 * - Describes physiology only. No claim that any of it produces a health
 *   outcome, no disease language, no numbers presented as measured.
 * - `note` never promises. It says what is typically happening and, where it
 *   matters, what that means for how you will feel training.
 */
export type FastingStage = {
  id: 'fed' | 'post-absorptive' | 'glycogen-falling' | 'ketosis-rising' | 'deep';
  label: string;
  /** Hours into the fast at which this band begins. */
  from: number;
  note: string;
};

const STAGES: FastingStage[] = [
  {
    id: 'fed',
    label: 'Fed',
    from: 0,
    note: 'Still absorbing the last meal. Insulin is high and fuel is coming from the plate.',
  },
  {
    id: 'post-absorptive',
    label: 'Post-absorptive',
    from: 4,
    note: 'Absorption is finishing. The body starts drawing on stored glycogen for glucose.',
  },
  {
    id: 'glycogen-falling',
    label: 'Glycogen falling',
    from: 12,
    note: 'Liver glycogen is running down. Hard efforts start to feel more expensive around here.',
  },
  {
    id: 'ketosis-rising',
    label: 'Ketones rising',
    from: 16,
    note: 'More fuel is coming from fat, and ketones climb. Sodium losses climb with them.',
  },
  {
    id: 'deep',
    label: 'Deep fast',
    from: 20,
    note: 'Fat is the main fuel. Most people feel steady here; some feel cold or flat.',
  },
];

/** The band a fast of this many hours falls in. Clamped, never null. */
export function fastingStage(hoursFasted: number): FastingStage {
  const h = isFinite(hoursFasted) ? Math.max(0, hoursFasted) : 0;
  let current = STAGES[0];
  for (const stage of STAGES) if (h >= stage.from) current = stage;
  return current;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 1) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Meal timing — the actual product
// ---------------------------------------------------------------------------

export type MealTiming = {
  /** 'pre' = eat then train, 'post' = fasted training then eat, 'overlap' = training inside the window */
  pattern: 'pre' | 'post' | 'overlap';
  pre_training_snack_time: string | null;
  main_meal_time: string;
  eating_window_start: string;
  eating_window_end: string;
  reasoning: string;
  /** Non-fatal advice, e.g. window too close to training start */
  warning: string | null;
};

/**
 * Where the meal falls relative to the workout. The edge function used to
 * hardcode a 19:00 window end and a null snack time for everyone.
 */
export function mealTiming(p: UserProfile, t: Training | null): MealTiming {
  const windowStart = toMinutes(p.omad_window_start);
  const windowLen = p.omad_window_hours * 60;
  const windowEnd = windowStart + windowLen;

  const base = {
    eating_window_start: fromMinutes(windowStart),
    eating_window_end: fromMinutes(windowEnd),
  };

  if (!t || t.duration_min <= 0) {
    return {
      ...base,
      pattern: 'post',
      pre_training_snack_time: null,
      main_meal_time: fromMinutes(windowStart),
      reasoning:
        'Rest day: no workout to fuel, so the meal sits at the top of your window. Prioritise protein and fibre for recovery and satiety through tomorrow\'s fast.',
      warning: null,
    };
  }

  const trainStart = toMinutes(t.start_time);
  const trainEnd = trainStart + t.duration_min;
  const hard = t.intensity === 'high' || t.intensity === 'max';

  // Eat first, then train.
  if (windowEnd <= trainStart) {
    const gap = trainStart - windowEnd;
    return {
      ...base,
      pattern: 'pre',
      pre_training_snack_time: null,
      main_meal_time: fromMinutes(windowStart),
      reasoning: `Your window closes ${Math.round(gap / 60 * 10) / 10}h before ${t.sport}, so this is a fed session. Keep fat moderate in the meal — it slows gastric emptying and is what makes you feel heavy on the ${Math.round(t.duration_min)}min session.`,
      warning:
        gap < 90
          ? `Only ${gap}min between your last bite and training. Push the window earlier or keep the meal lighter to avoid GI distress.`
          : null,
    };
  }

  // Fasted training, then break the fast.
  if (windowStart >= trainEnd) {
    const mainMeal = Math.max(windowStart, trainEnd + 30);
    return {
      ...base,
      pattern: 'post',
      // A hard fasted session earns a small pre-workout carb hit; easy work does not.
      pre_training_snack_time: hard ? fromMinutes(trainStart - 45) : null,
      main_meal_time: fromMinutes(mainMeal),
      reasoning: hard
        ? `Fasted ${t.intensity}-intensity ${t.sport}. Take 20–30g fast carbs plus sodium 45min out to protect output, then break the fast within 30min of finishing while insulin sensitivity is peaked.`
        : `Fasted ${t.sport} at ${t.intensity} intensity is well within what you can do on water and electrolytes. Break the fast within 30min of finishing to start glycogen resynthesis.`,
      warning:
        trainEnd + 30 > windowEnd
          ? 'Your workout ends after your eating window closes. Shift the window later or train earlier.'
          : null,
    };
  }

  // Training lands inside the eating window — split the meal around it.
  return {
    ...base,
    pattern: 'overlap',
    pre_training_snack_time: fromMinutes(Math.max(windowStart, trainStart - 60)),
    main_meal_time: fromMinutes(Math.min(windowEnd - 30, trainEnd + 20)),
    reasoning: `${t.sport} falls inside your eating window. Split it: a small carb-led portion 60min before you start, then the bulk of the meal 20min after you finish. Eating the full ${Math.round(t.duration_min)}min worth of food beforehand is what causes the mid-session slump.`,
    warning: null,
  };
}

// ---------------------------------------------------------------------------
// Weight trend
// ---------------------------------------------------------------------------

/**
 * Least-squares slope in kg/week. A single day-to-day delta is mostly water,
 * so the trend line is what the progress screen should report.
 * Returns null when there aren't enough distinct points to fit a line.
 */
export function weeklyTrend(entries: { date: string; weight_kg: number }[]): number | null {
  const points = (entries ?? [])
    .map((e) => ({ x: Date.parse(e.date + 'T12:00:00') / (7 * 86400000), y: e.weight_kg }))
    .filter((p) => isFinite(p.x) && isFinite(p.y));
  if (points.length < 2) return null;

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const denom = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (denom === 0) return null; // all entries on the same day

  const slope = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / denom;
  return Math.round(slope * 100) / 100;
}

// ---------------------------------------------------------------------------
// Self-check: compile with tsc then `node -e "require('./nutrition').demo()"`
// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // Legacy capitalised values from the old onboarding must normalise, not fall back.
  const legacy = normalizeProfile({
    weight_kg: '68', height_cm: '170', age: '28',
    sex: 'Female', fitness_level: 'Advanced', goal: 'Weight Loss',
    omad_window_start: '18:00', omad_window_hours: 2, default_training_time: '19:00',
  });
  assert(legacy.sex === 'female', 'sex normalises');
  assert(legacy.goal === 'weight_loss', 'goal normalises');
  assert(legacy.fitness_level === 'advanced', 'fitness normalises');
  assert(legacy.weight_kg === 68, 'numeric strings parse');

  // Female BMR must differ from male — this was the silently-wrong path.
  const male = normalizeProfile({ ...legacy, sex: 'male' });
  assert(bmr(legacy) !== bmr(male), 'sex changes BMR');

  // Legacy "fasting hours" stored in the eating-window field.
  assert(normalizeProfile({ omad_window_hours: 22 }).omad_window_hours === 2, 'fast length converts to window');

  // Garbage in must not produce NaN out.
  const junk = normalizeProfile({ weight_kg: 'abc', age: -5, omad_window_start: 'nonsense' });
  assert(isFinite(bmr(junk)), 'junk profile still yields finite BMR');
  assert(junk.omad_window_start === '18:00', 'bad time falls back');

  // Training must move the numbers.
  const rest = dailyTargets(legacy, null);
  const hard = dailyTargets(legacy, { sport: 'running', duration_min: 60, intensity: 'max', start_time: '19:00' });
  assert(hard.kcal > rest.kcal, 'hard training raises kcal');
  assert(hard.burn_kcal > 300, 'max-intensity hour of running burns >300kcal');

  // Deficit must never dip under BMR.
  const tiny = normalizeProfile({ weight_kg: 45, height_cm: 150, age: 60, sex: 'female', goal: 'weight_loss', fitness_level: 'beginner' });
  assert(dailyTargets(tiny).kcal >= bmr(tiny), 'kcal floor holds at BMR');

  // Macros must reconcile with the kcal target (rounding slack only).
  const m = dailyTargets(legacy, null);
  const fromMacros = m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
  assert(Math.abs(fromMacros - m.kcal) <= 12, `macros sum to kcal (${fromMacros} vs ${m.kcal})`);

  // Fasting state: at the moment the window opens we are eating; one minute before, not.
  const p = normalizeProfile({ omad_window_start: '18:00', omad_window_hours: 2 });
  const at18 = fastingState(p, new Date(2026, 0, 1, 18, 0, 0));
  const at1759 = fastingState(p, new Date(2026, 0, 1, 17, 59, 0));
  const at2001 = fastingState(p, new Date(2026, 0, 1, 20, 1, 0));
  assert(at18.isEating, 'eating at window open');
  assert(!at1759.isEating, 'fasting one minute before open');
  assert(!at2001.isEating, 'fasting after window closes');
  assert(at18.windowEnd === '20:00', 'window end computed');
  assert(Math.round(at18.fastingHours) === 22, '2h window => 22h fast');

  // A window crossing midnight must not break.
  const late = normalizeProfile({ omad_window_start: '23:00', omad_window_hours: 2 });
  assert(fastingState(late, new Date(2026, 0, 1, 0, 30, 0)).isEating, 'midnight-crossing window still eating at 00:30');
  assert(fastingState(late, new Date(2026, 0, 1, 22, 30, 0)).isEating === false, 'fasting before late window');

  // Timing patterns.
  const eatThenTrain = mealTiming(
    normalizeProfile({ omad_window_start: '15:00', omad_window_hours: 2 }),
    { sport: 'weights', duration_min: 60, intensity: 'high', start_time: '19:00' }
  );
  assert(eatThenTrain.pattern === 'pre', 'window before training => pre');

  const fastedThenEat = mealTiming(
    normalizeProfile({ omad_window_start: '20:00', omad_window_hours: 2 }),
    { sport: 'running', duration_min: 60, intensity: 'high', start_time: '18:00' }
  );
  assert(fastedThenEat.pattern === 'post', 'window after training => post');
  assert(fastedThenEat.pre_training_snack_time === '17:15', 'hard fasted session gets a 45min pre-snack');

  const easyFasted = mealTiming(
    normalizeProfile({ omad_window_start: '20:00', omad_window_hours: 2 }),
    { sport: 'yoga', duration_min: 60, intensity: 'low', start_time: '18:00' }
  );
  assert(easyFasted.pre_training_snack_time === null, 'easy fasted session needs no snack');

  const during = mealTiming(
    normalizeProfile({ omad_window_start: '18:00', omad_window_hours: 4 }),
    { sport: 'cycling', duration_min: 60, intensity: 'medium', start_time: '19:00' }
  );
  assert(during.pattern === 'overlap', 'training inside window => overlap');

  // Too-tight gap must warn rather than silently recommend it.
  const tight = mealTiming(
    normalizeProfile({ omad_window_start: '17:00', omad_window_hours: 1 }),
    { sport: 'running', duration_min: 45, intensity: 'high', start_time: '18:30' }
  );
  assert(tight.warning !== null, 'tight pre-training gap warns');

  // Hydration scales with bodyweight and clamps at both ends.
  assert(hydrationTargetMl(normalizeProfile({ weight_kg: 60 })) === 2400, 'a 60kg athlete gets 2.4L');
  assert(hydrationTargetMl(normalizeProfile({ weight_kg: 100 })) === 4000, 'a 100kg athlete gets 4L');
  assert(hydrationTargetMl(normalizeProfile({ weight_kg: 40 })) === 2000, 'floor holds for a very light athlete');
  assert(hydrationTargetMl(normalizeProfile({ weight_kg: 200 })) === 5000, 'ceiling holds for a very heavy athlete');
  assert(
    hydrationTargetMl(normalizeProfile({ weight_kg: 82 }), { sport: 'running', duration_min: 60, intensity: 'high', start_time: '18:00' }) >
      hydrationTargetMl(normalizeProfile({ weight_kg: 82 })),
    'training days need more fluid'
  );

  // Fasting bands: boundaries, clamping, and the wording rules.
  assert(fastingStage(0).id === 'fed', 'a fast starts fed');
  assert(fastingStage(3.9).id === 'fed', 'still fed just before four hours');
  assert(fastingStage(4).id === 'post-absorptive', 'four hours begins the post-absorptive band');
  assert(fastingStage(11.9).id === 'post-absorptive', 'and it runs to twelve');
  assert(fastingStage(12).id === 'glycogen-falling', 'twelve hours begins glycogen falling');
  assert(fastingStage(16).id === 'ketosis-rising', 'sixteen hours begins ketones rising');
  assert(fastingStage(20).id === 'deep', 'twenty hours is a deep fast');
  assert(fastingStage(23.5).id === 'deep', 'and it stays that way to the window');
  assert(fastingStage(-5).id === 'fed', 'a negative fast clamps to fed');
  assert(fastingStage(NaN).id === 'fed', 'a NaN fast does not throw');
  assert(fastingStage(1000).id === 'deep', 'an absurd fast clamps to the last band');

  // Bands must be ordered and contiguous, or a fast could fall through a gap.
  for (let i = 1; i < STAGES.length; i++) {
    assert(STAGES[i].from > STAGES[i - 1].from, 'stage boundaries increase');
  }

  // The wording rule: physiology only, never an outcome or a disease.
  for (const stage of STAGES) {
    assert(stage.note.length > 20, `${stage.id} explains itself`);
    assert(
      !/cure|prevent|disease|cancer|heal|detox|toxin|guarantee|proven/i.test(stage.note),
      `${stage.id} makes no health claim`
    );
    assert(!/%|\bstudies\b/i.test(stage.note), `${stage.id} invents no statistic`);
  }

  // Protocols are a naming layer over the window length; the maths is unchanged.
  assert(protocolForHours(1)?.id === 'omad-strict', 'a one-hour window is strict OMAD');
  assert(protocolForHours(4)?.id === 'warrior', 'four hours is the warrior shape');
  assert(protocolForHours(8)?.id === '16-8', 'eight hours is 16:8');
  assert(protocolForHours(3) === null, 'an unlisted window is custom, not forced into a name');
  assert(protocolForHours(0) === null, 'a nonsense window matches nothing');
  assert(new Set(PROTOCOLS.map((p) => p.windowHours)).size === PROTOCOLS.length, 'each protocol owns one window length');
  assert(PROTOCOLS.every((p) => p.windowHours >= 1 && p.windowHours <= 12), 'every protocol is a window the profile accepts');
  // The label has to state the fast, not just the window, or 16:8 and 18:6 read alike.
  for (const p of PROTOCOLS) {
    const profile = normalizeProfile({ omad_window_hours: p.windowHours });
    assert(profile.omad_window_hours === p.windowHours, `${p.id} survives profile normalisation`);
    assert(fastingState(profile, new Date(2026, 0, 1, 12)).fastingHours === 24 - p.windowHours, `${p.id} implies a ${24 - p.windowHours}h fast`);
  }

  // Session drafts come back from device storage, so they are validated.
  const goodSession = normalizeSession(
    { restDay: false, sport: 'running', duration_min: 90, intensity: 'high', start_time: '06:30' },
    '18:00'
  );
  assert(goodSession.sport === 'running' && goodSession.duration_min === 90, 'a valid session round-trips');
  assert(goodSession.intensity === 'high' && goodSession.start_time === '06:30', 'intensity and time round-trip');

  const junkSession = normalizeSession(
    { sport: 'quidditch', duration_min: 10000, intensity: 'ludicrous', start_time: 'nope' },
    '19:00'
  );
  assert(junkSession.sport === 'weights', 'an unknown sport falls back rather than reaching the burn estimate');
  assert(junkSession.duration_min === 360, 'an absurd duration is clamped');
  assert(junkSession.intensity === 'medium', 'an unknown intensity falls back');
  assert(junkSession.start_time === '19:00', 'a bad time falls back to the profile time');

  assert(normalizeSession(null, '17:00').start_time === '17:00', 'no stored session uses the profile time');
  assert(normalizeSession({ restDay: 'yes' }, '17:00').restDay === false, 'only a real true counts as a rest day');
  assert(normalizeSession({ restDay: true }, '17:00').restDay === true, 'a rest day round-trips');
  assert(SPORT_IDS.includes('weights') && SPORT_IDS.length >= 6, 'the sport whitelist is the burn table');

  assert(fromMinutes(toMinutes('07:05')) === '07:05', 'clock round-trips');
  assert(fromMinutes(-30) === '23:30', 'negative minutes wrap');

  // Weight trend: a clean 1kg/week loss must read as -1.
  const losing = [
    { date: '2026-01-01', weight_kg: 80 },
    { date: '2026-01-08', weight_kg: 79 },
    { date: '2026-01-15', weight_kg: 78 },
  ];
  assert(weeklyTrend(losing) === -1, `steady 1kg/week loss reads -1, got ${weeklyTrend(losing)}`);
  assert(weeklyTrend([{ date: '2026-01-01', weight_kg: 80 }]) === null, 'one point has no trend');
  assert(weeklyTrend([]) === null, 'empty log has no trend');
  assert(
    weeklyTrend([
      { date: '2026-01-01', weight_kg: 80 },
      { date: '2026-01-01', weight_kg: 81 },
    ]) === null,
    'same-day entries have no trend (no divide by zero)'
  );
  // Noise around a flat mean must not read as a big trend.
  const flat = weeklyTrend([
    { date: '2026-01-01', weight_kg: 80.5 },
    { date: '2026-01-03', weight_kg: 79.6 },
    { date: '2026-01-05', weight_kg: 80.4 },
    { date: '2026-01-08', weight_kg: 80.0 },
  ]);
  assert(flat !== null && Math.abs(flat) < 0.5, `daily noise stays near zero, got ${flat}`);

  return 'nutrition.ts: all checks passed';
}
