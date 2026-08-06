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

export type FastDay = { date: string; logged: boolean; future: boolean; label: string };

/**
 * The last seven days as a strip you can correct.
 *
 * A mistap could not be undone and a forgotten day could not be filled in, so
 * the streak drifted away from what actually happened. An unhonest streak is
 * worse than none — it was the reason the fake one was removed in the first
 * place.
 */
export function fastWeek(fastLog: string[], today: string = todayISO()): FastDay[] {
  const logged = dateSet(fastLog);
  const todayDate = parseISO(today);

  return windowDays(today)
    .slice()
    .reverse()
    .map((date) => ({
      date,
      logged: logged.has(date),
      // Nothing ahead of today can be claimed as done.
      future: parseISO(date).getTime() > todayDate.getTime(),
      label: parseISO(date).toLocaleDateString(undefined, { weekday: 'narrow' }),
    }));
}

export type IntakeDay = { date: string; factor: number | null; future: boolean; label: string };

/**
 * The last seven evenings as a strip you can correct.
 *
 * The fast log got this treatment already, for the reason that a streak nobody
 * can fix stops being true. The intake log needs it more: the measured
 * maintenance is built on these answers, so one mistap does not just look
 * wrong, it moves the number the app tells you to eat.
 */
export function intakeWeek(intakeLog: unknown, today: string = todayISO()): IntakeDay[] {
  const byDate = new Map<string, number>();
  for (const row of Array.isArray(intakeLog) ? intakeLog : []) {
    const r = row as any;
    if (r && typeof r.date === 'string' && isFinite(r.factor)) byDate.set(r.date, r.factor);
  }
  const todayDate = parseISO(today);

  return windowDays(today)
    .slice()
    .reverse()
    .map((date) => ({
      date,
      factor: byDate.has(date) ? byDate.get(date)! : null,
      future: parseISO(date).getTime() > todayDate.getTime(),
      label: parseISO(date).toLocaleDateString(undefined, { weekday: 'narrow' }),
    }));
}

/**
 * The four states a day in the intake strip can hold, in tap order.
 *
 * `null` is part of the cycle rather than an absence: a tap on an untouched day
 * has to be undoable, or correcting the strip could only ever add answers
 * nobody gave — and the measured maintenance is built on these entries.
 *
 * The factors match the dashboard's three options exactly. Two lists that must
 * agree and only agree by habit is how they drift apart.
 */
export const INTAKE_CYCLE: (number | null)[] = [null, 1, 0.75, 1.3];

export function nextIntakeFactor(current: number | null): number | null {
  const i = INTAKE_CYCLE.findIndex((f) => f === current);
  // An unrecognised factor (an older log, a hand-edited backup) starts over
  // rather than sticking, so a strange value can still be cleared.
  return INTAKE_CYCLE[i === -1 ? 1 : (i + 1) % INTAKE_CYCLE.length];
}

/** What a factor says, in the dashboard's words. */
export function intakeLabel(factor: number | null): string {
  if (factor === null) return 'not answered';
  return factor >= 1.2 ? 'ate more' : factor <= 0.9 ? 'ate less' : 'ate the plan';
}

/**
 * Where someone is in adapting to the schedule.
 *
 * Counted from days actually logged, not from a start date. Someone who logs
 * four days, stops for a fortnight and comes back is on day five, not back at
 * the beginning — a calendar would have reset them for no reason.
 *
 * Same wording rules as the fasting bands: describes what typically changes,
 * promises nothing, and names no outcome.
 */
export type AdaptationStage = {
  id: 'none' | 'early' | 'first-week' | 'settling' | 'settled';
  label: string;
  /** Distinct days ever logged. */
  daysLogged: number;
  note: string;
};

const ADAPTATION: { id: AdaptationStage['id']; from: number; label: string; note: string }[] = [
  {
    id: 'none',
    from: 0,
    label: 'Not started',
    note: 'Log your first completed fast and this starts tracking what changes.',
  },
  {
    id: 'early',
    from: 1,
    label: 'First days',
    note: 'Hunger tends to arrive in waves rather than build. Most waves pass inside twenty minutes.',
  },
  {
    id: 'first-week',
    from: 4,
    label: 'First week',
    note: 'Headaches and flat sessions this week are usually sodium rather than willpower. Salt the water.',
  },
  {
    id: 'settling',
    from: 8,
    label: 'Settling',
    note: 'Appetite usually steadies around now. How training feels often lags a week or so behind it.',
  },
  {
    id: 'settled',
    from: 29,
    label: 'Settled',
    note: 'Past the usual adjustment window. What you feel now is mostly the food, not the schedule.',
  },
];

