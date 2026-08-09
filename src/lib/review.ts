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

export type IntakeDay = {
  date: string;
  factor: number | null;
  future: boolean;
  label: string;
  /**
   * The target that was in force on the day, and what the answer says was
   * actually eaten against it. Both null for a day nobody answered.
   *
   * Taken from the entry rather than from today's target: the target moves as
   * someone gets lighter, so charting last Tuesday against this Friday's number
   * would draw a gap that never existed. The same reason `measuredMaintenance`
   * multiplies each day by its own `target_kcal` instead of by a single figure.
   */
  target: number | null;
  kcal: number | null;
};

/**
 * The last seven evenings as a strip you can correct.
 *
 * The fast log got this treatment already, for the reason that a streak nobody
 * can fix stops being true. The intake log needs it more: the measured
 * maintenance is built on these answers, so one mistap does not just look
 * wrong, it moves the number the app tells you to eat.
 */
export function intakeWeek(intakeLog: unknown, today: string = todayISO()): IntakeDay[] {
  const byDate = new Map<string, { factor: number; target: number | null }>();
  for (const row of Array.isArray(intakeLog) ? intakeLog : []) {
    const r = row as any;
    if (r && typeof r.date === 'string' && isFinite(r.factor)) {
      // An older entry may predate target_kcal being stored, so the target is
      // allowed to be missing while the answer still counts.
      const target = isFinite(r.target_kcal) && r.target_kcal > 0 ? Number(r.target_kcal) : null;
      byDate.set(r.date, { factor: Number(r.factor), target });
    }
  }
  const todayDate = parseISO(today);

  return windowDays(today)
    .slice()
    .reverse()
    .map((date) => {
      const hit = byDate.get(date) ?? null;
      return {
        date,
        factor: hit ? hit.factor : null,
        future: parseISO(date).getTime() > todayDate.getTime(),
        label: parseISO(date).toLocaleDateString(undefined, { weekday: 'narrow' }),
        target: hit?.target ?? null,
        kcal: hit && hit.target !== null ? Math.round(hit.factor * hit.target) : null,
      };
    });
}

/**
 * What the evening question can be answered with, and the only place it is
 * written down.
 *
 * Two things were wrong with the three options this replaces.
 *
 * The first is cosmetic: they were labelled in percent ("≈ 30% over") two lines
 * below the day's target in kilocalories, so answering meant doing arithmetic
 * at the exact moment the answer is supposed to be one tap.
 *
 * The second is not. The scale stopped at 1.3, so someone who really ate double
 * was recorded as thirty percent over. `measuredMaintenance` computes
 * `intake − trend × 7700/7`; intake logged too low makes the measured
 * maintenance too low, which makes the daily target too low. The bias runs one
 * way only, and it lands on the one number people pay for. Skipping a day loses
 * it honestly; capping a day lies about it.
 *
 * `INTAKE_CYCLE` and the dashboard used to be two lists that had to agree and
 * only agreed by habit. Now there is one.
 */
export type IntakeOption = { factor: number; label: string; glyph: string };

/**
 * The plan comes first because it is the common answer and the strip should
 * reach it in one tap. After that the list runs under, then over, so the
 * dashboard reads as a scale rather than as four unrelated buttons.
 *
 * Both ends are open on purpose. 1.7 was itself an attempt to fix a cap at 1.3,
 * and it repeated the mistake one notch higher: a day at three times the target
 * still landed on the highest option, which pulls the measured maintenance down
 * and the target with it. 0.4 is the same defect mirrored — a day barely eaten
 * and a day at three quarters both recorded 0.75, biasing the measurement up.
 * Neither end can be closed honestly, so each end now holds an answer far
 * enough out that hitting it is rare rather than routine.
 *
 * The glyph belongs to the option rather than to a parallel array indexed by
 * position, which is what it was: adding an option there silently shifted every
 * mark after it.
 */
export const INTAKE_OPTIONS: IntakeOption[] = [
  { factor: 1, label: 'Ate the plan', glyph: '=' },
  { factor: 0.75, label: 'Ate less', glyph: '−' },
  { factor: 0.4, label: 'Barely ate', glyph: '⁻⁻' },
  { factor: 1.3, label: 'Ate more', glyph: '+' },
  { factor: 1.7, label: 'A lot more', glyph: '⁺⁺' },
  { factor: 2.4, label: 'Well over double', glyph: '⁺⁺⁺' },
];

/**
 * What an option means in kilocalories against a given target.
 *
 * Derived rather than written down: at a 2,500 target "a lot more" is a
 * different number than at 2,000, and a fixed string would be wrong for
 * everyone but one person.
 */
export function intakeKcal(factor: number, targetKcal: number): number {
  if (!isFinite(factor) || !isFinite(targetKcal) || targetKcal <= 0) return 0;
  return Math.round((factor * targetKcal) / 10) * 10;
}

/**
 * The states a day in the intake strip can hold, in tap order.
 *
 * `null` is part of the cycle rather than an absence: a tap on an untouched day
 * has to be undoable, or correcting the strip could only ever add answers
 * nobody gave — and the measured maintenance is built on these entries.
 */
