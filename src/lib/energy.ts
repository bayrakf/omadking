/**
 * What the scale says the body actually costs.
 *
 * `dailyTargets` estimates maintenance from Mifflin-St Jeor plus an activity
 * multiplier. For a population that is fine; for a person it is regularly wrong
 * by a fifth. Someone whose real maintenance is 2,200 gets told to eat 2,110,
 * loses nothing over two months, and concludes they are the problem.
 *
 * The evidence to settle it is already in the app. Energy balance says that
 * eating E kcal a day while changing Δ kg a week means
 *
 *     maintenance ≈ E − Δ × (7700 / 7)
 *
 * so two weeks of intake and weigh-ins measure what the formula guessed. This
 * module does that measurement and, more importantly, refuses to when the data
 * cannot carry it.
 *
 * The 7700 kcal per kilogram figure is the standard approximation for mixed
 * tissue. It is an approximation, and the app says so wherever it shows a
 * number derived from it.
 */

import { weeklyTrend, fastingState, toMinutes, bmr, type UserProfile } from './nutrition';
import { parseISO, todayISO } from './dates';

/** Standard approximation for a kilogram of body mass. */
export const KCAL_PER_KG = 7700;

/** How far back to look. Longer than the minimum so a gap does not disqualify. */
export const WINDOW_DAYS = 21;

// Below any of these the answer is "not yet", never a number.
export const MIN_SPAN_DAYS = 10;
export const MIN_INTAKE_DAYS = 8;
export const MIN_WEIGH_INS = 4;

/** Most the target may move in one correction. A bad fortnight is not a new metabolism. */
export const MAX_STEP = 0.15;

/** A day's eating, as the three-tap question records it. */
export type IntakeEntry = { date: string; factor: number; target_kcal: number };
export type WeighIn = { date: string; weight_kg: number };

export type Measurement = {
  /** Measured maintenance, or null while the data cannot support one. */
  kcal: number | null;
  /** How far the formula was off. Null when there is nothing to compare. */
  deltaToEstimate: number | null;
  intakeDays: number;
  weighIns: number;
  spanDays: number;
  confidence: 'none' | 'low' | 'good';
  /** What is still missing, phrased for a person. Null once there is a number. */
  missing: string | null;
};

const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

function withinWindow<T extends { date: string }>(rows: unknown, today: string): T[] {
  const cutoff = daysBetween('1970-01-01', today) - WINDOW_DAYS;
  return (Array.isArray(rows) ? rows : []).filter(
    (r: any): r is T =>
      r && typeof r.date === 'string' && daysBetween('1970-01-01', r.date) >= cutoff
  );
}

/**
 * Measures maintenance from what was eaten and what the scale did.
 *
 * `estimateKcal` is the formula's answer, used only to bound the correction and
 * to report the gap. Passing 0 disables both.
 */
