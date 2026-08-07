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
/**
 * How far off the measurement is, counted across all three of its conditions.
 *
 * `measuredMaintenance` refuses until intake days, weigh-ins and the span
 * between weigh-ins are all satisfied, and it names whichever it hits first.
 * That is right for a refusal and wrong for an instruction: `weeklyDecision`
 * asked only for intake days, so after the eighth evening it moved on to
 * "carry on" while the measurement was still impossible for want of weigh-ins.
 * Somebody could follow the app exactly and never get the thing they were
 * promised — and nothing anywhere asked them to weigh.
 *
 * `need` names the condition that is furthest from done, not the first one in
 * the list. Asking for an eighth evening while two weigh-ins are missing sends
 * someone at the wrong task.
 */
export type Readiness = {
  ready: boolean;
  intakeDays: number;
  weighIns: number;
  /** Days between the first and last weigh-in in the window. */
  spanDays: number;
  need: 'intake' | 'weighins' | 'span' | null;
  /** Everything that is still short, as one countable sentence. */
  note: string;
};

export function readiness(
  intakeLog: unknown,
  weights: unknown,
  today: string = todayISO()
): Readiness {
  const intake = withinWindow<IntakeEntry>(intakeLog, today).filter(
    (e) => isFinite(e.factor) && e.factor > 0 && isFinite(e.target_kcal) && e.target_kcal > 0
  );
  const weighed = withinWindow<WeighIn>(weights, today)
    .filter((w) => isFinite(w.weight_kg) && w.weight_kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const intakeDays = intake.length;
  const weighIns = weighed.length;
  const spanDays = weighIns >= 2 ? daysBetween(weighed[0].date, weighed[weighIns - 1].date) : 0;

  const short = {
    intake: Math.max(0, MIN_INTAKE_DAYS - intakeDays),
    weighins: Math.max(0, MIN_WEIGH_INS - weighIns),
    span: Math.max(0, MIN_SPAN_DAYS - spanDays),
  };

  if (short.intake === 0 && short.weighins === 0 && short.span === 0) {
    return {
      ready: true, intakeDays, weighIns, spanDays, need: null,
      note: `${intakeDays} evenings and ${weighIns} weigh-ins across ${spanDays} days.`,
    };
  }

  // Furthest from done wins. The span is measured in days rather than entries,
  // so it is scaled against its own threshold to be comparable at all.
  const distance = {
    intake: short.intake / MIN_INTAKE_DAYS,
    weighins: short.weighins / MIN_WEIGH_INS,
    span: short.span / MIN_SPAN_DAYS,
  };
  const need = (Object.keys(distance) as (keyof typeof distance)[])
    .sort((a, b) => distance[b] - distance[a])[0] as Readiness['need'];

  // Capped at the threshold: someone with ten evenings and one weigh-in was
  // being told "10 of 8 evenings", which reads as a mistake and undersells the
  // part they have finished.
  const of = (have: number, want: number) => `${Math.min(have, want)} of ${want}`;

  return {
    ready: false, intakeDays, weighIns, spanDays, need,
    note: `${of(intakeDays, MIN_INTAKE_DAYS)} evenings · ${of(weighIns, MIN_WEIGH_INS)} weigh-ins `
      + `across ${of(spanDays, MIN_SPAN_DAYS)} days`,
  };
}

// ---------------------------------------------------------------------------

/**
 * Whether the app should say, once, that the measurement has arrived.
 *
 * Two weeks of answering evenings and stepping on a scale end with a number
 * appearing on a tab nobody was told to open. The moment the whole product
 * works towards happened in silence.
 *
 * True exactly once: there has to be a figure, and it must not have been
 * announced before. A flag with no measurement is not a reason to interrupt
 * anyone, and a measurement that was already announced is not news.
 */
export function shouldAnnounceMeasurement(
  measured: Measurement | null | undefined,
  alreadyAnnounced: boolean
): boolean {
  return !alreadyAnnounced && !!measured && measured.kcal !== null;
}

// ---------------------------------------------------------------------------

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
  /**
   * Whether the weight held or climbed. Both mean the same arithmetic — intake
   * has met or passed maintenance — and the app was silent on the second one:
   * `weeklyDecision` fell through to "Carry on. Nothing to change this week."
   * while the trend line under it read "0.3 kg a week up".
   */
  direction: 'held' | 'rising';
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
  const none: PlateauRead = { stalled: false, direction: 'held', days: 0, newTarget: null, note: '' };
  if (goal !== 'weight_loss') return none;

  const trend = readTrend(weights, today);
  // Losing is the plan working. Holding and climbing are the same finding told
  // with different words, and only one of them used to be told at all.
  if (trend.state !== 'steady' && trend.state !== 'gaining') return none;
  const direction: PlateauRead['direction'] = trend.state === 'gaining' ? 'rising' : 'held';
  const what = direction === 'rising'
    ? `Weight has risen for ${'{days}'} days`
    : `Weight has held for ${'{days}'} days`;

  const weighed = withinWindow<WeighIn>(weights, today).sort((a, b) => a.date.localeCompare(b.date));
  const days = weighed.length >= 2 ? daysBetween(weighed[0].date, weighed[weighed.length - 1].date) : 0;
  if (days < PLATEAU_DAYS) return none;

  // A flat trend means intake and maintenance have met, so the measurement is
  // at its most trustworthy here — no estimate needed to bound it.
  const measured = measuredMaintenance(intakeLog, weights, 0, today);
  const opening = what.replace('{days}', String(days));

  if (measured.kcal === null) {
    return {
      stalled: true,
      direction,
      days,
      newTarget: null,
      note: `${opening}. That usually means maintenance has moved rather than that anything went `
        + `wrong — ${measured.missing} would let the app say by how much.`,
    };
  }

  const newTarget = Math.round((measured.kcal - Math.abs(deficitKcal)) / 10) * 10;
  return {
    stalled: true,
    direction,
    days,
    newTarget,
    note: `${opening} while you ate about ${measured.kcal} kcal. That is what maintenance costs `
      + `now — the number moved, not your discipline. Eating ${newTarget} puts the deficit back.`,
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
 * The one thing this app can do before a day rather than after it.
 *
 * Everything else here reads back: what you ate, what it cost, what your body
 * turned out to need. But nobody plans a wedding retrospectively. You know
 * Saturday will run over, and the useful answer is what the other days become
 * if you want the week to still land — not a verdict on Sunday morning.
 *
 * Two answers, no recommendation. Either the week absorbs it, or it does not
 * and the honest figure is what the evening costs. Which of those someone
 * picks is not the app's business — the same stance `costOfExtra` already
 * takes, and the reason it says a number instead of a warning.
 */
export type DayPlan = {
  /** The exception day itself. */
  date: string;
  extraKcal: number;
  /** What the other unanswered days become, or null when the week cannot take it. */
  perDayKcal: number | null;
  /** Days the redistribution is spread across, excluding the exception day. */
  daysAdjusted: number;
  /** Set only when perDayKcal is null: what the evening costs if left standing. */
  cost: ExtraCost | null;
  note: string;
};

/**
 * @param bmrFloor The lowest daily figure worth naming. Same floor as
 * `cycleWeek` uses — a plan that reads below resting expenditure is not a plan.
 */
export function planAhead(
  dailyTargetKcal: number,
  intakeLog: unknown,
  extraKcal: number,
  whenISO: string,
  bmrFloor: number,
  today: string = todayISO()
): DayPlan | null {
  if (!isFinite(extraKcal) || extraKcal <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(whenISO)) return null;

  const budget = weekBudget(dailyTargetKcal, intakeLog, today);
  if (!budget) return null;

  // Only the days still ahead can be planned. Yesterday is a record, and a day
  // after Sunday belongs to a week whose budget has not started.
  const week = weekDates(today);
  if (!week.includes(whenISO) || whenISO <= today) return null;

  // Not `budget.daysLeft` — that counts every unanswered day in the week,
  // including ones already gone. Asked on a Saturday it says seven, and only
  // one of those can still be eaten differently. Redistribution can only touch
  // days that are both ahead and unanswered, and never the exception day
  // itself, which is the one absorbing.
  const answered = new Set(
    (Array.isArray(intakeLog) ? intakeLog : [])
      .map((e: any) => (e && typeof e.date === 'string' ? e.date : null))
      .filter(Boolean) as string[]
  );
  const adjustable = week.filter((d) => d > today && d !== whenISO && !answered.has(d));
  const daysAdjusted = adjustable.length;

  // Today and any earlier day still unanswered are eaten but not plannable, so
  // they hold their share of the budget rather than freeing it. Assuming the
  // target for them is the only figure that is not invented — it is what the
  // app asked for on those days.
  const untouchable = week.filter(
    (d) => d <= today && !answered.has(d) && d !== whenISO
  ).length;
  const remaining =
    budget.totalKcal - budget.usedKcal - Math.round(untouchable * dailyTargetKcal);

  const cost = costOfExtra(extraKcal, Math.max(1, Math.round(dailyTargetKcal * 0.25)));

  if (daysAdjusted <= 0) {
    return {
      date: whenISO, extraKcal, perDayKcal: null, daysAdjusted: 0, cost,
      note: `${whenISO} is the last day of the week, so there is nothing left to spread it over. `
        + (cost ? cost.note : 'It stands as it is.'),
    };
  }

  // What the exception day itself is expected to be: the target plus the extra.
  const exceptionKcal = Math.round(dailyTargetKcal + extraKcal);
  const perDay = Math.round((remaining - exceptionKcal) / daysAdjusted / 10) * 10;

  if (perDay < bmrFloor) {
    return {
      date: whenISO, extraKcal, perDayKcal: null, daysAdjusted, cost,
      note: `Spreading that across the rest of the week would leave under ${bmrFloor} kcal a day, `
        + `which is below what your body uses at rest. ` + (cost ? cost.note : ''),
    };
  }

  return {
    date: whenISO, extraKcal, perDayKcal: perDay, daysAdjusted, cost: null,
    note: `${perDay} kcal on the other ${daysAdjusted} day${daysAdjusted === 1 ? '' : 's'} `
      + `and the week still lands where it was going to.`,
  };
}

/**
 * The days left in this week that a big day could fall on.
 *
 * Not derived from `intakeWeek`, which looks seven days backwards — the strip
 * and the planner disagree about which direction a week runs, and reusing one
 * for the other produced a card that could never appear.
 */
export function daysAheadThisWeek(today: string = todayISO()): { date: string; label: string }[] {
  return weekDates(today)
    .filter((d) => d > today)
    .map((date) => ({
      date,
      label: parseISO(date).toLocaleDateString(undefined, { weekday: 'narrow' }),
    }));
}

/** The seven dates of the Monday-anchored week `today` falls in. */
function weekDates(today: string): string[] {
  const now = parseISO(today);
  const start = new Date(now);
  start.setDate(start.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return todayISO(d);
  });
}

// ---------------------------------------------------------------------------

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

/**
 * The same person, months apart.
 *
 * "Why is it getting harder" is the question of the third month, and it has a
 * real answer that nobody shows: a lighter body costs less, so the same plate
 * is a smaller deficit than it was. Reading it out of this person's own log
 * turns a discouraging feeling into arithmetic they can act on.
 *
 * The comparison is only drawn where both months carry enough data. A month
 * that is thin gets skipped rather than estimated — half a month compared
 * against a full one would produce a confident, wrong sentence.
 */
export type MonthStat = {
  month: string;
  avgIntake: number;
  kgChange: number;
  maintenance: number;
};

export type MonthlyComparison = {
  first: MonthStat;
  last: MonthStat;
  maintenanceDrop: number;
  kgLighter: number;
  note: string;
} | null;

const MONTH_MIN_INTAKE = 10;
const MONTH_MIN_WEIGHTS = 4;

export function monthlyComparison(intakeLog: unknown, weights: unknown): MonthlyComparison {
  const intake = (Array.isArray(intakeLog) ? intakeLog : []).filter(
    (e: any) => e && typeof e.date === 'string' && isFinite(e.factor) && isFinite(e.target_kcal)
  ) as IntakeEntry[];
  const weighed = (Array.isArray(weights) ? weights : []).filter(
    (w: any) => w && typeof w.date === 'string' && isFinite(w.weight_kg) && w.weight_kg > 0
  ).sort((a: any, b: any) => a.date.localeCompare(b.date)) as WeighIn[];

  const months = new Set([...intake, ...weighed].map((r) => r.date.slice(0, 7)));

  const stats: MonthStat[] = [];
  for (const month of [...months].sort()) {
    const mi = intake.filter((e) => e.date.startsWith(month));
    const mw = weighed.filter((w) => w.date.startsWith(month));
    if (mi.length < MONTH_MIN_INTAKE || mw.length < MONTH_MIN_WEIGHTS) continue;

    const avgIntake = Math.round(mi.reduce((s, e) => s + e.factor * e.target_kcal, 0) / mi.length);
    const kgChange = Math.round((mw[mw.length - 1].weight_kg - mw[0].weight_kg) * 10) / 10;

    // Same energy balance as everywhere else, over the month's own span.
    const spanDays = Math.max(1, daysBetween(mw[0].date, mw[mw.length - 1].date));
    const perWeek = (kgChange / spanDays) * 7;
    const maintenance = Math.round((avgIntake - perWeek * (KCAL_PER_KG / 7)) / 10) * 10;

    stats.push({ month, avgIntake, kgChange, maintenance });
  }

  if (stats.length < 2) return null;

  const first = stats[0];
  const last = stats[stats.length - 1];
  const kgLighter =
    Math.round((weighed[0].weight_kg - weighed[weighed.length - 1].weight_kg) * 10) / 10;
  const drop = first.maintenance - last.maintenance;

  const line = (s: MonthStat) =>
    `${s.month}: ${s.kgChange <= 0 ? '' : '+'}${s.kgChange} kg at ${s.avgIntake} kcal a day`;

  return {
    first,
    last,
    maintenanceDrop: drop,
    kgLighter,
    note:
      `${line(first)}. ${line(last)}. `
      + (drop > 0
        ? `Your maintenance is about ${drop} kcal lower than it was — ${kgLighter} kg lighter costs `
          + `less to run, which is why the same plate goes less far.`
        : drop < 0
          ? `Your maintenance reads about ${Math.abs(drop)} kcal higher than it did.`
          : 'Your maintenance has not moved between them.'),
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
/**
 * Drops the days somebody marked as not worth comparing.
 *
 * Where this is applied is the whole design, and the line is not negotiable:
 *
 * - **Yes** to the readings that narrate — `bestWeeks`, `monthlyComparison`,
 *   `weekdayPattern`. Comparing a flu week against a normal one answers a
 *   question nobody asked.
 * - **Never** to `measuredMaintenance`. The energy balance is physics: the food
 *   was eaten whether or not the week was unusual. If days could be excluded
 *   from the measurement, anyone could mark their way to a flattering number,
 *   and the one figure people pay for would be worth nothing.
 *
 * A filter rather than a parameter on five signatures, so the decision is made
 * once at each call site and is visible there.
 */
export function withoutOutliers(log: unknown, outliers: unknown): unknown[] {
  const rows = Array.isArray(log) ? log : [];
  const skip = new Set(
    (Array.isArray(outliers) ? outliers : []).filter((d): d is string => typeof d === 'string')
  );
  if (skip.size === 0) return rows;
  return rows.filter((r: any) => !(r && typeof r.date === 'string' && skip.has(r.date)));
}

// ---------------------------------------------------------------------------

/**
 * Why the scale is suddenly higher, answered with arithmetic.
 *
 * The day someone quits is the day the scale jumps. Nobody reads a trend line
 * in that moment, and every reassuring app says some version of "don't worry,
 * it's water" — which is a claim about a body it has not looked at.
 *
 * The strong half of the answer needs no physiology at all, only the constant
 * this module already uses everywhere: a kilogram of fat is about 7,700 kcal,
 * so 1.5 kg of it in two days would have taken roughly 11,550 kcal on top of
 * maintenance. That is not an opinion, and it rules out the thing people are
 * actually afraid of. Only after that is the likely mechanism named, hedged the
 * same way the fasting stages are.
 *
 * Deliberately silent on a drop. It would be just as true, but nobody quits
 * over losing weight quickly, and a card that appears at every weigh-in is a
 * card nobody reads.
 */
export const JUMP_KG = 0.8;
export const JUMP_WINDOW_DAYS = 3;

export type ScaleJump = {
  kg: number;
  days: number;
  /** What that much fat would have cost, as a surplus over maintenance. */
  impossibleKcal: number;
  /** Whether a bigger day was actually logged in between. */
  bigDayLogged: boolean;
  note: string;
};

export function scaleJump(
  weights: unknown,
  intakeLog: unknown,
  today: string = todayISO()
): ScaleJump | null {
  const weighed = (Array.isArray(weights) ? weights : [])
    .filter((w: any) => w && typeof w.date === 'string' && isFinite(w.weight_kg) && w.weight_kg > 0
      && w.date <= today)
    .sort((a: any, b: any) => a.date.localeCompare(b.date)) as WeighIn[];

  if (weighed.length < 2) return null;

  const latest = weighed[weighed.length - 1];
  // The one before it, and it has to be a different day — two entries for the
  // same morning are a correction, not a jump.
  const prev = [...weighed].reverse().find((w) => w.date < latest.date);
  if (!prev) return null;

  const days = daysBetween(prev.date, latest.date);
  if (days > JUMP_WINDOW_DAYS) return null;

  const kg = Math.round((latest.weight_kg - prev.weight_kg) * 10) / 10;
  if (kg < JUMP_KG) return null;

  const impossibleKcal = Math.round(kg * KCAL_PER_KG);

  // Did they log a bigger day in the span? It changes which sentence is true,
  // not whether the arithmetic holds.
  const bigDayLogged = (Array.isArray(intakeLog) ? intakeLog : []).some(
    (e: any) => e && typeof e.date === 'string' && e.date > prev.date && e.date <= latest.date
      && isFinite(e.factor) && e.factor > 1
  );

  const span = days === 1 ? 'since yesterday' : `in ${days} days`;
  const note =
    `You are ${kg} kg heavier ${span}. Gaining that as fat would have taken about `
    + `${impossibleKcal.toLocaleString('en-US')} kcal on top of what your body uses, `
    + `${bigDayLogged ? 'and the day you logged was nowhere near that' : 'which is more than a few days holds'}. `
    + `A larger carbohydrate and salt intake holds water, and that is the part that leaves again. `
    + `The trend across weeks is the reading that means something.`;

  return { kg, days, impossibleKcal, bigDayLogged, note };
}

// ---------------------------------------------------------------------------

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

  // --- a line that turned upward -------------------------------------------

  {
    const d = (i: number) => `2026-04-${String(i + 1).padStart(2, '0')}`;
    const NOW = d(27);
    const eating = Array.from({ length: 14 }, (_, i) => ({
      date: d(13 + i), factor: 1, target_kcal: 2600,
    }));
    // Four weeks climbing steadily. The app used to answer this with
    // "Carry on. Nothing to change this week."
    const rising = Array.from({ length: 8 }, (_, i) => ({
      date: d(i * 3), weight_kg: Math.round((88 + i * 0.13) * 10) / 10,
    }));

    const up = readPlateau(eating, rising, 'weight_loss', 500, NOW);
    assert(up.stalled, 'a rising line is a finding, not silence');
    assert(up.direction === 'rising', `and it is named as rising: ${up.direction}`);
    assert(/risen/.test(up.note), `the sentence says so: ${up.note}`);
    assert(!/held/.test(up.note), 'and does not call a climb a hold');
    if (up.newTarget !== null) {
      assert(up.newTarget < 2600, `the new target is under what was eaten: ${up.newTarget}`);
    }
    // Same rules as everywhere else: state it, do not scold.
    assert(!/should|must|too much|slipped|failed|discipline problem/i.test(up.note),
      `no telling anyone off: ${up.note}`);

    // Losing is the plan working, and still produces nothing.
    const falling = Array.from({ length: 8 }, (_, i) => ({
      date: d(i * 3), weight_kg: Math.round((88 - i * 0.2) * 10) / 10,
    }));
    assert(!readPlateau(eating, falling, 'weight_loss', 500, NOW).stalled,
      'losing weight is not a problem to report');

    // A flat line still reads as a hold, unchanged.
    const flat = Array.from({ length: 8 }, (_, i) => ({ date: d(i * 3), weight_kg: 88 }));
    const held = readPlateau(eating, flat, 'weight_loss', 500, NOW);
    assert(held.stalled && held.direction === 'held', 'a flat line is still a hold');
    assert(/held/.test(held.note), `with the old wording intact: ${held.note}`);

    // Not for someone who is not trying to lose.
    assert(!readPlateau(eating, rising, 'muscle_gain', 500, NOW).stalled,
      'gaining on a muscle-gain goal is the plan, not a finding');
  }

  // --- announcing the measurement once -------------------------------------

  {
    const withFigure = { kcal: 2480 } as Measurement;
    const without = { kcal: null } as Measurement;

    assert(shouldAnnounceMeasurement(withFigure, false), 'a first figure is worth saying once');
    assert(!shouldAnnounceMeasurement(withFigure, true), 'and never a second time');
    assert(!shouldAnnounceMeasurement(without, false), 'nothing measured is nothing to announce');
    assert(!shouldAnnounceMeasurement(null, false), 'and neither is nothing at all');
    assert(!shouldAnnounceMeasurement(undefined, false), 'including the premium-withheld shape');
    // Repeated calls with the flag now set stay quiet, which is the property
    // that stops a foreground event from firing this every time.
    let announced = false;
    let fired = 0;
    for (let i = 0; i < 20; i++) {
      if (shouldAnnounceMeasurement(withFigure, announced)) { fired++; announced = true; }
    }
    assert(fired === 1, `twenty foreground events, one notification: ${fired}`);
  }

  // --- how far off the measurement is --------------------------------------

  {
    const d = (i: number) => `2026-06-${String(i + 1).padStart(2, '0')}`;
    const NOW = d(20);
    const evenings = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ date: d(i), factor: 1, target_kcal: 2000 }));

    // The case that made this necessary: every evening answered, nobody ever
    // asked to weigh, and weeklyDecision was saying "carry on".
    const noScale = readiness(evenings(8), [], NOW);
    assert(!noScale.ready, 'eight evenings alone do not make a measurement');
    assert(noScale.need === 'weighins', `it asks for the scale, not more evenings: ${noScale.need}`);
    assert(noScale.intakeDays === 8 && noScale.weighIns === 0, 'and counts both sides');
    assert(/8 of 8 evenings/.test(noScale.note), `the note says where each stands: ${noScale.note}`);
    assert(/10 of 8/.test(readiness(evenings(10), [], NOW).note) === false,
      'and never reports more than the threshold');

    // Four weigh-ins crammed into three days is four points and no span.
    const crammed = readiness(evenings(8), [
      { date: d(0), weight_kg: 90 }, { date: d(1), weight_kg: 89.8 },
      { date: d(2), weight_kg: 89.9 }, { date: d(3), weight_kg: 89.7 },
    ], NOW);
    assert(!crammed.ready, 'four weigh-ins in three days is not ten days of span');
    assert(crammed.need === 'span', `and it says so: ${crammed.need}`);
    assert(crammed.spanDays === 3, `with the span it actually has: ${crammed.spanDays}`);

    assert(/8 of 8 evenings/.test(noScale.note),
      `a finished condition is not reported as overshot: ${noScale.note}`);

    // Nothing at all: the evenings are the furthest away and the biggest ask.
    const blank = readiness([], [], NOW);
    assert(blank.need === 'intake', `an empty log starts with the evenings: ${blank.need}`);
    assert(blank.intakeDays === 0 && blank.weighIns === 0 && blank.spanDays === 0, 'all zero');

    // Everything satisfied.
    const done = readiness(evenings(8), [
      { date: d(0), weight_kg: 90 }, { date: d(4), weight_kg: 89.6 },
      { date: d(8), weight_kg: 89.2 }, { date: d(12), weight_kg: 88.9 },
    ], NOW);
    assert(done.ready && done.need === null, 'all three conditions met is ready');

    // The claim that ties this to the thing it guards: whenever readiness says
    // ready, measuredMaintenance must actually produce a figure. Two lists of
    // thresholds that drift apart is exactly what this function exists to stop.
    assert(
      measuredMaintenance(evenings(8), [
        { date: d(0), weight_kg: 90 }, { date: d(4), weight_kg: 89.6 },
        { date: d(8), weight_kg: 89.2 }, { date: d(12), weight_kg: 88.9 },
      ], 2400, NOW).kcal !== null,
      'ready means the measurement really is available'
    );
    assert(
      measuredMaintenance(evenings(8), [], 2400, NOW).kcal === null,
      'and not ready means it really is not'
    );
  }

  // --- days that do not count towards a comparison --------------------------

  {
    const day = (i: number) => `2026-07-${String(i + 1).padStart(2, '0')}`;
    // Twenty ordinary days, then three where the log ran away.
    const log = [
      ...Array.from({ length: 20 }, (_, i) => ({ date: day(i), factor: 1, target_kcal: 2000 })),
      ...Array.from({ length: 3 }, (_, i) => ({ date: day(20 + i), factor: 1.7, target_kcal: 2000 })),
    ];
    const weights = Array.from({ length: 6 }, (_, i) => ({
      date: day(i * 4), weight_kg: 90 - i * 0.3,
    }));
    const holiday = [day(20), day(21), day(22)];

    const kept = withoutOutliers(log, holiday) as typeof log;
    assert(kept.length === 20, `the marked days are gone: ${kept.length}`);
    assert(kept.every((e) => !holiday.includes(e.date)), 'and it is those days that went');
    assert(withoutOutliers(log, []).length === log.length, 'nothing marked changes nothing');
    assert(withoutOutliers(log, ['2026-01-01']).length === log.length,
      'marking a day that was never logged changes nothing');
    assert(withoutOutliers(null, holiday).length === 0, 'nonsense in, empty out');

    // The rule that matters, asserted rather than written in a comment. The
    // energy balance is physics — the food was eaten either way — so anyone
    // who could exclude days from it could mark their way to a flattering
    // number, and the figure people pay for would be worthless.
    const TODAY = '2026-07-24';
    const full = measuredMaintenance(log, weights, 2400, TODAY);
    const trimmed = measuredMaintenance(kept, weights, 2400, TODAY);
    assert(full.kcal !== null, 'the fixture is measurable at all');
    assert(full.kcal !== trimmed.kcal,
      'dropping days really would move the measurement, which is why it is not allowed');

    // And that the narrating side does change, or the feature does nothing.
    const patternAll = weekdayPattern(log, TODAY);
    const patternKept = weekdayPattern(kept, TODAY);
    assert(patternAll.note !== patternKept.note || patternAll.worst !== patternKept.worst,
      'the weekday reading does move when the unusual days are taken out');
  }

  // --- why the scale jumped ------------------------------------------------

  {
    const w = (date: string, weight_kg: number) => ({ date, weight_kg });
    const NOW = '2026-08-10';

    const jump = scaleJump(
      [w('2026-08-08', 90), w('2026-08-10', 91.5)],
      [{ date: '2026-08-09', factor: 1.7, target_kcal: 2000 }],
      NOW
    )!;
    assert(jump !== null, 'a kilo and a half in two days is a jump');
    assert(jump.kg === 1.5, `stated as measured: ${jump.kg}`);
    assert(jump.days === 2, `and over the span it happened in: ${jump.days}`);
    // The half of the answer that needs no physiology at all.
    assert(jump.impossibleKcal === 11550, `1.5 x 7700 = 11550: ${jump.impossibleKcal}`);
    assert(/11,550 kcal/.test(jump.note), `and it is in the sentence: ${jump.note}`);
    assert(jump.bigDayLogged, 'the bigger day is noticed');
    assert(/water/.test(jump.note), 'the mechanism is named');
    assert(/trend/i.test(jump.note), 'and what to read instead');

    // No comfort, no instruction. The figure is the argument.
    const SOOTHING = /\b(don'?t worry|no need to|relax|stay positive|keep going|keep it up|you'?ve got this|proud)\b/i;
    assert(!SOOTHING.test(jump.note), `no reassurance: ${jump.note}`);
    assert(!/should|must|try to/i.test(jump.note), 'and no instruction');
    assert(SOOTHING.test("don't worry, it's just water"), 'the reassurance guard actually matches');

    // Without a logged big day the arithmetic still holds, the sentence changes.
    const quiet = scaleJump([w('2026-08-09', 90), w('2026-08-10', 91)], [], NOW)!;
    assert(quiet !== null && !quiet.bigDayLogged, 'a jump with nothing logged still reads');
    assert(/7,700 kcal/.test(quiet.note), `and still names the cost: ${quiet.note}`);
    assert(/since yesterday/.test(quiet.note), 'one day is named as one day');

    // What is not a jump.
    assert(scaleJump([w('2026-08-09', 90), w('2026-08-10', 90.5)], [], NOW) === null,
      'half a kilo is scatter, not a jump');
    assert(scaleJump([w('2026-08-04', 90), w('2026-08-10', 92)], [], NOW) === null,
      'six days apart is a trend, not a jump');
    assert(scaleJump([w('2026-08-09', 92), w('2026-08-10', 90)], [], NOW) === null,
      'losing weight fast gets no card — nobody quits over that');
    assert(scaleJump([w('2026-08-10', 90)], [], NOW) === null, 'one weigh-in is not a comparison');
    assert(scaleJump([], [], NOW) === null, 'and none at all is not either');
    assert(scaleJump([w('2026-08-10', 90), w('2026-08-10', 91.2)], [], NOW) === null,
      'two entries for one morning are a correction, not a jump');
    // Nothing in the future is read, however it got into the log.
    assert(scaleJump([w('2026-08-10', 90), w('2026-08-20', 93)], [], NOW) === null,
      'a future weigh-in cannot make today a jump');
  }

  // --- planning an exception day -------------------------------------------

  {
    // A Monday with nothing logged yet: six days ahead of the exception.
    const MON = '2026-08-03';
    const SAT = '2026-08-08';
    const empty: any[] = [];

    const ok = planAhead(2000, empty, 1000, SAT, 1400, MON)!;
    assert(ok !== null, 'a wedding on Saturday is something the week can be asked about');
    assert(ok.perDayKcal !== null, 'and a week with room gives a figure');
    // 14,000 budget, minus the 3,000 Saturday costs, over the five other days.
    // Tue, Wed, Thu, Fri, Sun. Not Monday — today is being eaten, not planned —
    // and not Saturday, which is the day absorbing.
    assert(ok.daysAdjusted === 5, `the exception day does not also absorb: ${ok.daysAdjusted}`);
    assert(ok.perDayKcal === 1800, `five days at 1800: ${ok.perDayKcal}`);
    // The whole point, and the arithmetic that proves it: today at target, the
    // exception at target plus the extra, the rest at the new figure — and the
    // week still comes to what it was always going to come to.
    assert(
      Math.abs(2000 + (2000 + 1000) + ok.perDayKcal! * 5 - 14000) <= 5 * 5,
      'and the week lands where it was going to, within rounding'
    );
    assert(!/should|careful|avoid|but |warning/i.test(ok.note), `stated, not preached: ${ok.note}`);

    // Too big for the week: the honest answer is the cost, not a starvation figure.
    const heavy = planAhead(2000, empty, 6000, SAT, 1400, MON)!;
    assert(heavy.perDayKcal === null, 'a week that cannot take it says so');
    assert(heavy.cost !== null, 'and hands over the cost instead');
    assert(/1400/.test(heavy.note), 'naming the floor it would have broken');
    assert(/pushed back/.test(heavy.note), 'with what the evening actually costs');

    // The floor is the floor. No figure below it is ever returned.
    for (let extra = 500; extra <= 8000; extra += 250) {
      const r = planAhead(2000, empty, extra, SAT, 1400, MON);
      assert(r === null || r.perDayKcal === null || r.perDayKcal >= 1400,
        `no plan reads below resting expenditure (extra ${extra})`);
    }

    // Days that cannot be planned.
    assert(planAhead(2000, empty, 1000, MON, 1400, MON) === null, 'today is not a plan, it is now');
    assert(planAhead(2000, empty, 1000, '2026-08-02', 1400, MON) === null, 'yesterday is a record');
    assert(planAhead(2000, empty, 1000, '2026-08-11', 1400, MON) === null, 'next week has its own budget');
    assert(planAhead(2000, empty, 0, SAT, 1400, MON) === null, 'nothing extra is nothing to plan');
    assert(planAhead(2000, empty, 1000, 'saturday', 1400, MON) === null, 'a date has to be a date');

    // Days already answered are spent, not available to squeeze.
    const logged = [
      { date: '2026-08-03', factor: 1, target_kcal: 2000 },
      { date: '2026-08-04', factor: 1.3, target_kcal: 2000 },
    ];
    const after = planAhead(2000, logged, 1000, SAT, 1400, '2026-08-05')!;
    // Thu, Fri, Sun — Monday and Tuesday are answered, Wednesday is today.
    assert(after.daysAdjusted === 3, `only unanswered days absorb: ${after.daysAdjusted}`);
    assert(after.perDayKcal! < ok.perDayKcal!, 'and a week already run over leaves less, not more');

    // The days offered are exactly the days planAhead will accept.
    for (const anchor of ['2026-08-03', '2026-08-05', '2026-08-08', '2026-08-09']) {
      const ahead = daysAheadThisWeek(anchor);
      assert(ahead.every((d) => d.date > anchor), `nothing offered is in the past (${anchor})`);
      for (const d of ahead) {
        assert(planAhead(2000, empty, 1000, d.date, 1400, anchor) !== null,
          `every offered day can actually be planned (${anchor} → ${d.date})`);
      }
    }
    assert(daysAheadThisWeek('2026-08-03').length === 6, 'a Monday has six days ahead of it');
    assert(daysAheadThisWeek('2026-08-09').length === 0, 'and a Sunday has none');

    // Sunday has nothing after it.
    const sunday = planAhead(2000, empty, 1000, '2026-08-09', 1400, '2026-08-08')!;
    assert(sunday.perDayKcal === null, 'the last day of the week cannot be spread');
    assert(/nothing left to spread/.test(sunday.note), 'and says why rather than returning nothing');
  }

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

  // --- month against month -------------------------------------------------

  const monthRows = (month: string, factor: number, target: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      date: `${month}-${String(i + 2).padStart(2, '0')}`, factor, target_kcal: target,
    }));
  const monthWeights = (month: string, from: number, to: number) =>
    Array.from({ length: 5 }, (_, i) => ({
      date: `${month}-${String(i * 6 + 2).padStart(2, '0')}`,
      weight_kg: from + ((to - from) * i) / 4,
    }));

  const cmp = monthlyComparison(
    [...monthRows('2026-03', 1, 2100), ...monthRows('2026-05', 1, 1950)],
    [...monthWeights('2026-03', 100, 98), ...monthWeights('2026-05', 92, 90.6)]
  )!;
  assert(cmp !== null, 'two full months can be compared');
  assert(cmp.first.month === '2026-03' && cmp.last.month === '2026-05', 'earliest against latest');
  assert(cmp.first.avgIntake === 2100 && cmp.last.avgIntake === 1950, 'each month carries its own intake');
  assert(cmp.first.kgChange === -2 && cmp.last.kgChange === -1.4, `and its own change: ${cmp.first.kgChange}, ${cmp.last.kgChange}`);
  assert(cmp.maintenanceDrop > 0, `maintenance fell as the body got lighter: ${cmp.maintenanceDrop}`);
  assert(/costs less to run/.test(cmp.note), 'and the note explains why it got harder');

  // A thin month is skipped, not estimated.
  assert(monthlyComparison(
    [...monthRows('2026-03', 1, 2100), ...monthRows('2026-05', 1, 1950).slice(0, 3)],
    [...monthWeights('2026-03', 100, 98), ...monthWeights('2026-05', 92, 90.6)]
  ) === null, 'a month with three answers is not a month');

  assert(monthlyComparison(monthRows('2026-03', 1, 2100), monthWeights('2026-03', 100, 98)) === null,
    'one month alone is not a comparison');
  assert(monthlyComparison([], []) === null, 'nothing in, nothing claimed');
  assert(monthlyComparison(null, null) === null, 'null does not throw');

  assert(!/cure|prevent|detox|proven|should/i.test(cmp.note), `no claim or scolding: ${cmp.note}`);
  assert(!/\bstudies\b|%/.test(cmp.note), 'no invented statistic');

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
