/**
 * The week, read back.
 *
 * The app collects fasts, cooks, weigh-ins and plans but never looked past
 * today — the only sign of persistence was a streak number. This reads the
 * last seven days and says what happened.
 *
 * Two rules the wording follows:
 *
 * - **Only counted things.** No percentages nobody measured, no adherence
 *   score, no praise. "4 of 7 fasts logged" is a fact; "you're doing great" is
 *   an opinion the app has not earned.
 * - **One consequence, arithmetic not motivational.** A trend of -0.4 kg/week
 *   means -1.6 kg over four weeks. That follows. "Keep it up" does not.
 */

import { todayISO, parseISO } from './dates';
import { weeklyTrend } from './nutrition';

export const WINDOW_DAYS = 7;

/** Data days below which a week is not worth reading back. */
export const MIN_DATA_DAYS = 3;

export type WeighIn = { date: string; weight_kg: number };

export type WeeklyReview = {
  /** The seven dates covered, newest first. */
  days: string[];
  fastDays: number;
  cookDays: number;
  planDays: number;
  weighIns: number;
  /** Newest minus oldest weigh-in in the window; null with fewer than two. */
  weightChange: number | null;
  /** kg per week from the least-squares fit; null when it cannot be fitted. */
  trend: number | null;
  /** Distinct days with any activity at all. */
  activeDays: number;
  /** Too little logged to say anything. */
  sparse: boolean;
  /** What happened, in counted facts. Empty when sparse. */
  headline: string;
  /** What follows from it, or what is missing when sparse. */
  consequence: string;
};