export function adaptationStage(fastLog: string[]): AdaptationStage {
  const daysLogged = dateSet(fastLog).size;
  let current = ADAPTATION[0];
  for (const stage of ADAPTATION) if (daysLogged >= stage.from) current = stage;
  return { id: current.id, label: current.label, note: current.note, daysLogged };
}

/**
 * One change, once a week.
 *
 * The app can now say several true things at once — a stall, a long deficit, a
 * window that collides with training, thin data. All of them at once is noise,
 * and noise is what people stop reading. This picks the one that matters most
 * right now and says what to do about it.
 *
 * A pure prioritiser: it takes what the other modules already worked out
 * rather than recomputing any of it, so the ordering is the only thing it can
 * get wrong, and the ordering is what the checks pin down.
 */
export type Decision = {
  headline: string;
  action: string;
  why: string;
  /**
   * Whether the action rests on a measurement rather than on arithmetic the app
   * would do for anyone. The module decides this, not the screen — the first
   * version gated in the UI and quietly put a free timing correction behind the
   * paywall, which is the one thing this design promised not to do.
   */
  premiumOnly: boolean;
};

/** The stall decision's headline, named once so progressCards can match it. */
const STALL_HEADLINE = 'Your maintenance has moved';

export function weeklyDecision(input: {
  stalled?: boolean;
  /** How long the weight has held, so the decision can say it. */
  stalledDays?: number;
  newTarget?: number | null;
  breakDue?: boolean;
  deficitWeeks?: number;
  maintenanceKcal?: number | null;
  windowStart?: string | null;
  intakeDays?: number;
  trendNote?: string;
}): Decision {
  const {
    stalled, stalledDays = 0, newTarget, breakDue, deficitWeeks = 0, maintenanceKcal,
    windowStart, intakeDays = 0, trendNote = '',
  } = input;

  // A stall outranks everything: it is the thing that makes people quit.
  if (stalled) {
    return {
      headline: STALL_HEADLINE,
      action: newTarget ? `Eat ${newTarget} kcal this week.` : 'Answer a few more days so the new figure can be worked out.',
      why: stalledDays > 0
        ? `${stalledDays} days holding at this intake means the deficit has closed. The number changed, not your effort.`
        : 'Holding weight at this intake means the deficit has closed. The number changed, not your effort.',
      // Only the figure is measured; a stall without one is just a request.
      premiumOnly: newTarget !== null && newTarget !== undefined,
    };
  }

  // Then the thing that is about to make them quit.
  if (breakDue) {
    return {
      headline: 'Take a week at maintenance',
      action: maintenanceKcal ? `Eat ${maintenanceKcal} kcal for seven days, then go back down.` : 'Eat at maintenance for seven days.',
      why: `${deficitWeeks} weeks without a break. Planning the week off is what keeps it from happening by accident.`,
      premiumOnly: maintenanceKcal !== null && maintenanceKcal !== undefined,
    };
  }

  // Then a fixable mismatch that costs a little every single session.
  if (windowStart) {
    return {
      headline: 'Move your eating window',
      action: `Open it at ${windowStart} instead.`,
      why: 'Your session currently runs into the window, so the meal lands mid-workout.',
      // Clock arithmetic, not a measurement. It was free before and stays free.
      premiumOnly: false,
    };
  }

  // Then the thing that unlocks everything else.
  if (intakeDays < 8) {
    return {
      headline: 'Answer the evening question',
      action: `${8 - intakeDays} more day${8 - intakeDays === 1 ? '' : 's'} and the app can measure what your body costs.`,
      why: 'Three taps a day is the whole signal. Without it the target stays a formula.',
      premiumOnly: false,
    };
  }

  return {
    headline: 'Carry on',
    action: 'Nothing to change this week.',
    why: trendNote || 'The plan is working as set.',
    premiumOnly: false,
  };
}

// ---------------------------------------------------------------------------

/**
 * Which single card on Progress may ask for money.
 *
 * Three could at once before: the forecast, the plateau and the measurement,
 * on the same screen as a decision card already saying the same thing in
 * words. The screen's own comment says several true statements at once is
 * noise; it had stopped following it.
 *
 * Here rather than in the JSX so the rule can be asserted.
 */