export function measuredMaintenance(
  intakeLog: unknown,
  weights: unknown,
  estimateKcal: number,
  today: string = todayISO()
): Measurement {
  const intake = withinWindow<IntakeEntry>(intakeLog, today).filter(
    (e) => isFinite(e.factor) && e.factor > 0 && isFinite(e.target_kcal) && e.target_kcal > 0
  );
  const weighed = withinWindow<WeighIn>(weights, today)
    .filter((w) => isFinite(w.weight_kg) && w.weight_kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const spanDays = weighed.length >= 2 ? daysBetween(weighed[0].date, weighed[weighed.length - 1].date) : 0;

  const base: Measurement = {
    kcal: null,
    deltaToEstimate: null,
    intakeDays: intake.length,
    weighIns: weighed.length,
    spanDays,
    confidence: 'none',
    missing: null,
  };

  // Say what is missing rather than showing a number that is not earned yet.
  if (intake.length < MIN_INTAKE_DAYS) {
    return { ...base, missing: `${MIN_INTAKE_DAYS - intake.length} more days of answering how you ate` };
  }
  if (weighed.length < MIN_WEIGH_INS) {
    return { ...base, missing: `${MIN_WEIGH_INS - weighed.length} more weigh-ins` };
  }
  if (spanDays < MIN_SPAN_DAYS) {
    return { ...base, missing: `weigh-ins spread over ${MIN_SPAN_DAYS} days — yours cover ${spanDays}` };
  }

  const trend = weeklyTrend(weighed);
  if (trend === null) {
    return { ...base, missing: 'weigh-ins on more than one day' };
  }

  const avgIntake = intake.reduce((s, e) => s + e.factor * e.target_kcal, 0) / intake.length;
  // Losing weight means the body cost more than the plate provided.
  const raw = avgIntake - trend * (KCAL_PER_KG / 7);

  // A single strange fortnight must not rewrite the target. Bounded against the
  // formula, which is wrong but not wild.
  const bounded =
    estimateKcal > 0
      ? Math.min(estimateKcal * (1 + MAX_STEP), Math.max(estimateKcal * (1 - MAX_STEP), raw))
      : raw;

  const kcal = Math.round(bounded / 10) * 10;

  return {
    ...base,
    kcal,
    deltaToEstimate: estimateKcal > 0 ? kcal - Math.round(estimateKcal) : null,
    confidence: intake.length >= 12 && weighed.length >= 6 ? 'good' : 'low',
    missing: null,
  };
}

/**
 * The maintenance a screen should actually plan with.
 *
 * One place decides whether the measurement is applied, so no screen has to
 * remember the rule. `premium` is passed in rather than read here — `isPremium`
 * stays the single source of truth, and this stays a pure function.
 *
 * Returns undefined rather than a number when the measurement should not be
 * used, which is exactly what `dailyTargets` expects for "carry on as before".
 */
export function effectiveMaintenance(
  intakeLog: unknown,
  weights: unknown,
  estimateKcal: number,
  premium: boolean,
  today?: string
): number | undefined {
  if (!premium) return undefined;
  return measuredMaintenance(intakeLog, weights, estimateKcal, today).kcal ?? undefined;
}

/**
 * Which day the app should ask about, if any.
 *
 * The first version asked only in the six hours after the window closed, so
 * anyone who opened the app next morning silently lost the day. The fix is to
 * name the day rather than the moment: every eating window that has closed
 * belongs to a date, and that date is answerable until the next one closes.
 *
 * The date comes from winding the clock back by "minutes since the window
 * opened", which `fastingState` already computes in a way that survives a
 * window crossing midnight. No date arithmetic of its own, no special cases.
 */
export type IntakeQuestion = { date: string; hoursSinceClose: number };

export function intakeQuestionFor(
  profile: UserProfile,
  intakeLog: unknown,
  now: Date = new Date()
): IntakeQuestion | null {
  const fast = fastingState(profile, now);
  // Nothing to report on while the window is still open.
  if (fast.isEating) return null;

  const startMin = toMinutes(profile.omad_window_start);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sinceOpen = ((nowMin - startMin) % 1440 + 1440) % 1440;

  const openedAt = new Date(now.getTime() - sinceOpen * 60000);
  const date = todayISO(openedAt);

  const answered = (Array.isArray(intakeLog) ? intakeLog : []).some(
    (e: any) => e && e.date === date
  );
  if (answered) return null;

  const windowMin = profile.omad_window_hours * 60;
  return { date, hoursSinceClose: Math.round(((sinceOpen - windowMin) / 60) * 10) / 10 };
}

// ---------------------------------------------------------------------------

/**
 * A stall, told as arithmetic rather than as a verdict.
 *
 * People quit at plateaus, and usually because they read a flat line as
 * failure. It is not: holding weight while eating X means X *is* maintenance
 * now. The number moved, not the person's discipline — and saying that with the
 * new figure attached is the difference between someone continuing and someone
 * deleting the app.
 */
export type PlateauRead = {
  stalled: boolean;
  days: number;
  /** What to eat now, given the stall. Null when there is not enough to say. */
  newTarget: number | null;
  note: string;
};

/** A stall has to last this long before it is a stall and not a fortnight. */
export const PLATEAU_DAYS = 14;

export function readPlateau(
  intakeLog: unknown,
  weights: unknown,
  goal: string,
  deficitKcal: number,
  today: string = todayISO()
): PlateauRead {
  const none: PlateauRead = { stalled: false, days: 0, newTarget: null, note: '' };
  if (goal !== 'weight_loss') return none;

  const trend = readTrend(weights, today);
  if (trend.state !== 'steady') return none;

  const weighed = withinWindow<WeighIn>(weights, today).sort((a, b) => a.date.localeCompare(b.date));
  const days = weighed.length >= 2 ? daysBetween(weighed[0].date, weighed[weighed.length - 1].date) : 0;
  if (days < PLATEAU_DAYS) return none;

  // A flat trend means intake and maintenance have met, so the measurement is
  // at its most trustworthy here — no estimate needed to bound it.
  const measured = measuredMaintenance(intakeLog, weights, 0, today);
  if (measured.kcal === null) {
    return {
      stalled: true,
      days,
      newTarget: null,
      note: `Weight has held for ${days} days. That usually means maintenance has moved rather `
        + `than that anything went wrong — ${measured.missing} would let the app say by how much.`,
    };
  }

  const newTarget = Math.round((measured.kcal - Math.abs(deficitKcal)) / 10) * 10;
  return {
    stalled: true,
    days,
    newTarget,
    note: `Weight has held for ${days} days while you ate about ${measured.kcal} kcal. That is what `
      + `maintenance costs now — the number moved, not your discipline. Eating ${newTarget} puts the `
      + `deficit back.`,
  };
}

/**
 * Where this intake actually leads, and when.
 *
 * Every app answers "when will I get there" by dividing the distance by the
 * current rate. That is always too optimistic, and predictably so: a lighter
 * body costs less to run, so the same plate becomes a smaller deficit every
 * week. The line bends, and eventually it flattens.
 *
 * Which produces the sentence nobody else says — not "keep going" but "this
 * amount of food levels off at 79.4 kg, and reaching 75 needs a smaller plate
 * later". That is a plan someone can act on rather than a countdown that keeps
 * sliding.
 *
 * The rate at which maintenance falls is taken from the app's own BMR formula
 * rather than a constant, so it stays consistent with every other number shown.
 */
export type Forecast = {
  /** Weeks to the target at this intake. Null when it is never reached. */
  weeks: number | null;
  /** ISO date for that, or null. */
  date: string | null;
  /** Where this intake stops producing a deficit. Null if the target comes first. */
  stallWeight: number | null;
  note: string;
};

/** Below this a weekly deficit is not distinguishable from measurement error. */
const MIN_MEANINGFUL_DEFICIT = 50;
const MAX_WEEKS = 260;

export function forecast(
  profile: UserProfile,
  currentWeight: number,
  targetWeight: number,
  maintenanceNow: number,
  intakeKcal: number,
  today: string = todayISO()
): Forecast {
  const none: Forecast = { weeks: null, date: null, stallWeight: null, note: '' };
  if (![currentWeight, targetWeight, maintenanceNow, intakeKcal].every((n) => isFinite(n) && n > 0)) return none;
  if (targetWeight >= currentWeight) return none;

  // How much daily maintenance moves per kilogram, from this app's own BMR.
  const perKg = Math.abs(
    bmr({ ...profile, weight_kg: currentWeight }) - bmr({ ...profile, weight_kg: currentWeight - 1 })
  ) * (maintenanceNow / Math.max(1, bmr({ ...profile, weight_kg: currentWeight })));

  let weight = currentWeight;
  let weeks = 0;

  while (weeks < MAX_WEEKS) {
    const maintenance = maintenanceNow - perKg * (currentWeight - weight);
    const deficit = maintenance - intakeKcal;

    if (deficit < MIN_MEANINGFUL_DEFICIT) {
      const stall = Math.round(weight * 10) / 10;
      return {
        weeks: null,
        date: null,
        stallWeight: stall,
        note:
          `At ${Math.round(intakeKcal)} kcal this levels off around ${stall} kg — a lighter body `
          + `costs less to run, so the deficit closes on its own. Reaching ${targetWeight} kg means `
          + `eating less later, not longer.`,
      };
    }

    weight -= (deficit * 7) / KCAL_PER_KG;
    weeks += 1;

    if (weight <= targetWeight) {
      const when = parseISO(today);
      when.setDate(when.getDate() + weeks * 7);
      const date = todayISO(when);
      return {
        weeks,
        date,
        stallWeight: null,
        note:
          `About ${weeks} week${weeks === 1 ? '' : 's'} to ${targetWeight} kg at this intake, so `
          + `around ${date}. The rate eases as you get lighter — that is expected, not a stall.`,
      };
    }
  }

  return { ...none, note: 'Too slow at this intake to put a date on.' };
}

/**
 * How long this has been going on, and whether a week off is due.
 *
 * A long unbroken deficit gets harder to hold — hunger climbs, adherence
 * slips, and most people break it badly rather than deliberately. Planning the
 * break is the difference between a maintenance week and a lost month.
 *
 * The app knows how long because it has the weight log. It does not know why
 * anyone feels how they feel, so this says what has happened and what the
 * usual next move is, and stops there.
 */
export type DeficitSpell = {
  weeks: number;
  breakDue: boolean;
  /** What to eat during a maintenance week, if it can be worked out. */
  maintenanceKcal: number | null;
  note: string;
};

/** Weeks of continuous deficit after which a planned week off is worth offering. */
export const BREAK_AFTER_WEEKS = 8;

export function deficitSpell(
  intakeLog: unknown,
  weights: unknown,
  goal: string,
  today: string = todayISO()
): DeficitSpell {
  const none: DeficitSpell = { weeks: 0, breakDue: false, maintenanceKcal: null, note: '' };
  if (goal !== 'weight_loss') return none;

  const weighed = (Array.isArray(weights) ? weights : [])
    .filter((w: any) => w && typeof w.date === 'string' && isFinite(w.weight_kg) && w.weight_kg > 0)
    .sort((a: any, b: any) => a.date.localeCompare(b.date)) as WeighIn[];
  if (weighed.length < 2) return none;

  // Net loss from the earliest logged weigh-in. Deliberately simple: a spell is
  // "you have been lighter than where you started and heading down", not an
  // attempt to detect every pause in between.
  const first = weighed[0];
  const last = weighed[weighed.length - 1];
  if (last.weight_kg >= first.weight_kg) return none;

  const days = daysBetween(first.date, last.date);
  const weeks = Math.floor(days / 7);
  if (weeks < 1) return none;

  const measured = measuredMaintenance(intakeLog, weights, 0, today);

  return {
    weeks,
    breakDue: weeks >= BREAK_AFTER_WEEKS,
    maintenanceKcal: measured.kcal,
    note:
      weeks >= BREAK_AFTER_WEEKS
        ? `${weeks} weeks of losing without a break. A week at maintenance`
          + (measured.kcal ? ` — about ${measured.kcal} kcal — ` : ' ')
          + `is the usual next move: it is easier to hold, and it is a decision rather than a slip.`
        : `${weeks} week${weeks === 1 ? '' : 's'} in.`,
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Which days you hold the plan, and which you do not.
 *
 * Everybody knows the weekend is harder. Nobody knows what it costs. Turning a
 * moral feeling into a weekly kilocalorie figure is the whole value here — it
 * is the difference between "I was bad on Saturday" and "Saturdays run me
 * 1,900 kcal a week, which is a quarter of my deficit".
 *
 * Refuses to narrate noise: a day has to be a real distance from this person's
 * own average before it gets named.
 */
export type WeekdayPattern = {
  worst: { day: string; pct: number } | null;
  best: { day: string; pct: number } | null;
  /** Weekly deviation from plan in kcal. Positive means over. */
  weeklyExcessKcal: number | null;
  note: string;
  missing: string | null;
};

/** A day has to differ from your own mean by this much before it is a pattern. */
export const PATTERN_THRESHOLD = 0.1;
const MIN_PER_WEEKDAY = 2;

export function weekdayPattern(intakeLog: unknown, today: string = todayISO()): WeekdayPattern {
  const none: WeekdayPattern = { worst: null, best: null, weeklyExcessKcal: null, note: '', missing: null };

  const rows = (Array.isArray(intakeLog) ? intakeLog : []).filter(
    (e: any) => e && typeof e.date === 'string' && isFinite(e.factor) && e.factor > 0 && isFinite(e.target_kcal) && e.target_kcal > 0
  ) as IntakeEntry[];

  if (rows.length < MIN_INTAKE_DAYS + 6) {
    return { ...none, missing: `${MIN_INTAKE_DAYS + 6 - rows.length} more answered days before a weekday pattern means anything` };
  }

  const byDay = new Map<number, number[]>();
  for (const r of rows) {
    const dow = parseISO(r.date).getDay();
    byDay.set(dow, [...(byDay.get(dow) ?? []), r.factor]);
  }

  const overall = rows.reduce((s, r) => s + r.factor, 0) / rows.length;
  const meanTarget = rows.reduce((s, r) => s + r.target_kcal, 0) / rows.length;

  // Only weekdays with enough observations get an opinion attached.
  const solid = [...byDay.entries()]
    .filter(([, fs]) => fs.length >= MIN_PER_WEEKDAY)
    .map(([dow, fs]) => ({ dow, mean: fs.reduce((s, f) => s + f, 0) / fs.length }));

  if (solid.length < 3) {
    return { ...none, missing: 'a few more weeks so each weekday has more than one answer' };
  }

  const sorted = [...solid].sort((a, b) => b.mean - a.mean);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];

  const pct = (m: number) => Math.round((m - 1) * 100);
  // The weekly figure: how far a full week drifts from the plan, in kcal.
  const weeklyExcess = Math.round(
    solid.reduce((s, day) => s + (day.mean - 1) * meanTarget, 0) * (7 / solid.length) / 10
  ) * 10;

  const spread = hi.mean - lo.mean;
  if (spread < PATTERN_THRESHOLD) {
    return {
      ...none,
      weeklyExcessKcal: weeklyExcess,
      note: 'Your days look alike — no weekday stands out from the rest. That is easier to plan around than most people manage.',
    };
  }

  const worst = { day: WEEKDAYS[hi.dow], pct: pct(hi.mean) };
  const best = { day: WEEKDAYS[lo.dow], pct: pct(lo.mean) };

  const describe = (d: { day: string; pct: number }) =>
    d.pct === 0 ? `${d.day}s land on target` : `${d.day}s run ${Math.abs(d.pct)}% ${d.pct > 0 ? 'over' : 'under'}`;

  return {
    worst,
    best,
    weeklyExcessKcal: weeklyExcess,
    note:
      `${describe(worst)}, ${describe(best).replace(/^(\w)/, (m) => m.toLowerCase())}. `
      + (weeklyExcess > 0
        ? `Across a week that is about ${weeklyExcess} kcal more than planned.`
        : weeklyExcess < 0
          ? `Across a week that is about ${Math.abs(weeklyExcess)} kcal under plan.`
          : 'Across a week it balances out.'),
    missing: null,
  };
}

// ---------------------------------------------------------------------------

/**
 * The week as a budget rather than seven separate verdicts.
 *
 * People eat in weeks. A blown Saturday stops being a failure and becomes a
 * number that changes what is left — which is the difference between carrying
 * on and giving up on a Tuesday.
 */
export type WeekBudget = {
  totalKcal: number;
  usedKcal: number;
  daysLogged: number;
  daysLeft: number;
  /** What is left per remaining day. Negative when the week is already spent. */
  perDayLeft: number;
  note: string;
};

export function weekBudget(dailyTargetKcal: number, intakeLog: unknown, today: string = todayISO()): WeekBudget | null {
  if (!isFinite(dailyTargetKcal) || dailyTargetKcal <= 0) return null;

  const now = parseISO(today);
  // Monday-anchored, matching the quota window used elsewhere in the app.
  const dowMon = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(start.getDate() - dowMon);
  const startISO = todayISO(start);

  const rows = (Array.isArray(intakeLog) ? intakeLog : []).filter(
    (e: any) => e && typeof e.date === 'string' && e.date >= startISO && e.date <= today
      && isFinite(e.factor) && isFinite(e.target_kcal)
  ) as IntakeEntry[];

  const total = Math.round(dailyTargetKcal * 7);
  const used = Math.round(rows.reduce((s, r) => s + r.factor * r.target_kcal, 0));
  const daysLogged = rows.length;
  // Today counts as remaining until it has been answered.
  const daysLeft = Math.max(0, 7 - daysLogged);
  const perDayLeft = daysLeft > 0 ? Math.round((total - used) / daysLeft / 10) * 10 : total - used;

  let note: string;
  if (daysLeft === 0) {
    note = used <= total
      ? `The week came in ${total - used} kcal under budget.`
      : `The week ran ${used - total} kcal over. Next week starts fresh.`;
  } else if (perDayLeft < 0) {
    note = `The week's budget is already spent. Nothing to make up — next week starts fresh.`;
  } else {
    note = `${used} of ${total} kcal used in ${daysLogged} day${daysLogged === 1 ? '' : 's'}. `
      + `That leaves ${perDayLeft} a day for the remaining ${daysLeft}.`;
  }

  return { totalKcal: total, usedKcal: used, daysLogged, daysLeft, perDayLeft, note };
}

// ---------------------------------------------------------------------------

/**
 * What one bigger evening actually costs, before deciding.
 *
 * Deliberately not a warning. The number sits there and the choice stays with
 * the person — an app that tells someone off gets deleted, and the honest
 * figure is more persuasive than any nudge.
 */
export type ExtraCost = { kg: number; deficitDays: number; note: string };

export function costOfExtra(extraKcal: number, dailyDeficitKcal: number): ExtraCost | null {
  if (!isFinite(extraKcal) || extraKcal <= 0) return null;
  if (!isFinite(dailyDeficitKcal) || dailyDeficitKcal <= 0) return null;

  const kg = Math.round((extraKcal / KCAL_PER_KG) * 100) / 100;
  const days = Math.round((extraKcal / dailyDeficitKcal) * 10) / 10;

  return {
    kg,
    deficitDays: days,
    note: `${Math.round(extraKcal)} kcal on top is about ${days} day${days === 1 ? '' : 's'} of your deficit — `
      + `roughly ${kg} kg of progress, pushed back by that much.`,
  };
}

/**
 * Whether the protein target was actually met, at no cost to the user.
 *
 * On one meal a day protein is the hard part — it is what falls off the plate
 * first when the day goes sideways. The app has set a protein target since the
 * beginning and never once checked it, even though the answer was already in
 * the intake log: eating the plan means eating its protein.
 *
 * No new question, no new tap. Just reading what is there.
 */
export type ProteinAdherence = { hit: number; days: number; note: string } | null;

/** A hair under counts as met; nobody eats to the gram. */
const PROTEIN_TOLERANCE = 0.95;

export function proteinAdherence(intakeLog: unknown, today: string = todayISO()): ProteinAdherence {
  const rows = withinWindow<IntakeEntry>(intakeLog, today).filter(
    (e) => isFinite(e.factor) && e.factor > 0
  );
  if (rows.length < 5) return null;

  const hit = rows.filter((r) => r.factor >= PROTEIN_TOLERANCE).length;
  const missed = rows.length - hit;

  return {
    hit,
    days: rows.length,
    note:
      missed === 0
        ? `Protein met on all ${rows.length} logged days.`
        : `Protein met on ${hit} of ${rows.length} logged days. On the other ${missed} you ate under `
          + `the plan — on one meal a day that is the part that goes first.`,
  };
}

// ---------------------------------------------------------------------------

/**
 * How many days a week this person actually trains, from their own plans.
 *
 * Not asked, because it would be another question and the answer is already in
 * the plan history: a plan carries a training start time when there was a
 * session. Ten plans is a small sample, so this is a rounded estimate and the
 * caller says so.
 */
export function trainingDaysPerWeek(planHistory: unknown): number | null {
  const plans = (Array.isArray(planHistory) ? planHistory : []).filter(
    (p: any) => p && typeof p.date === 'string'
  );
  if (plans.length < 5) return null;

  const withSession = plans.filter((p: any) => !!p.training_start_time).length;
  const days = Math.round((withSession / plans.length) * 7);
  return days > 0 && days < 7 ? days : null;
}

/**
 * The same week, distributed around training.
 *
 * More on the days there is a session to fuel, less on the days there is not,
 * with the weekly total untouched. The balance does not change; how easy the
 * week is to hold does.
 *
 * `bmrFloor` is not optional politeness — a rest day must never drop under it,
 * which is the same rule `dailyTargets` enforces.
 */
export type WeekCycle = {
  trainingKcal: number;
  restKcal: number;
  trainingDays: number;
  restDays: number;
  note: string;
} | null;

/** Most a training day may sit above the flat average. */
const MAX_SPREAD = 400;

export function cycleWeek(weeklyKcal: number, trainingDays: number, bmrFloor: number): WeekCycle {
  if (!isFinite(weeklyKcal) || weeklyKcal <= 0) return null;
  if (!Number.isInteger(trainingDays) || trainingDays <= 0 || trainingDays >= 7) return null;
  if (!isFinite(bmrFloor) || bmrFloor <= 0) return null;

  const restDays = 7 - trainingDays;
  const base = weeklyKcal / 7;
  if (base <= bmrFloor) return null;

  // Whatever is added to training days comes off the rest days, so the week is
  // unchanged by construction: training * a === rest * b.
  const maxByFloor = ((base - bmrFloor) * restDays) / trainingDays;
  const a = Math.min(MAX_SPREAD, maxByFloor);
  if (a < 50) return null;   // too small a difference to be worth the complication

  const b = (trainingDays * a) / restDays;
  const trainingKcal = Math.round((base + a) / 10) * 10;
  const restKcal = Math.round((base - b) / 10) * 10;

  return {
    trainingKcal,
    restKcal,
    trainingDays,
    restDays,
    note:
      `Same week, distributed differently: ${trainingKcal} on your ${trainingDays} training days, `
      + `${restKcal} on the other ${restDays}. The weekly total does not change.`,
  };
}

// ---------------------------------------------------------------------------

export type TrendRead = {
  kgPerWeek: number | null;
  state: 'insufficient' | 'losing' | 'gaining' | 'steady';
  /** Latest weigh-in minus the fitted line at that date. Null without a fit. */
  offTrend: number | null;
  note: string;
};

/** Below this a week's movement is not distinguishable from fluid and noise. */
export const STEADY_KG_PER_WEEK = 0.15;

/**
 * Reads the trend rather than the last number on the scale.
 *
 * This is the thing a scale cannot do. Someone weighing daily sees an 800g jump
 * and concludes a week went wrong, when the fitted line has not moved. Saying
 * so plainly is the most useful sentence this app can produce for that person.
 */
export function readTrend(weights: unknown, today: string = todayISO()): TrendRead {
  const weighed = withinWindow<WeighIn>(weights, today)
    .filter((w) => isFinite(w.weight_kg) && w.weight_kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const span = weighed.length >= 2 ? daysBetween(weighed[0].date, weighed[weighed.length - 1].date) : 0;
  const trend = weighed.length >= 2 ? weeklyTrend(weighed) : null;

  if (trend === null || span < MIN_SPAN_DAYS) {
    return {
      kgPerWeek: trend,
      state: 'insufficient',
      offTrend: null,
      note: `A direction needs weigh-ins across at least ${MIN_SPAN_DAYS} days.`,
    };
  }

  // Fitted value at the latest date: the slope comes from weeklyTrend, the
  // intercept from the means, so there is one regression in the codebase.
  const xs = weighed.map((w) => daysBetween('1970-01-01', w.date) / 7);
  const meanX = xs.reduce((s, x) => s + x, 0) / xs.length;
  const meanY = weighed.reduce((s, w) => s + w.weight_kg, 0) / weighed.length;
  const fittedLatest = meanY + trend * (xs[xs.length - 1] - meanX);
  const offTrend = Math.round((weighed[weighed.length - 1].weight_kg - fittedLatest) * 100) / 100;

  const state: TrendRead['state'] =
    Math.abs(trend) < STEADY_KG_PER_WEEK ? 'steady' : trend < 0 ? 'losing' : 'gaining';

  const kg = (n: number) => Math.abs(Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');

  let note: string;
  if (state === 'steady') {
    note = `The line has been flat for ${span} days. Weight held rather than moved.`;
  } else if (Math.abs(offTrend) >= 0.4) {
    // The message that keeps someone from quitting on a Tuesday.
    note =
      `Today reads ${kg(offTrend)} kg ${offTrend > 0 ? 'above' : 'below'} the line, which is the `
      + `size of a normal day-to-day swing. The line itself is still ${kg(trend)} kg a week `
      + `${trend < 0 ? 'down' : 'up'}.`;
  } else {
    note = `${kg(trend)} kg a week ${trend < 0 ? 'down' : 'up'} across ${span} days.`;
  }

  return { kgPerWeek: Math.round(trend * 100) / 100, state, offTrend, note };
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const TODAY = '2026-08-20';
  const day = (back: number) => {
    const d = parseISO(TODAY);
    d.setDate(d.getDate() - back);
    return todayISO(d);
  };

  // --- the known balance ---------------------------------------------------

  // 1800 kcal a day, losing 0.5 kg a week → maintenance 1800 + 0.5*1100 = 2350.
  const intake14 = Array.from({ length: 14 }, (_, i) => ({
    date: day(13 - i), factor: 1, target_kcal: 1800,
  }));
  const losing = Array.from({ length: 7 }, (_, i) => ({
    date: day(12 - i * 2), weight_kg: 85 - i * (0.5 * 2 / 7),
  }));

  const m = measuredMaintenance(intake14, losing, 2400, TODAY);
  assert(m.kcal !== null, `a fortnight of data produces a number, missing: ${m.missing}`);
  assert(Math.abs(m.kcal! - 2350) <= 40, `and it lands on the balance: ${m.kcal}`);
  assert(m.confidence === 'good', `with enough data the confidence is good: ${m.confidence}`);
  assert(m.missing === null, 'and nothing is reported missing');

  // Gaining flips the sign: eating 2600 while gaining 0.3 kg/wk means
  // maintenance is *below* intake.
  const gaining = Array.from({ length: 7 }, (_, i) => ({
    date: day(12 - i * 2), weight_kg: 85 + i * (0.3 * 2 / 7),
  }));
  const g = measuredMaintenance(
    intake14.map((e) => ({ ...e, target_kcal: 2600 })), gaining, 2600, TODAY
  );
  assert(g.kcal! < 2600, `gaining means maintenance is under intake: ${g.kcal}`);

  // --- refusing to answer --------------------------------------------------

  assert(measuredMaintenance([], [], 2400, TODAY).kcal === null, 'no data, no number');
  assert(measuredMaintenance([], [], 2400, TODAY).missing !== null, 'and it says what is missing');

  const thin = measuredMaintenance(intake14.slice(0, 3), losing, 2400, TODAY);
  assert(thin.kcal === null, 'three days of intake is not enough');
  assert(/more days/.test(thin.missing ?? ''), `it asks for days: ${thin.missing}`);

  const fewWeights = measuredMaintenance(intake14, losing.slice(0, 2), 2400, TODAY);
  assert(fewWeights.kcal === null, 'two weigh-ins is not enough');
  assert(/weigh-ins/.test(fewWeights.missing ?? ''), `it asks for weigh-ins: ${fewWeights.missing}`);

  // Plenty of weigh-ins, all crammed into three days: no span, no answer.
  const crammed = [0, 1, 2, 3, 3, 2].map((b, i) => ({ date: day(b), weight_kg: 85 - i * 0.1 }));
  const short = measuredMaintenance(intake14, crammed, 2400, TODAY);
  assert(short.kcal === null, 'weigh-ins crammed into a few days do not measure anything');
  assert(/spread over/.test(short.missing ?? ''), `it asks for spread: ${short.missing}`);

  // Data older than the window does not count.
  const stale = intake14.map((e) => ({ ...e, date: '2026-01-01' }));
  assert(measuredMaintenance(stale, losing, 2400, TODAY).kcal === null, 'stale intake is ignored');

  // --- the guards ----------------------------------------------------------

  // A wild fortnight cannot move the target more than the step allows.
  const crash = Array.from({ length: 7 }, (_, i) => ({
    date: day(12 - i * 2), weight_kg: 85 - i * 0.6,
  }));
  const bounded = measuredMaintenance(intake14, crash, 2400, TODAY);
  assert(bounded.kcal! <= 2400 * (1 + MAX_STEP) + 5, `bounded above: ${bounded.kcal}`);
  assert(bounded.kcal! >= 2400 * (1 - MAX_STEP) - 5, `bounded below: ${bounded.kcal}`);

  // Without an estimate the bound is off and the raw figure comes through.
  assert(measuredMaintenance(intake14, crash, 0, TODAY).kcal! > 2400 * (1 + MAX_STEP),
    'passing no estimate disables the bound');

  assert(measuredMaintenance(intake14, losing, 2400, TODAY).deltaToEstimate !== null, 'the gap is reported');
  assert(measuredMaintenance(intake14, losing, 0, TODAY).deltaToEstimate === null, 'and omitted without an estimate');

  // Junk must not throw or leak into the average.
  const junk = measuredMaintenance(
    [...intake14, { date: day(1), factor: NaN, target_kcal: 1800 }, null as any, 7 as any],
    losing, 2400, TODAY
  );
  assert(junk.intakeDays === 14, `junk entries are dropped: ${junk.intakeDays}`);
  assert(measuredMaintenance(null, null, 2400, TODAY).kcal === null, 'null input does not throw');

  // --- who gets the measurement --------------------------------------------

  assert(effectiveMaintenance(intake14, losing, 2400, true, TODAY) !== undefined, 'premium gets the measured figure');
  assert(effectiveMaintenance(intake14, losing, 2400, false, TODAY) === undefined, 'without premium the target does not move');
  assert(effectiveMaintenance([], [], 2400, true, TODAY) === undefined, 'and premium without data still gets nothing');

  // --- which day to ask about ----------------------------------------------

  const prof = { omad_window_start: '18:00', omad_window_hours: 2, weight_kg: 85, height_cm: 183,
    age: 34, sex: 'male', fitness_level: 'advanced', goal: 'weight_loss',
    default_training_time: '19:00' } as any;

  const at = (h: number, m = 0, dayOffset = 0) => {
    const dt = new Date(2026, 7, 20, h, m, 0);
    dt.setDate(dt.getDate() + dayOffset);
    return dt;
  };

  // Inside the window there is nothing to report yet.
  assert(intakeQuestionFor(prof, [], at(19)) === null, 'no question while still eating');

  // Just after it closes, and hours later, and next morning: same day, still asked.
  const justAfter = intakeQuestionFor(prof, [], at(20, 30));
  assert(justAfter?.date === '2026-08-20', `asked right after closing: ${justAfter?.date}`);
  assert(intakeQuestionFor(prof, [], at(23))?.date === '2026-08-20', 'still asked late that night');
  // This is the case the first version lost entirely.
  assert(intakeQuestionFor(prof, [], at(9, 0, 1))?.date === '2026-08-20',
    'and still asked next morning, about the right day');
  assert(intakeQuestionFor(prof, [], at(17, 30, 1))?.date === '2026-08-20',
    'right up until the next window opens');

  // Once answered it stops asking, and the next day is its own question.
  assert(intakeQuestionFor(prof, [{ date: '2026-08-20', factor: 1, target_kcal: 1800 }], at(9, 0, 1)) === null,
    'an answered day is not asked again');
  assert(intakeQuestionFor(prof, [{ date: '2026-08-20', factor: 1, target_kcal: 1800 }], at(21, 0, 1))?.date
    === '2026-08-21', 'the following day is asked on its own');

  // A window crossing midnight still lands on the day it opened.
  const lateProf = { ...prof, omad_window_start: '23:00', omad_window_hours: 2 };
  assert(intakeQuestionFor(lateProf, [], at(2, 0, 1))?.date === '2026-08-20',
    'a window opened before midnight belongs to that day');
  assert(intakeQuestionFor(lateProf, [], at(23, 30)) === null, 'and is not asked while still open');

  // --- the plateau ---------------------------------------------------------

  const flat14 = Array.from({ length: 8 }, (_, i) => ({ date: day(14 - i * 2), weight_kg: 85 }));
  const intakeFlat = Array.from({ length: 14 }, (_, i) => ({
    date: day(13 - i), factor: 1, target_kcal: 2100,
  }));

  const stall = readPlateau(intakeFlat, flat14, 'weight_loss', 500, TODAY);
  assert(stall.stalled, 'a fortnight of held weight is a stall');
  assert(stall.days >= 14, `and reports how long: ${stall.days}`);
  assert(stall.newTarget !== null && Math.abs(stall.newTarget - 1600) <= 40,
    `with a target that puts the deficit back: ${stall.newTarget}`);
  assert(/not your discipline/.test(stall.note), 'and says whose fault it is not');

  // Still losing is not a stall; nor is a short flat patch.
  assert(!readPlateau(intake14, losing, 'weight_loss', 500, TODAY).stalled, 'losing weight is not a stall');
  const shortFlat = Array.from({ length: 4 }, (_, i) => ({ date: day(6 - i * 2), weight_kg: 85 }));
  assert(!readPlateau(intakeFlat, shortFlat, 'weight_loss', 500, TODAY).stalled, 'a week flat is not a plateau');

  // Muscle gain is a different conversation entirely.
  assert(!readPlateau(intakeFlat, flat14, 'muscle_gain', 500, TODAY).stalled, 'gaining is not judged here');

  // Stalled but unmeasurable: say so, do not invent a target.
  const noIntake = readPlateau([], flat14, 'weight_loss', 500, TODAY);
  assert(noIntake.stalled && noIntake.newTarget === null, 'a stall without intake data gives no number');
  assert(/would let the app say/.test(noIntake.note), 'and explains what is missing');

  // Same wording discipline as everywhere else.
  for (const note of [stall.note, noIntake.note]) {
    assert(!/cure|prevent|detox|proven|guarantee/i.test(note), 'no health claim in a plateau note');
    assert(!/\bstudies\b|%/.test(note), 'no invented statistic in a plateau note');
  }

  // --- how long this has been going on -------------------------------------

  // Eleven entries so the span really is sixty days, not fifty-four.
  const eightWeeks = Array.from({ length: 11 }, (_, i) => ({
    date: day(60 - i * 6), weight_kg: 90 - i * 0.5,
  }));
  const spell = deficitSpell(intake14, eightWeeks, 'weight_loss', TODAY);
  assert(spell.weeks >= 8, `a long run is counted: ${spell.weeks}`);
  assert(spell.breakDue, 'and a break is offered after eight weeks');
  assert(/decision rather than a slip/.test(spell.note), 'framed as a plan, not a failure');

  const twoWeeks = [{ date: day(14), weight_kg: 86 }, { date: day(0), weight_kg: 85 }];
  assert(!deficitSpell(intake14, twoWeeks, 'weight_loss', TODAY).breakDue, 'two weeks is not a long run');
  assert(!deficitSpell(intake14, eightWeeks, 'muscle_gain', TODAY).breakDue, 'gaining is not a deficit spell');
  assert(deficitSpell(intake14, [], 'weight_loss', TODAY).weeks === 0, 'no weigh-ins, no spell');
  const gainingRun = [{ date: day(60), weight_kg: 85 }, { date: day(0), weight_kg: 88 }];
  assert(deficitSpell(intake14, gainingRun, 'weight_loss', TODAY).weeks === 0, 'putting weight on is not a deficit');

  // --- the forecast --------------------------------------------------------

  const fProf = { weight_kg: 95, height_cm: 183, age: 34, sex: 'male',
    fitness_level: 'advanced', goal: 'weight_loss', omad_window_start: '18:00',
    omad_window_hours: 2, default_training_time: '19:00' } as any;

  // A real deficit reaches the target, and later than a naive division would say.
  const reach = forecast(fProf, 95, 85, 2600, 2100, TODAY);
  assert(reach.weeks !== null, `a genuine deficit produces a date: ${reach.note}`);
  const naiveWeeks = (95 - 85) / (((2600 - 2100) * 7) / KCAL_PER_KG);
  assert(reach.weeks! > naiveWeeks, `and it is later than the naive figure (${reach.weeks} vs ${naiveWeeks.toFixed(1)})`);
  assert(reach.date !== null && reach.date! > TODAY, 'the date lies in the future');
  assert(reach.stallWeight === null, 'nothing stalls when the target is reached');

  // The sentence that matters: too little deficit levels off short of the goal.
  const levels = forecast(fProf, 95, 70, 2600, 2450, TODAY);
  assert(levels.weeks === null, 'a thin deficit never reaches a distant target');
  assert(levels.stallWeight !== null, `and reports where it levels off: ${levels.stallWeight}`);
  assert(levels.stallWeight! > 70 && levels.stallWeight! < 95, `between here and there: ${levels.stallWeight}`);
  assert(/eating less later, not longer/.test(levels.note), 'and says what to do about it');

  // Eating at or above maintenance goes nowhere at all.
  assert(forecast(fProf, 95, 85, 2600, 2600, TODAY).stallWeight === 95, 'no deficit, no movement');
  assert(forecast(fProf, 95, 85, 2600, 3000, TODAY).stallWeight === 95, 'a surplus does not lose weight');

  // Nonsense in, nothing out.
  assert(forecast(fProf, 95, 100, 2600, 2100, TODAY).weeks === null, 'a target above current weight is not a forecast');
  assert(forecast(fProf, 95, 95, 2600, 2100, TODAY).weeks === null, 'nor is standing still');
  for (const bad of [0, -1, NaN, Infinity]) {
    assert(forecast(fProf, bad, 85, 2600, 2100, TODAY).weeks === null, `bad weight rejected: ${bad}`);
    assert(forecast(fProf, 95, 85, bad, 2100, TODAY).weeks === null, `bad maintenance rejected: ${bad}`);
  }

  // Same wording discipline.
  for (const note of [reach.note, levels.note]) {
    assert(!/cure|prevent|detox|proven|guarantee/i.test(note), 'no health claim in a forecast');
    assert(!/\bstudies\b|%/.test(note), 'no invented statistic in a forecast');
  }

  // --- the weekday pattern -------------------------------------------------

  // Four weeks, Saturdays 30% over, everything else on plan.
  const withSaturdays = Array.from({ length: 28 }, (_, i) => {
    const date = day(27 - i);
    const isSat = parseISO(date).getDay() === 6;
    return { date, factor: isSat ? 1.3 : 1, target_kcal: 2000 };
  });
  const pat = weekdayPattern(withSaturdays, TODAY);
  assert(pat.worst?.day === 'Saturday', `the loud day is found: ${JSON.stringify(pat.worst)}`);
  assert(pat.worst!.pct === 30, `with its size: ${pat.worst!.pct}`);
  assert(pat.weeklyExcessKcal! > 400, `and the weekly cost is stated: ${pat.weeklyExcessKcal}`);
  assert(/Saturdays run 30% over/.test(pat.note), `named in the note: ${pat.note}`);
  assert(pat.missing === null, 'nothing is missing once there is enough');

  // Even days must not be turned into a story.
  const even = Array.from({ length: 28 }, (_, i) => ({ date: day(27 - i), factor: 1, target_kcal: 2000 }));
  const flatPat = weekdayPattern(even, TODAY);
  assert(flatPat.worst === null, 'an even week produces no villain');
  assert(/look alike/.test(flatPat.note), `and says so plainly: ${flatPat.note}`);

  // Too little, and it says what is missing rather than guessing.
  assert(weekdayPattern(withSaturdays.slice(0, 5), TODAY).worst === null, 'five days is not a pattern');
  assert(weekdayPattern(withSaturdays.slice(0, 5), TODAY).missing !== null, 'and it asks for more');
  assert(weekdayPattern([], TODAY).missing !== null, 'nothing logged, nothing claimed');
  assert(weekdayPattern(null, TODAY).worst === null, 'null does not throw');

  for (const n of [pat.note, flatPat.note]) {
    assert(!/should|must|cure|prevent|detox|proven/i.test(n), `no scolding or health claim: ${n}`);
    assert(!/\bstudies\b/i.test(n), 'no invented research');
  }

  // --- the weekly budget ---------------------------------------------------

  const monday = '2026-08-17';   // a Monday
  const thursday = '2026-08-20';
  const fourDays = [0, 1, 2, 3].map((i) => {
    const dt = parseISO(monday); dt.setDate(dt.getDate() + i);
    return { date: todayISO(dt), factor: i === 2 ? 1.6 : 1, target_kcal: 1850 };
  });

  const wb = weekBudget(1850, fourDays, thursday)!;
  assert(wb.totalKcal === 12950, `the week is seven days of target: ${wb.totalKcal}`);
  assert(wb.daysLogged === 4, `four days counted: ${wb.daysLogged}`);
  assert(wb.daysLeft === 3, `three left: ${wb.daysLeft}`);
  assert(wb.perDayLeft > 0 && wb.perDayLeft < 1850, `and the rest is tighter: ${wb.perDayLeft}`);
  assert(/of 12950 kcal used/.test(wb.note), `the note carries the arithmetic: ${wb.note}`);

  // A blown week is stated, not clamped to zero and hidden.
  const blown = [0, 1, 2, 3].map((i) => {
    const dt = parseISO(monday); dt.setDate(dt.getDate() + i);
    return { date: todayISO(dt), factor: 2.5, target_kcal: 1850 };
  });
  const over = weekBudget(1850, blown, thursday)!;
  assert(over.perDayLeft < 0, `an overspent week shows a negative remainder: ${over.perDayLeft}`);
  assert(/already spent/.test(over.note), 'and says so without a lecture');
  assert(!/should|failed|bad/i.test(over.note), `no blame: ${over.note}`);

  assert(weekBudget(1850, [], monday)!.daysLeft === 7, 'an untouched week has seven days left');
  assert(weekBudget(0, fourDays, thursday) === null, 'no target, no budget');
  assert(weekBudget(1850, null, thursday)!.usedKcal === 0, 'a missing log means nothing used');
  // Last week's entries must not count against this week.
  const lastWeek = [{ date: '2026-08-10', factor: 3, target_kcal: 1850 }];
  assert(weekBudget(1850, lastWeek, thursday)!.usedKcal === 0, 'earlier weeks are out of scope');

  // --- what one evening costs ----------------------------------------------

  const cost = costOfExtra(770, 500)!;
  assert(cost.kg === 0.1, `770 kcal is a tenth of a kilo: ${cost.kg}`);
  assert(cost.deficitDays === 1.5, `and one and a half days of deficit: ${cost.deficitDays}`);
  assert(/pushed back/.test(cost.note), 'stated as a delay, not a verdict');
  assert(!/should|shouldn|avoid|careful/i.test(cost.note), `and without a warning: ${cost.note}`);
  // Consistent with the constant the rest of the module uses.
  assert(Math.abs(costOfExtra(KCAL_PER_KG, 500)!.kg - 1) < 0.001, 'a kilogram is a kilogram');

  assert(costOfExtra(0, 500) === null, 'nothing extra costs nothing');
  assert(costOfExtra(500, 0) === null, 'without a deficit there is no delay to state');
  assert(costOfExtra(NaN, 500) === null, 'nonsense in, nothing out');

  // --- protein, for free ---------------------------------------------------

  const mixed = [
    ...Array.from({ length: 18 }, (_, i) => ({ date: day(20 - i), factor: 1, target_kcal: 2000 })),
    ...Array.from({ length: 3 }, (_, i) => ({ date: day(i), factor: 0.7, target_kcal: 2000 })),
  ];
  const prot = proteinAdherence(mixed, TODAY)!;
  assert(prot.hit === 18 && prot.days === 21, `counted, not estimated: ${prot.hit}/${prot.days}`);
  assert(/goes first/.test(prot.note), 'and it says why that matters on one meal a day');

  const allHit = proteinAdherence(
    Array.from({ length: 10 }, (_, i) => ({ date: day(i), factor: 1, target_kcal: 2000 })), TODAY
  )!;
  assert(allHit.hit === allHit.days, 'a clean run reads as clean');
  assert(/all 10/.test(allHit.note), `and is phrased as such: ${allHit.note}`);

  // Eating more than the plan still means the protein was there.
  assert(proteinAdherence(
    Array.from({ length: 6 }, (_, i) => ({ date: day(i), factor: 1.4, target_kcal: 2000 })), TODAY
  )!.hit === 6, 'eating over the plan still meets the protein');

  assert(proteinAdherence([], TODAY) === null, 'too little data gives nothing, not a zero');
  assert(proteinAdherence(null, TODAY) === null, 'null does not throw');

  // --- how often they train, from their own plans --------------------------

  const plans = (sessions: boolean[]) =>
    sessions.map((s, i) => ({ date: day(i), training_start_time: s ? '19:00' : null }));

  assert(trainingDaysPerWeek(plans([true, true, true, false, false, false, false])) === 3,
    `three of seven reads as three: ${trainingDaysPerWeek(plans([true, true, true, false, false, false, false]))}`);
  assert(trainingDaysPerWeek(plans(Array(10).fill(false))) === null, 'no sessions, no cycle to offer');
  assert(trainingDaysPerWeek(plans(Array(10).fill(true))) === null, 'training every day is not a cycle either');
  assert(trainingDaysPerWeek(plans([true, false])) === null, 'two plans is too small a sample');
  assert(trainingDaysPerWeek(null) === null, 'null does not throw');

  // --- the training-day cycle ----------------------------------------------

  const cyc = cycleWeek(1900 * 7, 3, 1700)!;
  assert(cyc.trainingKcal > cyc.restKcal, 'training days get more');
  const total = cyc.trainingKcal * 3 + cyc.restKcal * 4;
  assert(Math.abs(total - 1900 * 7) < 80, `and the week still adds up: ${total} vs ${1900 * 7}`);
  assert(cyc.restKcal >= 1700, `rest days never go under the floor: ${cyc.restKcal}`);
  assert(/does not change/.test(cyc.note), 'and the note says the total is untouched');

  // The floor binds when there is little room, rather than being ignored.
  const tight = cycleWeek(1800 * 7, 3, 1750);
  assert(tight === null || tight.restKcal >= 1750, `the floor holds even when tight: ${JSON.stringify(tight)}`);

  assert(cycleWeek(1900 * 7, 0, 1700) === null, 'no training days, nothing to redistribute');
  assert(cycleWeek(1900 * 7, 7, 1700) === null, 'every day a training day is the same as none');
  assert(cycleWeek(0, 3, 1700) === null, 'no week, no cycle');
  assert(cycleWeek(1900 * 7, 2.5 as any, 1700) === null, 'half a training day is not a thing');
  assert(cycleWeek(1750 * 7, 3, 1800) === null, 'a week already at the floor cannot be cycled');

  for (const n of [prot.note, cyc.note]) {
    assert(!/cure|prevent|detox|proven|should/i.test(n), `no claim or scolding: ${n}`);
    assert(!/\bstudies\b|%/.test(n), 'no invented statistic');
  }

  // --- reading the trend ---------------------------------------------------

  const t = readTrend(losing, TODAY);
  assert(t.state === 'losing', `a real loss reads as losing: ${t.state}`);
  assert(t.kgPerWeek! < 0, 'with a negative rate');

  const flat = Array.from({ length: 7 }, (_, i) => ({ date: day(12 - i * 2), weight_kg: 85 }));
  assert(readTrend(flat, TODAY).state === 'steady', 'a flat line is steady, not losing');
  assert(/flat/.test(readTrend(flat, TODAY).note), 'and says so');

  assert(readTrend([], TODAY).state === 'insufficient', 'no weigh-ins, no direction');
  assert(readTrend(losing.slice(0, 2), TODAY).state === 'insufficient', 'two nearby points are not a trend');

  // The message that matters: a jump against a falling line is called what it is.
  const spike = [...losing.slice(0, 6), { date: day(0), weight_kg: 85 }];
  const r = readTrend(spike, TODAY);
  assert(r.offTrend !== null && r.offTrend > 0.4, `the spike is measured against the line: ${r.offTrend}`);
  assert(r.state === 'losing', 'and the line is still falling');
  assert(/still/.test(r.note), `the note reassures rather than alarms: ${r.note}`);

  // Same wording discipline as the rest of the app.
  for (const note of [t.note, readTrend(flat, TODAY).note, r.note, readTrend([], TODAY).note]) {
    assert(!/cure|prevent|detox|proven|guarantee|burn fat/i.test(note), 'no health claim in a trend note');
    assert(!/\bstudies\b|%/.test(note), 'no invented statistic in a trend note');
  }

  return 'energy.ts: all checks passed';
}