function windowDays(today: string): string[] {
  const out: string[] = [];
  const cursor = parseISO(today);
  for (let i = 0; i < WINDOW_DAYS; i++) {
    out.push(todayISO(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return out;
}

const dateSet = (xs: unknown): Set<string> =>
  new Set(Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string') : []);

/** Trims a float to one decimal without printing "-0". */
function kg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r === 0 ? 0 : r);
}

export function weeklyReview(
  fastLog: string[],
  cookLog: string[],
  weights: WeighIn[],
  plans: { date?: string }[],
  today: string = todayISO()
): WeeklyReview {
  const days = windowDays(today);
  const inWindow = new Set(days);

  const fasts = dateSet(fastLog);
  const cooks = dateSet(cookLog);

  const fastDays = days.filter((d) => fasts.has(d)).length;
  const cookDays = days.filter((d) => cooks.has(d)).length;

  const planDates = new Set(
    (Array.isArray(plans) ? plans : [])
      .map((p) => p?.date)
      .filter((d): d is string => typeof d === 'string' && inWindow.has(d))
  );

  const weighed = (Array.isArray(weights) ? weights : [])
    .filter((w) => w && typeof w.date === 'string' && inWindow.has(w.date) && isFinite(w.weight_kg))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weightChange =
    weighed.length >= 2 ? weighed[weighed.length - 1].weight_kg - weighed[0].weight_kg : null;
  const trend = weeklyTrend(weighed);

  const active = new Set<string>([
    ...days.filter((d) => fasts.has(d)),
    ...days.filter((d) => cooks.has(d)),
    ...planDates,
    ...weighed.map((w) => w.date),
  ]);
  const activeDays = active.size;
  const sparse = activeDays < MIN_DATA_DAYS;

  if (sparse) {
    return {
      days, fastDays, cookDays, planDays: planDates.size,
      weighIns: weighed.length, weightChange, trend, activeDays, sparse,
      headline: '',
      consequence:
        activeDays === 0
          ? `Nothing logged in the last ${WINDOW_DAYS} days. A week reads back once there are ${MIN_DATA_DAYS} days of it.`
          : `${activeDays} of ${MIN_DATA_DAYS} days logged. A week reads back from ${MIN_DATA_DAYS}.`,
    };
  }

  const parts = [`${fastDays} of ${WINDOW_DAYS} fasts logged`];
  if (cookDays > 0) parts.push(`${cookDays} cooked`);
  if (planDates.size > 0) parts.push(`${planDates.size} planned`);
  if (weighed.length > 0) {
    parts.push(
      weightChange === null
        ? `${weighed.length} weigh-in`
        : `${kg(Math.abs(weightChange))} kg ${weightChange > 0 ? 'up' : weightChange < 0 ? 'down' : 'level'} across ${weighed.length} weigh-ins`
    );
  }

  let consequence: string;
  if (weighed.length < 2) {
    consequence = 'Two weigh-ins in a week are enough to show a direction.';
  } else if (trend === null) {
    consequence = 'Every weigh-in landed on the same day, so there is no direction to read yet.';
  } else if (trend === 0) {
    consequence = 'Flat across the week.';
  } else {
    // The one thing that follows arithmetically, and nothing more.
    consequence = `At this rate that is ${kg(Math.abs(trend * 4))} kg ${trend > 0 ? 'up' : 'down'} over four weeks.`;
  }

  return {
    days, fastDays, cookDays, planDays: planDates.size,
    weighIns: weighed.length, weightChange, trend, activeDays, sparse,
    headline: `${parts.join(' · ')}.`,
    consequence,
  };
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const TODAY = '2026-08-05';
  const day = (back: number) => {
    const d = parseISO(TODAY);
    d.setDate(d.getDate() - back);
    return todayISO(d);
  };

  // A full week.
  const full = weeklyReview(
    [0, 1, 2, 3, 4, 5, 6].map(day),
    [0, 2, 4].map(day),
    [
      { date: day(6), weight_kg: 83.0 },
      { date: day(3), weight_kg: 82.6 },
      { date: day(0), weight_kg: 82.3 },
    ],
    [{ date: day(0) }, { date: day(2) }],
    TODAY
  );
  assert(full.days.length === 7, 'the window is seven days');
  assert(full.fastDays === 7, `all seven fasts counted, got ${full.fastDays}`);
  assert(full.cookDays === 3, `three cooks counted, got ${full.cookDays}`);
  assert(full.planDays === 2, `two plans counted, got ${full.planDays}`);
  assert(full.weighIns === 3, 'three weigh-ins counted');
  assert(full.weightChange !== null && Math.abs(full.weightChange + 0.7) < 0.001, 'change is newest minus oldest');
  assert(!full.sparse, 'a full week is not sparse');
  assert(full.headline.includes('7 of 7 fasts logged'), 'the headline counts fasts');
  assert(full.headline.includes('0.7 kg down'), `the headline states the change, got: ${full.headline}`);
  assert(full.consequence.includes('four weeks'), 'the consequence extrapolates the trend');

  // Nothing invented: no percentage, no praise.
  const wording = full.headline + ' ' + full.consequence;
  assert(!wording.includes('%'), 'no percentage is invented');
  assert(!/great|well done|keep it up|amazing|nice/i.test(wording), 'no praise is offered');

  // Anything outside the window is ignored.
  const outside = weeklyReview(
    [day(0), day(1), day(2), '2026-07-01'],
    [], [], [], TODAY
  );
  assert(outside.fastDays === 3, `only in-window fasts count, got ${outside.fastDays}`);

  // Sparse: says what is missing rather than showing an empty card.
  const empty = weeklyReview([], [], [], [], TODAY);
  assert(empty.sparse, 'an empty week is sparse');
  assert(empty.headline === '', 'a sparse week has no headline to give');
  assert(empty.consequence.includes('Nothing logged'), `an empty week says so, got: ${empty.consequence}`);

  const thin = weeklyReview([day(0), day(1)], [], [], [], TODAY);
  assert(thin.sparse, 'two days is still sparse');
  assert(thin.consequence.includes('2 of 3'), `a thin week names the gap, got: ${thin.consequence}`);

  // Three distinct active days is the threshold, even mixed across kinds.
  const mixed = weeklyReview([day(0)], [day(1)], [{ date: day(2), weight_kg: 82 }], [], TODAY);
  assert(!mixed.sparse, 'three different kinds of day still make three days');

  // A weigh-in without a second one cannot show direction.
  const one = weeklyReview([day(0), day(1), day(2)], [], [{ date: day(0), weight_kg: 82 }], [], TODAY);
  assert(one.trend === null && one.weightChange === null, 'one weigh-in gives no change or trend');
  assert(one.consequence.includes('Two weigh-ins'), 'and says what would');

  // Two weigh-ins on the same day cannot be fitted.
  const sameDay = weeklyReview(
    [day(0), day(1), day(2)],
    [],
    [{ date: day(0), weight_kg: 82 }, { date: day(0), weight_kg: 82.4 }],
    [], TODAY
  );
  assert(sameDay.trend === null, 'a same-day pair yields no trend');
  assert(sameDay.consequence.includes('same day'), 'and the wording says why');

  // Week boundary: the seventh day back is in, the eighth is out.
  const boundary = weeklyReview([day(6)], [day(7)], [], [], TODAY);
  assert(boundary.fastDays === 1, 'day six back is inside the window');
  assert(boundary.cookDays === 0, 'day seven back is outside it');

  // Malformed input must not throw.
  const junk = weeklyReview(
    [null, 42, day(0)] as any,
    null as any,
    [{ date: day(0), weight_kg: NaN }, null] as any,
    [{}, null] as any,
    TODAY
  );
  assert(junk.fastDays === 1, 'junk entries are skipped, real ones still count');
  assert(junk.weighIns === 0, 'a NaN weight is not a weigh-in');

  // Never prints a negative zero.
  const level = weeklyReview(
    [day(0), day(1), day(2)],
    [],
    [{ date: day(4), weight_kg: 82 }, { date: day(0), weight_kg: 82 }],
    [], TODAY
  );
  assert(!level.headline.includes('-0'), `no negative zero, got: ${level.headline}`);

  return 'review.ts: all checks passed';
}
