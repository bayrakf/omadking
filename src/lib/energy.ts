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

import { weeklyTrend } from './nutrition';
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