export type SellCard = 'measured' | 'months' | 'outlook' | 'pattern' | 'cycle';

export type ProgressCards = {
  outlook: boolean;
  /** The single card allowed to show a paywall button, if any. */
  sell: SellCard | null;
};

/**
 * Ranked as an argument, not by where the card happens to sit in the JSX. The
 * measurement is the thing a formula cannot give anyone, so it wins whenever it
 * exists. The month comparison comes next because it answers the question that
 * makes people quit — why the same plate stopped working. The rest are
 * refinements, and a refinement is a poor first pitch.
 */
const SELL_ORDER: SellCard[] = ['measured', 'months', 'outlook', 'pattern', 'cycle'];

export function progressCards(input: {
  premium: boolean;
  hasOutlook?: boolean;
  /** True once a maintenance figure actually exists to sell. */
  hasMeasured?: boolean;
  hasMonths?: boolean;
  hasPattern?: boolean;
  hasCycle?: boolean;
}): ProgressCards {
  const { premium, hasOutlook, hasMeasured, hasMonths, hasPattern, hasCycle } = input;
  const available: Record<SellCard, boolean> = {
    measured: !!hasMeasured,
    months: !!hasMonths,
    outlook: !!hasOutlook,
    pattern: !!hasPattern,
    cycle: !!hasCycle,
  };
  return {
    outlook: !!hasOutlook,
    // Nothing to sell to someone who already paid.
    sell: premium ? null : SELL_ORDER.find((k) => available[k]) ?? null,
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

  // --- the correctable week ------------------------------------------------

  const week = fastWeek([day(0), day(2)], TODAY);
  assert(week.length === 7, 'the strip covers seven days');
  assert(week[6].date === TODAY, 'today is last, so the strip reads left to right');
  assert(week[0].date === day(6), 'and six days back is first');
  assert(week[6].logged && week[4].logged, 'logged days are marked');
  assert(!week[5].logged, 'unlogged days are not');
  assert(week.every((d) => !d.future), 'nothing in a backward window is in the future');
  assert(week.every((d) => d.label.length > 0), 'every day carries a label');

  // A window ending in the past must still refuse days after today.
  const past = fastWeek([], '2020-01-01');
  assert(past.every((d) => !d.future), 'a historical window has no future days');

  // --- the correctable evening strip ---------------------------------------

  const iw = intakeWeek([
    { date: TODAY, factor: 1, target_kcal: 2000 },
    { date: day(2), factor: 0.75, target_kcal: 2000 },
  ], TODAY);
  assert(iw.length === 7, 'seven evenings');
  assert(iw[6].date === TODAY, 'today is last, so it reads left to right');
  assert(iw[6].factor === 1, 'an answered day carries its factor');
  assert(iw[4].factor === 0.75, 'including a corrected one');
  assert(iw[5].factor === null, 'an unanswered day is null, not zero');
  assert(iw.every((x) => !x.future), 'a backward window holds no future');
  assert(intakeWeek([], TODAY).every((x) => x.factor === null), 'nothing answered, nothing marked');
  assert(intakeWeek(null, TODAY).length === 7, 'a missing log still yields a week');
  assert(intakeWeek([{ date: TODAY, factor: 'x' }] as any, TODAY)[6].factor === null, 'junk is not a factor');

  // --- adaptation ----------------------------------------------------------

  assert(adaptationStage([]).id === 'none', 'no logged days means not started');
  assert(adaptationStage([day(0)]).id === 'early', 'one day is the early phase');
  assert(adaptationStage([0, 1, 2].map(day)).id === 'early', 'three days is still early');
  assert(adaptationStage([0, 1, 2, 3].map(day)).id === 'first-week', 'four days begins the first week');
  assert(adaptationStage([0, 1, 2, 3, 4, 5, 6].map(day)).id === 'first-week', 'seven days is still the first week');
  assert(adaptationStage(Array.from({ length: 8 }, (_, i) => day(i))).id === 'settling', 'eight days is settling');
  assert(adaptationStage(Array.from({ length: 29 }, (_, i) => day(i))).id === 'settled', 'twenty-nine days is settled');

  // Gaps must not reset progress: coming back after a fortnight is day five,
  // not day one. A calendar-based version would have punished the return.
  const withGap = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-08-05'];
  assert(adaptationStage(withGap).daysLogged === 5, 'every logged day counts, however spread out');
  assert(adaptationStage(withGap).id === 'first-week', 'a gap does not send you back to the start');

  // Duplicates and junk cannot inflate the count.
  assert(adaptationStage([day(0), day(0), day(0)]).daysLogged === 1, 'the same day counts once');
  assert(adaptationStage([null, 7, day(0)] as any).daysLogged === 1, 'junk entries are ignored');
  assert(adaptationStage(null as any).id === 'none', 'a missing log does not throw');

  // Bands are ordered, so no day count can fall through a gap.
  for (let i = 1; i < ADAPTATION.length; i++) {
    assert(ADAPTATION[i].from > ADAPTATION[i - 1].from, 'adaptation boundaries increase');
  }

  // Same wording rule as the fasting bands, enforced rather than intended.
  for (const stage of ADAPTATION) {
    assert(stage.note.length > 20, `${stage.id} explains itself`);
    assert(
      !/cure|prevent|disease|heal|detox|toxin|guarantee|proven|burn fat/i.test(stage.note),
      `${stage.id} makes no health claim`
    );
    assert(!/%|\bstudies\b/i.test(stage.note), `${stage.id} invents no statistic`);
    assert(!/you will|guaranteed|always/i.test(stage.note), `${stage.id} promises nothing`);
  }

  // --- one change, in the right order --------------------------------------

  // Everything true at once: the stall must win.
  const all = weeklyDecision({
    stalled: true, newTarget: 1600, breakDue: true, deficitWeeks: 9,
    maintenanceKcal: 2300, windowStart: '20:15', intakeDays: 2,
  });
  assert(/maintenance has moved/.test(all.headline), `a stall outranks everything: ${all.headline}`);
  assert(/1600/.test(all.action), 'and carries the new number');

  const brk = weeklyDecision({ breakDue: true, deficitWeeks: 9, maintenanceKcal: 2300, windowStart: '20:15', intakeDays: 2 });
  assert(/week at maintenance/.test(brk.headline), 'then the break');
  assert(/2300/.test(brk.action), 'with what to eat during it');

  const win = weeklyDecision({ windowStart: '20:15', intakeDays: 2 });
  assert(/eating window/.test(win.headline), 'then the window');
  assert(/20:15/.test(win.action), 'with the time to move it to');

  const needData = weeklyDecision({ intakeDays: 3 });
  assert(/evening question/.test(needData.headline), 'then the missing data');
  assert(/5 more days/.test(needData.action), `counted exactly: ${needData.action}`);
  assert(/1 more day\b/.test(weeklyDecision({ intakeDays: 7 }).action), 'and singular at one');

  const fine = weeklyDecision({ intakeDays: 14, trendNote: 'Down 0.4 kg a week.' });
  assert(/Carry on/.test(fine.headline), 'and nothing to change is a valid answer');
  assert(/0.4/.test(fine.why), 'backed by the trend rather than a platitude');

  assert(weeklyDecision({}).headline.length > 0, 'empty input still produces something sayable');

  // Which advice is paid for, decided here rather than by a screen. Moving the
  // eating window is clock arithmetic the app already did for free — putting it
  // behind the paywall would take away something people already had.
  assert(win.premiumOnly === false, 'a window correction stays free');
  assert(needData.premiumOnly === false, 'asking for data is not a product');
  assert(fine.premiumOnly === false, 'and neither is "carry on"');
  assert(all.premiumOnly === true, 'a measured target is the paid part');
  assert(brk.premiumOnly === true, 'so is the maintenance figure');
  assert(weeklyDecision({ stalled: true, newTarget: null }).premiumOnly === false,
    'a stall with no figure to give is not sold as one');

  // A stall the app cannot price still gives an instruction.
  const blind = weeklyDecision({ stalled: true, newTarget: null });
  assert(/more days/.test(blind.action), 'a stall without a figure asks for data');

  for (const dcn of [all, brk, win, needData, fine]) {
    assert(!/cure|prevent|detox|proven|guarantee/i.test(dcn.why + dcn.action), 'no health claim in a decision');
    assert(!/\bstudies\b|%/.test(dcn.why + dcn.action), 'no invented statistic in a decision');
  }

  // --- what Progress is allowed to show ------------------------------------
  // At most one card may ask for money. Three could before, on the same screen
  // as a decision card already saying the same thing.
  const cases = [
    { premium: false, hasOutlook: true, hasMeasured: true },
    { premium: false, hasOutlook: true, hasMeasured: false },
    { premium: false, hasOutlook: false, hasMeasured: false },
    { premium: true, hasOutlook: true, hasMeasured: true },
  ];
  for (const c of cases) {
    const cards = progressCards(c);
    assert(cards.sell === null || !c.premium, 'a paying user is never sold to again');
    // One `sell` value by construction; this pins that it is a single slot
    // rather than a set the screen can widen later.
    assert(cards.sell === null || SELL_ORDER.includes(cards.sell), 'the sell slot holds one card or none');
  }

  // A stall is stated once, by the decision card. The screen used to carry a
  // second plateau card that could never appear, because weeklyDecision ranks
  // a stall above everything else — this pins the ranking the deletion relies
  // on, so restoring the card would be a visible decision rather than an
  // accident.
  assert(
    weeklyDecision({ stalled: true, newTarget: 2200, breakDue: true, windowStart: '17:00', intakeDays: 0 })
      .headline === STALL_HEADLINE,
    'a stall outranks every other decision, so no second card is needed'
  );
  assert(
    /14 days/.test(weeklyDecision({ stalled: true, newTarget: 2200, stalledDays: 14 }).why),
    'and the decision carries the days the deleted card used to show'
  );
  assert(
    !/undefined|NaN/.test(weeklyDecision({ stalled: true, newTarget: 2200 }).why),
    'a stall with no day count still reads as a sentence'
  );

  assert(
    progressCards({ premium: false, hasMeasured: true, hasOutlook: true }).sell === 'measured',
    'the measurement is the stronger argument when there is one'
  );
  assert(
    progressCards({ premium: false, hasMeasured: false, hasOutlook: true }).sell === 'outlook',
    'and the forecast carries it otherwise'
  );
  // The strip has to be able to take an answer back, not only give one.
  assert(nextIntakeFactor(null) === 1, 'an untouched day becomes the plan');
  assert(nextIntakeFactor(1) === 0.75, 'then less');
  assert(nextIntakeFactor(0.75) === 1.3, 'then more');
  assert(nextIntakeFactor(1.3) === null, 'and then it is cleared again');
  assert(nextIntakeFactor(0.42) === 1, 'an unknown factor rejoins the cycle rather than sticking');
  {
    // Four taps return a day to where it started, whatever it started as.
    for (const start of INTAKE_CYCLE) {
      let f = start;
      for (let i = 0; i < INTAKE_CYCLE.length; i++) f = nextIntakeFactor(f);
      assert(f === start, `four taps are a round trip from ${start}`);
    }
  }
  assert(intakeLabel(null) === 'not answered', 'an empty day says so');
  assert(intakeLabel(1) === 'ate the plan' && intakeLabel(0.75) === 'ate less' && intakeLabel(1.3) === 'ate more',
    'and the labels match the dashboard');

  assert(progressCards({ premium: true, hasMeasured: true }).sell === null, 'nothing is sold twice');

  // Every card that can ask for money goes through the one slot. Three cards
  // were added to Progress that pushed to the paywall on their own, so a free
  // user could see four buy buttons on one screen — the exact nagging this
  // function exists to prevent.
  const every = {
    premium: false, hasMeasured: true, hasMonths: true,
    hasOutlook: true, hasPattern: true, hasCycle: true,
  };
  assert(progressCards(every).sell === 'measured', 'with everything available the measurement still leads');
  assert(progressCards({ ...every, premium: true }).sell === null, 'and a payer sees none of it');
  assert(
    progressCards({ ...every, hasMeasured: false }).sell === 'months',
    'the month comparison is the next best argument'
  );
  assert(
    progressCards({ premium: false, hasPattern: true, hasCycle: true }).sell === 'pattern',
    'a refinement only sells when nothing stronger is there'
  );
  assert(
    progressCards({ premium: false, hasCycle: true }).sell === 'cycle',
    'and the cycle is last rather than absent'
  );
  assert(progressCards({ premium: false }).sell === null, 'nothing available means nothing sold');
  // The ranking must cover every card, or a new one silently never sells.
  assert(
    SELL_ORDER.length === new Set(SELL_ORDER).size,
    'each card appears in the ranking exactly once'
  );

  return 'review.ts: all checks passed';
}