export const INTAKE_CYCLE: (number | null)[] = [null, ...INTAKE_OPTIONS.map((o) => o.factor)];

export function nextIntakeFactor(current: number | null): number | null {
  const i = INTAKE_CYCLE.findIndex((f) => f === current);
  // An unrecognised factor (an older log, a hand-edited backup) starts over
  // rather than sticking, so a strange value can still be cleared.
  return INTAKE_CYCLE[i === -1 ? 1 : (i + 1) % INTAKE_CYCLE.length];
}

/** What a factor says, in the dashboard's words. */
export function intakeLabel(factor: number | null): string {
  if (factor === null) return 'not answered';
  // Nearest option rather than a ladder of thresholds: the options are the
  // definition, so a threshold list would be the second place to keep in step.
  const nearest = INTAKE_OPTIONS.reduce((best, o) =>
    Math.abs(o.factor - factor) < Math.abs(best.factor - factor) ? o : best
  );
  return nearest.label.toLowerCase();
}

/** The strip has one cell per day, so each answer needs one character. */
export function intakeGlyph(factor: number | null): string {
  if (factor === null) return '';
  return INTAKE_OPTIONS.find((o) => o.label.toLowerCase() === intakeLabel(factor))?.glyph ?? '?';
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

/** The rise headline, named for the same reason as the stall's. */
const RISE_HEADLINE = 'The line has turned';

export function weeklyDecision(input: {
  stalled?: boolean;
  /** Whether the weight held or climbed. A rise gets its own headline. */
  direction?: 'held' | 'rising';
  /** How long the weight has held, so the decision can say it. */
  stalledDays?: number;
  newTarget?: number | null;
  breakDue?: boolean;
  deficitWeeks?: number;
  maintenanceKcal?: number | null;
  windowStart?: string | null;
  /**
   * How far off the measurement is, across all three of its conditions. The
   * decision used to take `intakeDays` alone, so after the eighth evening it
   * said "carry on" while the measurement was still impossible for want of
   * weigh-ins — and nothing in the app had ever asked for one.
   */
  ready?: {
    ready: boolean; intakeDays: number; weighIns: number; spanDays: number;
    need: 'intake' | 'weighins' | 'span' | null;
  };
  trendNote?: string;
}): Decision {
  const {
    stalled, direction = 'held', stalledDays = 0, newTarget, breakDue, deficitWeeks = 0, maintenanceKcal,
    windowStart, ready, trendNote = '',
  } = input;

  // A stall outranks everything: it is the thing that makes people quit. A
  // rise outranks it for the same reason and used to be ranked nowhere at all —
  // the screen said "Carry on" with a rising trend line printed underneath.
  if (stalled) {
    const rising = direction === 'rising';
    return {
      headline: rising ? RISE_HEADLINE : STALL_HEADLINE,
      action: newTarget ? `Eat ${newTarget} kcal this week.` : 'Answer a few more days so the new figure can be worked out.',
      why: stalledDays > 0
        ? `${stalledDays} days ${rising ? 'climbing' : 'holding'} at this intake means the deficit has `
          + `${rising ? 'gone the other way' : 'closed'}. The number changed, not your effort.`
        : `${rising ? 'Gaining' : 'Holding'} weight at this intake means the deficit has `
          + `${rising ? 'gone the other way' : 'closed'}. The number changed, not your effort.`,
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

  // Then the thing that unlocks everything else — whichever part of it is
  // actually missing, rather than the one part the old version knew about.
  if (ready && !ready.ready) {
    const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

    if (ready.need === 'weighins') {
      const short = 4 - ready.weighIns;
      return {
        headline: `${short} more ${plural(short, 'weigh-in', 'weigh-ins')}`,
        action: 'Step on the scale at the same time of day, before your first drink.',
        why: `You have ${Math.min(ready.intakeDays, 8)} of 8 evenings. The measurement also needs `
          + `4 weigh-ins across 10 days — you have ${ready.weighIns} across ${ready.spanDays}.`,
        premiumOnly: false,
      };
    }

    if (ready.need === 'span') {
      const short = 10 - ready.spanDays;
      return {
        headline: 'Keep weighing for another week',
        action: `${short} more ${plural(short, 'day', 'days')} between your first weigh-in and your last.`,
        why: `${ready.weighIns} weigh-ins in ${ready.spanDays} days is ${ready.weighIns} readings `
          + 'of roughly the same day. A body needs time to show a direction.',
        premiumOnly: false,
      };
    }

    const short = 8 - ready.intakeDays;
    return {
      headline: 'Answer the evening question',
      action: `${short} more ${plural(short, 'day', 'days')} and the app can measure what your body costs.`,
      why: 'One tap a day is the whole signal. Without it the target stays a formula.',
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
 * What was different about the weeks that worked.
 *
 * Every other reading here describes the present. This one is the only thing
 * the app can say that a person could not have worked out themselves, because
 * it needs months of their own log to exist at all.
 *
 * The wording is the whole risk, so the rules live here rather than in the
 * screen:
 *
 * - **Counting, never causation.** "In your four best weeks you trained four
 *   times" is a count. "Training four times a week works for you" is a claim
 *   about a mechanism from a sample of four, and this app does not make those.
 *   The self-check greps the produced sentence for causal words.
 * - **Nothing below the noise floor.** A difference of half a training day is
 *   arithmetic, not a finding. `readTrend` already refuses to narrate noise;
 *   this refuses for the same reason.
 * - **No recommendation in the return value.** What follows is for
 *   `weeklyDecision` or for the person. This function counts.
 */
export const BEST_MIN_WEEKS = 8;

/** Below these gaps the two groups are the same week told twice. */
const BEST_THRESHOLDS = { trainings: 1, planDays: 1, fasts: 1 };

type WeekStat = {
  monday: string;
  kgChange: number;
  trainings: number;
  planDays: number;
  fasts: number;
};

export type BestWeeks = {
  bestCount: number;
  restCount: number;
  /** At most two, each already above its threshold. */
  differences: string[];
  note: string;
} | null;

/** The Monday of the week a date falls in. */
function mondayOf(date: string): string {
  const d = parseISO(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return todayISO(d);
}

export function bestWeeks(
  intakeLog: unknown,
  weights: unknown,
  planHistory: unknown,
  fastLog: unknown,
  today: string = todayISO()
): BestWeeks {
  const weighed = (Array.isArray(weights) ? weights : [])
    .filter((w: any) => w && typeof w.date === 'string' && isFinite(w.weight_kg) && w.weight_kg > 0)
    .sort((a: any, b: any) => a.date.localeCompare(b.date)) as WeighIn[];

  const intake = (Array.isArray(intakeLog) ? intakeLog : []).filter(
    (e: any) => e && typeof e.date === 'string' && isFinite(e.factor)
  ) as { date: string; factor: number }[];

  const plans = (Array.isArray(planHistory) ? planHistory : [])
    .map((p: any) => (p && typeof p.date === 'string' ? p.date : null))
    .filter(Boolean) as string[];

  const fasts = dateSet(fastLog);

  // A week counts only when it can be measured: two weigh-ins to give it a
  // direction. A week without them is skipped, not treated as zero change.
  const byWeek = new Map<string, WeighIn[]>();
  for (const w of weighed) {
    if (w.date > today) continue;
    const k = mondayOf(w.date);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(w);
  }

  const stats: WeekStat[] = [];
  for (const [monday, ws] of [...byWeek.entries()].sort()) {
    if (ws.length < 2) continue;
    const days = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const d = parseISO(monday);
        d.setDate(d.getDate() + i);
        return todayISO(d);
      })
    );
    stats.push({
      monday,
      kgChange: ws[ws.length - 1].weight_kg - ws[0].weight_kg,
      trainings: new Set(plans.filter((d) => days.has(d))).size,
      // "Ate the plan or under" is what adherence means here; eating over is
      // not adherence, and the factor already says which happened.
      planDays: intake.filter((e) => days.has(e.date) && e.factor <= 1).length,
      fasts: [...days].filter((d) => fasts.has(d)).length,
    });
  }

  if (stats.length < BEST_MIN_WEEKS) {
    const missing = BEST_MIN_WEEKS - stats.length;
    return {
      bestCount: 0,
      restCount: 0,
      differences: [],
      note: `${missing} more week${missing === 1 ? '' : 's'} with two weigh-ins each and the app can `
        + `compare your best weeks against the rest.`,
    };
  }

  const ranked = [...stats].sort((a, b) => a.kgChange - b.kgChange);
  const bestCount = Math.max(2, Math.floor(ranked.length / 3));
  const best = ranked.slice(0, bestCount);
  const rest = ranked.slice(bestCount);
  if (rest.length < 2) return null;

  const mean = (xs: WeekStat[], key: keyof WeekStat) =>
    xs.reduce((s, x) => s + (x[key] as number), 0) / xs.length;
  const one = (n: number) => Math.round(n * 10) / 10;

  /**
   * Whether the plan history reaches back far enough to count sessions at all.
   *
   * `savePlan` keeps ten plans. At three a week that is barely three weeks, so
   * across a twelve-week comparison every older week has zero sessions by
   * storage rather than by behaviour — and the difference this function
   * reported was an artefact of the cap. The fast and intake logs hold 400
   * days and have no such problem.
   *
   * Not saying it beats saying something untrue, and it is the smaller change
   * than raising the cap, which would not give anyone back history already
   * dropped.
   */
  const oldestWeek = ranked.reduce((m, w) => (w.monday < m ? w.monday : m), ranked[0].monday);
  const oldestPlan = plans.length > 0 ? plans.reduce((m, d) => (d < m ? d : m)) : null;
  const plansCoverSpan = oldestPlan !== null && oldestPlan <= oldestWeek;

  const candidates: { gap: number; text: string }[] = [];
  const fields: [keyof typeof BEST_THRESHOLDS, keyof WeekStat, string][] = [
    ['trainings', 'trainings', 'sessions'],
    ['planDays', 'planDays', 'days on plan'],
    ['fasts', 'fasts', 'fasts logged'],
  ];
  for (const [threshold, key, word] of fields) {
    if (key === 'trainings' && !plansCoverSpan) continue;
    const a = mean(best, key);
    const b = mean(rest, key);
    const gap = Math.abs(a - b);
    if (gap < BEST_THRESHOLDS[threshold]) continue;
    candidates.push({ gap, text: `${one(a)} ${word} a week, against ${one(b)} in the others` });
  }

  candidates.sort((x, y) => y.gap - x.gap);
  const differences = candidates.slice(0, 2).map((c) => c.text);

  return {
    bestCount: best.length,
    restCount: rest.length,
    differences,
    note: differences.length === 0
      ? `Your best ${best.length} weeks and your other ${rest.length} look the same on everything the `
        + `app counts. Whatever made the difference is not in this log.`
      : `In your best ${best.length} weeks: ${differences.join('; ')}.`,
  };
}

/**
 * The log, written out for someone who is not the app.
 *
 * A doctor's appointment is the moment this data is worth most and reaches
 * least: it lives on the phone in charts nobody else can read. This is the
 * same numbers as plain text.
 *
 * It is a record, not a report. Every figure comes out of the logs passed in;
 * nothing here interprets, scores, or advises, and the one sentence that is not
 * a number says exactly that. A document that looked like a finding would be
 * worse than no document — a doctor would have to work out which parts an app
 * made up, and the answer has to be "none of it".
 *
 * Free, and not as a concession: this is data portability (Art. 20 GDPR), and
 * charging for the readable form of someone's own record would be absurd.
 */
export const SUMMARY_DISCLAIMER =
  'This is a self-kept log produced by an app, not a medical assessment. '
  + 'Nothing in it has been reviewed by a clinician.';

/** Circumstances where the protocol is not appropriate. Same list as the About page. */
export const SUMMARY_NOT_FOR = [
  'Pregnancy or breastfeeding',
  'Diabetes, particularly on insulin or sulfonylureas',
  'A history of disordered eating',
  'Medication for blood pressure or blood glucose',
  'Under 18',
];

export function healthSummary(input: {
  windowStart?: string | null;
  windowHours?: number | null;
  weights?: unknown;
  intakeLog?: unknown;
  fastLog?: unknown;
  today?: string;
}): string {
  const today = input.today ?? todayISO();

  const weighed = (Array.isArray(input.weights) ? input.weights : [])
    .filter((w: any) => w && typeof w.date === 'string' && isFinite(w.weight_kg) && w.weight_kg > 0)
    .sort((a: any, b: any) => a.date.localeCompare(b.date)) as WeighIn[];

  const intake = (Array.isArray(input.intakeLog) ? input.intakeLog : []).filter(
    (e: any) => e && typeof e.date === 'string' && isFinite(e.factor) && isFinite(e.target_kcal)
  ) as { date: string; factor: number; target_kcal: number }[];

  const fasts = [...dateSet(input.fastLog)].sort();

  const lines: string[] = [`# Self-kept log`, '', `Produced ${today}.`, ''];

  if (weighed.length === 0 && intake.length === 0 && fasts.length === 0) {
    // Zeroes would read as measurements. Nothing recorded is not "0 kg".
    lines.push('Nothing has been recorded yet, so there is nothing to report.', '');
    lines.push('## Please note', '', SUMMARY_DISCLAIMER, '');
    return lines.join('\n');
  }

  const dates = [...weighed.map((w) => w.date), ...intake.map((e) => e.date), ...fasts].sort();
  lines.push('## Period', '', `${dates[0]} to ${dates[dates.length - 1]}`, '');

  if (weighed.length > 0) {
    lines.push('## Weight', '');
    lines.push(`- First recorded: ${weighed[0].weight_kg} kg on ${weighed[0].date}`);
    lines.push(
      `- Most recent: ${weighed[weighed.length - 1].weight_kg} kg on ${weighed[weighed.length - 1].date}`
    );
    lines.push(`- Weigh-ins recorded: ${weighed.length}`);
    const t = weeklyTrend(weighed);
    // A single weigh-in, or several on one day, has no direction to state.
    if (t !== null) lines.push(`- Fitted trend: ${kg(t)} kg per week`);
    lines.push('');
  }

  if (intake.length > 0) {
    const avg = Math.round(intake.reduce((s, e) => s + e.factor * e.target_kcal, 0) / intake.length);
    lines.push('## Intake', '');
    lines.push(`- Days with an answer: ${intake.length}`);
    lines.push(`- Mean intake across those days: ${avg} kcal`);
    lines.push('- Recorded as a rough category per day, not a weighed diary.', '');
  }

  lines.push('## Eating schedule', '');
  lines.push(
    input.windowStart && input.windowHours
      ? `- One meal a day, in a ${input.windowHours}-hour window from ${input.windowStart}`
      : '- One meal a day'
  );
  lines.push(`- Days the fast was logged as completed: ${fasts.length}`, '');

  lines.push('## Please note', '', SUMMARY_DISCLAIMER, '');
  lines.push('The protocol is not appropriate in these circumstances:', '');
  for (const item of SUMMARY_NOT_FOR) lines.push(`- ${item}`);
  lines.push('');

  return lines.join('\n');
}

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
export type SellCard = 'measured' | 'months' | 'best' | 'outlook' | 'pattern' | 'cycle' | 'ahead';

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
const SELL_ORDER: SellCard[] = ['measured', 'months', 'best', 'outlook', 'pattern', 'cycle', 'ahead'];

export function progressCards(input: {
  premium: boolean;
  hasOutlook?: boolean;
  /** True once a maintenance figure actually exists to sell. */
  hasMeasured?: boolean;
  hasMonths?: boolean;
  hasPattern?: boolean;
  hasCycle?: boolean;
  hasAhead?: boolean;
  hasBest?: boolean;
}): ProgressCards {
  const { premium, hasOutlook, hasMeasured, hasMonths, hasPattern, hasCycle, hasAhead, hasBest } = input;
  const available: Record<SellCard, boolean> = {
    measured: !!hasMeasured,
    months: !!hasMonths,
    outlook: !!hasOutlook,
    pattern: !!hasPattern,
    cycle: !!hasCycle,
    ahead: !!hasAhead,
    best: !!hasBest,
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

  // What the day was aiming at and what it came to, for charting the two
  // against each other. Each day keeps its own target: the target moves as
  // someone gets lighter, so one figure applied to a whole week would draw a
  // gap that never happened.
  assert(iw[6].target === 2000 && iw[6].kcal === 2000, 'the plan eaten is the target itself');
  assert(iw[4].target === 2000 && iw[4].kcal === 1500, 'and a lighter day is less than it');
  assert(iw[5].target === null && iw[5].kcal === null, 'an unanswered day aimed at nothing');
  {
    const moved = intakeWeek([
      { date: TODAY, factor: 1, target_kcal: 1800 },
      { date: day(2), factor: 1, target_kcal: 2200 },
    ], TODAY);
    assert(moved[6].kcal === 1800 && moved[4].kcal === 2200,
      'two days on plan against different targets are different numbers');
    // An entry written before target_kcal was stored still counts as an answer;
    // it simply has nothing to chart.
    const old = intakeWeek([{ date: TODAY, factor: 1.3 }] as any, TODAY);
    assert(old[6].factor === 1.3, 'an entry without a target keeps its answer');
    assert(old[6].target === null && old[6].kcal === null, 'and reports no figure rather than a wrong one');
  }

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

  /** Shorthand for the readiness shape the decision reads. */
  const notReady = (
    need: 'intake' | 'weighins' | 'span',
    intakeDays: number, weighIns = 0, spanDays = 0
  ) => ({ ready: false, intakeDays, weighIns, spanDays, need });

  // Everything true at once: the stall must win.
  const all = weeklyDecision({
    stalled: true, newTarget: 1600, breakDue: true, deficitWeeks: 9,
    maintenanceKcal: 2300, windowStart: '20:15', ready: notReady('intake', 2),
  });
  assert(/maintenance has moved/.test(all.headline), `a stall outranks everything: ${all.headline}`);
  assert(/1600/.test(all.action), 'and carries the new number');

  const brk = weeklyDecision({
    breakDue: true, deficitWeeks: 9, maintenanceKcal: 2300,
    windowStart: '20:15', ready: notReady('intake', 2),
  });
  assert(/week at maintenance/.test(brk.headline), 'then the break');
  assert(/2300/.test(brk.action), 'with what to eat during it');

  const win = weeklyDecision({ windowStart: '20:15', ready: notReady('intake', 2) });
  assert(/eating window/.test(win.headline), 'then the window');
  assert(/20:15/.test(win.action), 'with the time to move it to');

  const needData = weeklyDecision({ ready: notReady('intake', 3) });
  assert(/evening question/.test(needData.headline), 'then the missing data');
  assert(/5 more days/.test(needData.action), `counted exactly: ${needData.action}`);
  assert(/1 more day\b/.test(weeklyDecision({ ready: notReady('intake', 7) }).action),
    'and singular at one');

  // The defect this branch was rewritten for. Eight evenings answered, never
  // once weighed: the old version said "carry on" and the measurement stayed
  // impossible, with nothing anywhere asking for a weigh-in.
  const noScale = weeklyDecision({ ready: notReady('weighins', 8, 1, 2) });
  assert(/weigh-in/.test(noScale.headline), `it asks for the scale: ${noScale.headline}`);
  assert(!/Carry on/.test(noScale.headline), 'and does not call the job done');
  assert(/3 more weigh-ins/.test(noScale.headline), `counted: ${noScale.headline}`);
  assert(/8 of 8 evenings/.test(noScale.why), `while crediting what is done: ${noScale.why}`);
  assert(/8 of 8 evenings/.test(weeklyDecision({ ready: notReady('weighins', 12, 1, 2) }).why),
    'and twelve evenings is still eight of eight, not twelve of eight');
  assert(/1 more weigh-in\b/.test(weeklyDecision({ ready: notReady('weighins', 8, 3, 9) }).headline),
    'singular at one there too');

  const noSpan = weeklyDecision({ ready: notReady('span', 8, 4, 3) });
  assert(/another week/.test(noSpan.headline), `a span shortfall asks for time: ${noSpan.headline}`);
  assert(/7 more days/.test(noSpan.action), `counted: ${noSpan.action}`);
  assert(/4 weigh-ins in 3 days/.test(noSpan.why), `it counts what is actually there: ${noSpan.why}`);
  assert(!/^Four/.test(noSpan.why), 'rather than saying "four" whatever the number is');

  const fine = weeklyDecision({
    ready: { ready: true, intakeDays: 14, weighIns: 5, spanDays: 14, need: null },
    trendNote: 'Down 0.4 kg a week.',
  });
  assert(/Carry on/.test(fine.headline), 'and nothing to change is a valid answer');
  assert(/0.4/.test(fine.why), 'backed by the trend rather than a platitude');
  // The copy drift the fourth intake option introduced.
  assert(!/three taps/i.test(needData.why), 'the signal is not described as three taps any more');

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
    weeklyDecision({ stalled: true, newTarget: 2200, breakDue: true, windowStart: '17:00',
      ready: notReady('intake', 0) })
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
  // --- the log, written out for someone who is not the app -----------------

  {
    const w = [
      { date: '2026-05-01', weight_kg: 95 },
      { date: '2026-05-15', weight_kg: 93.4 },
      { date: '2026-06-01', weight_kg: 91.2 },
    ];
    const eaten = [
      { date: '2026-05-02', factor: 1, target_kcal: 2000 },
      { date: '2026-05-03', factor: 0.75, target_kcal: 2000 },
    ];
    const text = healthSummary({
      windowStart: '18:00', windowHours: 2,
      weights: w, intakeLog: eaten, fastLog: ['2026-05-02', '2026-05-03', '2026-05-04'],
      today: '2026-06-02',
    });

    assert(/2026-05-01 to 2026-06-01/.test(text), `the period is stated: ${text.slice(0, 80)}`);
    assert(/95 kg on 2026-05-01/.test(text), 'with the first weight');
    assert(/91.2 kg on 2026-06-01/.test(text), 'and the most recent');
    assert(/Weigh-ins recorded: 3/.test(text), 'and how many there were');
    assert(/kg per week/.test(text), 'and the fitted trend');
    assert(/Days with an answer: 2/.test(text), 'the intake days are counted');
    assert(/1750 kcal/.test(text), `and averaged from the entries: ${text.match(/Mean[^\n]*/)}`);
    assert(/2-hour window from 18:00/.test(text), 'the schedule is described');
    assert(/completed: 3/.test(text), 'and the fasts counted');

    // The sentence without which the document would be dangerous.
    assert(text.includes(SUMMARY_DISCLAIMER), 'the disclaimer is present verbatim');
    for (const item of SUMMARY_NOT_FOR) {
      assert(text.includes(item), `the contraindication "${item}" is carried across`);
    }

    // A record, not a report. No judgement, no advice, no diagnosis.
    assert(
      !/\b(good|bad|excellent|poor|healthy|unhealthy|should|recommend|suggests?|indicates?|risk of|diagnos)/i
        .test(text.replace(SUMMARY_DISCLAIMER, '')),
      'nothing in it interprets or advises'
    );

    // Every figure has to trace back to the logs handed in, because a number
    // the app invented is the one thing a doctor could not check. Tested by
    // moving each input and requiring the document to move with it — a
    // whitelist of expected digits would pass just as happily on a constant.
    const moved = healthSummary({
      windowStart: '18:00', windowHours: 2,
      weights: w.map((x) => ({ ...x, weight_kg: x.weight_kg - 7 })),
      intakeLog: eaten.map((e) => ({ ...e, target_kcal: 2400 })),
      fastLog: ['2026-05-02'],
      today: '2026-06-02',
    });
    assert(/88 kg on 2026-05-01/.test(moved), 'a different weight log produces different weights');
    assert(!/95 kg/.test(moved), 'and the old figure is gone rather than cached');
    assert(/2100 kcal/.test(moved), `a different target produces a different mean: ${moved.match(/Mean[^\n]*/)}`);
    assert(/completed: 1/.test(moved), 'and a shorter fast log counts fewer fasts');
    // The mean is the arithmetic mean of what was passed, not a rounded guess.
    assert(
      /Mean intake across those days: 1750 kcal/.test(text),
      `(1 + 0.75) x 2000 / 2 = 1750: ${text.match(/Mean[^\n]*/)}`
    );

    // An empty log must not read as a measurement of zero.
    const blank = healthSummary({ today: '2026-06-02' });
    assert(/nothing to report/i.test(blank), 'an empty log says so');
    assert(!/0 kg|0 kcal/.test(blank), 'rather than printing zeroes as findings');
    assert(blank.includes(SUMMARY_DISCLAIMER), 'and still carries the disclaimer');

    // One weigh-in has no direction, and none is claimed.
    const single = healthSummary({ weights: [{ date: '2026-05-01', weight_kg: 95 }], today: '2026-06-02' });
    assert(/Weigh-ins recorded: 1/.test(single), 'a single weigh-in is reported');
    assert(!/per week/.test(single), 'but no trend is fitted from it');
  }

  // --- what was different about the weeks that worked ----------------------

  {
    const mon = (i: number) => {
      const d = new Date('2026-01-05T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i * 7);
      return d.toISOString().slice(0, 10);
    };
    const plus = (iso: string, n: number) => {
      const d = new Date(iso + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const NOW = plus(mon(11), 6);

    // Twelve weeks. The first four lose fast and train four times; the rest
    // lose slowly and train once. Nothing else differs.
    const weights: WeighIn[] = [];
    const plans: { date: string }[] = [];
    const intake: { date: string; factor: number }[] = [];
    let kg = 95;
    for (let i = 0; i < 12; i++) {
      const good = i < 4;
      weights.push({ date: mon(i), weight_kg: kg });
      kg -= good ? 0.8 : 0.1;
      weights.push({ date: plus(mon(i), 6), weight_kg: kg });
      for (let t = 0; t < (good ? 4 : 1); t++) plans.push({ date: plus(mon(i), t) });
      for (let d = 0; d < 7; d++) intake.push({ date: plus(mon(i), d), factor: 1 });
    }

    const r = bestWeeks(intake, weights, plans, [], NOW)!;
    assert(r !== null, 'twelve measured weeks are enough to compare');
    assert(r.bestCount === 4, `the best third is four weeks: ${r.bestCount}`);
    assert(r.restCount === 8, `and the rest is eight: ${r.restCount}`);
    assert(r.differences.length === 1, `only the difference that exists is named: ${r.differences}`);
    assert(/4 sessions a week, against 1/.test(r.note), `and it is the sessions: ${r.note}`);
    // The point of the threshold: adherence was identical, so it is not named.
    assert(!/days on plan/.test(r.note), 'a field with no gap is left out');

    // The rule the whole function stands on. A count is not a mechanism, and
    // this app does not turn four weeks into a claim about anyone's body.
    const CAUSAL = /\b(because|causes?|caused|leads? to|results? in|due to|thanks to|proves?|works for you|makes? you)\b/i;
    assert(!CAUSAL.test(r.note), `no causal word in the sentence: ${r.note}`);
    assert(!/should|must|try to|recommend/i.test(r.note), 'and no instruction either');
    // Proof the guard can fail, so a future rewording cannot slip past it.
    assert(CAUSAL.test('training four times causes faster loss'), 'the causal guard actually matches');

    // The defect the guard exists for. savePlan keeps ten plans, so on a real
    // device the oldest weeks have no sessions recorded whatever happened in
    // them — the reported difference would be a storage artefact.
    const capped = plans.slice(-10);
    const truncated = bestWeeks(intake, weights, capped, [], NOW)!;
    assert(truncated !== null, 'a truncated plan history still produces a comparison');
    assert(
      !truncated.differences.some((d) => /sessions/.test(d)),
      `sessions are not counted when the history cannot see them: ${truncated.differences}`
    );
    // And the counter-example, so the guard cannot pass by finding nothing.
    assert(
      r.differences.some((d) => /sessions/.test(d)),
      'while a history that does cover the span still names them'
    );
    assert(capped.length < plans.length, 'the fixture really is truncated');

    // Not enough weeks: it says how many are missing rather than comparing two.
    const thin = bestWeeks(intake.slice(0, 21), weights.slice(0, 6), plans, [], NOW)!;
    assert(thin.differences.length === 0, 'three weeks name no differences');
    assert(/5 more weeks/.test(thin.note), `and count what is missing: ${thin.note}`);

    // A week with one weigh-in cannot be placed, and is skipped rather than
    // counted as no change — which would drag it into the "best" group.
    const oneEach = weights.filter((_, i) => i % 2 === 0);
    assert(/more weeks/.test(bestWeeks(intake, oneEach, plans, [], NOW)!.note),
      'a week with a single weigh-in does not count as a measured week');

    // Twelve identical weeks: nothing to say, and it says that rather than
    // inventing a difference out of rounding.
    const flat: WeighIn[] = [];
    const flatPlans: { date: string }[] = [];
    for (let i = 0; i < 12; i++) {
      flat.push({ date: mon(i), weight_kg: 90 - i * 0.2 });
      flat.push({ date: plus(mon(i), 6), weight_kg: 90 - i * 0.2 - 0.2 });
      flatPlans.push({ date: plus(mon(i), 1) }, { date: plus(mon(i), 3) });
    }
    const same = bestWeeks(intake, flat, flatPlans, [], NOW)!;
    assert(same.differences.length === 0, 'identical weeks produce no finding');
    assert(/not in this log/.test(same.note), `and the sentence admits it: ${same.note}`);
    assert(!CAUSAL.test(same.note), 'including in the empty case');

    // At most two, however many clear the threshold.
    const fasts: string[] = [];
    for (let i = 0; i < 4; i++) for (let d = 0; d < 6; d++) fasts.push(plus(mon(i), d));
    const three = bestWeeks(
      intake.map((e) => ({ ...e, factor: e.date < mon(4) ? 1 : 1.4 })),
      weights, plans, fasts, NOW
    )!;
    assert(three.differences.length === 2, `never more than two are named: ${three.differences.length}`);
    assert(!CAUSAL.test(three.note), 'and still no causal word');

    assert(bestWeeks([], [], [], [], NOW)!.differences.length === 0, 'an empty log finds nothing');
    assert(/8 more weeks/.test(bestWeeks([], [], [], [], NOW)!.note), 'and asks for all eight');
  }

  // The strip has to be able to take an answer back, not only give one.
  assert(nextIntakeFactor(null) === 1, 'an untouched day becomes the plan');
  assert(nextIntakeFactor(1) === 0.75, 'then less');
  assert(nextIntakeFactor(0.75) === 0.4, 'then the day that was barely eaten at all');
  assert(nextIntakeFactor(0.4) === 1.3, 'then over');
  assert(nextIntakeFactor(1.3) === 1.7, 'then the answer the scale used to have no room for');
  assert(nextIntakeFactor(1.7) === 2.4, 'then the one it still had no room for');
  assert(nextIntakeFactor(2.4) === null, 'and then it is cleared again');
  assert(nextIntakeFactor(0.42) === 1, 'an unknown factor rejoins the cycle rather than sticking');
  {
    // A full lap returns a day to where it started, whatever it started as.
    for (const start of INTAKE_CYCLE) {
      let f = start;
      for (let i = 0; i < INTAKE_CYCLE.length; i++) f = nextIntakeFactor(f);
      assert(f === start, `a full lap is a round trip from ${start}`);
    }
  }
  assert(intakeLabel(null) === 'not answered', 'an empty day says so');
  for (const o of INTAKE_OPTIONS) {
    assert(intakeLabel(o.factor) === o.label.toLowerCase(), `${o.label} reads back as itself`);
    assert(intakeGlyph(o.factor).length > 0, `${o.label} has a mark in the strip`);
  }
  assert(
    new Set(INTAKE_OPTIONS.map((o) => intakeGlyph(o.factor))).size === INTAKE_OPTIONS.length,
    'and every mark is told apart'
  );
  assert(intakeGlyph(null) === '', 'an unanswered day has no mark');
  // The cap that made the log lie, at both ends. Recording a day at three times
  // the target as "a lot more" pushes the measured maintenance down and the
  // target with it; recording a day barely eaten as "ate less" pushes it up.
  assert(
    Math.max(...INTAKE_OPTIONS.map((o) => o.factor)) >= 2.4,
    'there is an answer for a day that really ran away'
  );
  assert(
    Math.min(...INTAKE_OPTIONS.map((o) => o.factor)) <= 0.4,
    'and one for a day that barely happened'
  );
  // The bias itself, as arithmetic rather than as a comment. Three days at
  // three times a 2,000 target: capped at 1.7 the log reports 3,400 a day,
  // 1,400 short of what was eaten — and the measurement is built on that mean.
  {
    const real = 3 * 2000;
    const capped = 1.7 * 2000;
    const now = 2.4 * 2000;
    assert(capped < now && now < real, 'the wider option is closer to the day without reaching it');
    assert(real - now < (real - capped) / 2, 'and it closes more than half the gap the old cap left');
  }

  // The labels are computed from the target, not written down for one target.
  assert(intakeKcal(1, 2000) === 2000, 'the plan is the target');
  assert(intakeKcal(0.75, 2000) === 1500, 'a quarter under is a quarter under');
  assert(intakeKcal(1.7, 2000) === 3400, 'and a lot more is a lot more');
  assert(intakeKcal(1.7, 2500) === 4250, 'a different target gives a different number');
  assert(intakeKcal(2.4, 2000) === 4800, 'and well over double is well over double');
  assert(intakeKcal(0.4, 2000) === 800, 'a day barely eaten is a small number, not a quarter under');
  assert(intakeKcal(1, 0) === 0 && intakeKcal(NaN, 2000) === 0, 'nonsense in, zero out');
  // Older logs still read. Every factor the app has ever written stays a valid
  // answer, because intakeLabel snaps to the nearest option rather than to a
  // list of thresholds that would have to be migrated.
  assert(intakeLabel(1.3) === 'ate more', 'entries written before the fourth option still read back');
  assert(intakeLabel(1.7) === 'a lot more', 'and entries written before the sixth');
  assert(intakeLabel(0.75) === 'ate less', 'a three-quarter day is not swallowed by the new floor');

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
    'and the cycle beats the planner when both are there'
  );
  assert(
    progressCards({ premium: false, hasBest: true, hasPattern: true }).sell === 'best',
    'eight weeks of the user own history outrank a weekday average'
  );
  assert(
    progressCards({ premium: false, hasAhead: true }).sell === 'ahead',
    'the exception-day planner sells only when nothing else can'
  );
  assert(progressCards({ premium: false }).sell === null, 'nothing available means nothing sold');
  // The ranking must cover every card, or a new one silently never sells.
  assert(
    SELL_ORDER.length === new Set(SELL_ORDER).size,
    'each card appears in the ranking exactly once'
  );

  return 'review.ts: all checks passed';
}
