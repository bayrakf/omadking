/**
 * The day as a list of moments.
 *
 * The dashboard timeline, the meal-prep loop and the scheduled reminders are
 * three surfaces for one piece of information: what happens today, and when.
 * Building it three times would guarantee they drift apart, so it is built here
 * once — pure, no React, no storage — and consumed everywhere else.
 *
 * Every moment is stored as an **offset in minutes from the eating window
 * opening**, not as a clock time. Clock times cannot be ordered correctly once
 * a window crosses midnight (a 23:00–01:00 window closes at a "smaller" number
 * than it opens), and cooking happens *before* the window, so raw
 * minutes-of-day sorting puts it at the wrong end of the day.
 */

import { fromMinutes, toMinutes, type UserProfile } from './nutrition';

const DAY = 1440;
const mod = (n: number) => ((n % DAY) + DAY) % DAY;

/**
 * How long after the window closes the day still counts as the current cycle.
 * Without this the cycle ended at the close, so the half hour in which the
 * fast is meant to be logged was already attributed to tomorrow and the
 * reminder could never come up as `next`.
 */
const LOG_TAIL_MIN = 30;

export type AgendaKind = 'cook' | 'window_open' | 'snack' | 'meal' | 'window_close' | 'log_fast';

export type AgendaItem = {
  kind: AgendaKind;
  /** HH:MM, for display */
  at: string;
  /** minutes relative to the window opening; negative means before it */
  offset: number;
  title: string;
  body: string;
  /** already happened in the current cycle */
  past: boolean;
  /** only `cook` and `log_fast` can be ticked off */
  actionable: boolean;
  done: boolean;
};

/**
 * Structural, so `MealPlan` satisfies it without agenda.ts depending on the
 * network layer — that keeps this module runnable in plain node for `demo()`.
 */
export type PlanLike = {
  main_meal_time: string;
  pre_training_snack_time: string | null;
  total_kcal: number;
  protein_g: number;
  timing_pattern: 'pre' | 'post' | 'overlap';
  recipe: { prep_time_min: number | null };
};

export type AgendaState = { cooked: boolean; fastLogged: boolean };

/** Minutes of lead time before the meal that cooking needs. */
function cookLead(plan: PlanLike): number {
  const prep = plan.recipe?.prep_time_min;
  // 10 minutes of slack so "ready at" means ready, not still in the pan.
  return (typeof prep === 'number' && isFinite(prep) && prep > 0 ? prep : 30) + 10;
}

/**
 * Where `now` sits in the current cycle, as an offset from the window opening.
 * Negative while fasting toward the next opening, 0..windowLength inside it.
 */
export function nowOffset(profile: UserProfile, now: Date = new Date()): number {
  const windowStart = toMinutes(profile.omad_window_start);
  const windowLen = profile.omad_window_hours * 60;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const since = mod(nowMin - windowStart);
  // Past the whole agenda means the next opening is what matters, so count
  // down to it as a negative offset.
  return since <= windowLen + LOG_TAIL_MIN ? since : since - DAY;
}

export function dayAgenda(
  profile: UserProfile,
  plan: PlanLike | null,
  state: AgendaState = { cooked: false, fastLogged: false },
  now: Date = new Date()
): { items: AgendaItem[]; next: AgendaItem | null } {
  const windowStart = toMinutes(profile.omad_window_start);
  const windowLen = profile.omad_window_hours * 60;
  const fastHours = Math.round(((DAY - windowLen) / 60) * 10) / 10;
  const current = nowOffset(profile, now);

  const raw: Omit<AgendaItem, 'at' | 'past'>[] = [];

  // Meal sits inside the window by construction in mealTiming().
  const mealOffset = plan ? mod(toMinutes(plan.main_meal_time) - windowStart) : 0;

  if (plan) {
    const lead = cookLead(plan);
    raw.push({
      kind: 'cook',
      offset: mealOffset - lead,
      title: 'Start cooking',
      body: `${lead - 10} min prep, ready for ${plan.main_meal_time}`,
      actionable: true,
      done: state.cooked,
    });
  }

  if (plan?.pre_training_snack_time) {
    const snackMin = toMinutes(plan.pre_training_snack_time);
    // The pattern tells us which side of the window training is on. Without it
    // a snack 14h before the window is indistinguishable from one 10h after.
    const offset =
      plan.timing_pattern === 'post' ? -mod(windowStart - snackMin) : mod(snackMin - windowStart);
    raw.push({
      kind: 'snack',
      offset,
      title: 'Pre-training snack',
      body: '20–30g fast carbs plus sodium, to protect output',
      actionable: false,
      done: false,
    });
  }

  raw.push({
    kind: 'window_open',
    offset: 0,
    title: 'Window opens',
    // Without a plan this *is* the meal moment, so it carries that meaning
    // rather than printing a second row at the identical time.
    body: plan ? `${fastHours}h fast ends` : 'Break the fast',
    actionable: false,
    done: false,
  });

  if (plan) {
    raw.push({
      kind: 'meal',
      offset: mealOffset,
      title: 'Main meal',
      body: `${plan.total_kcal} kcal · ${plan.protein_g}g protein`,
      actionable: false,
      done: false,
    });
  }

  raw.push({
    kind: 'window_close',
    offset: windowLen,
    title: 'Window closes',
    body: `Last bite — ${fastHours}h fast starts`,
    actionable: false,
    done: false,
  });

  raw.push({
    kind: 'log_fast',
    offset: windowLen + LOG_TAIL_MIN,
    title: 'Log the fast',
    body: 'Keeps the streak honest',
    actionable: true,
    done: state.fastLogged,
  });

  const items: AgendaItem[] = raw
    .sort((a, b) => a.offset - b.offset)
    .map((i) => ({
      ...i,
      at: fromMinutes(windowStart + i.offset),
      past: i.offset < current,
    }));

  const next = items.find((i) => !i.past && !i.done) ?? null;
  return { items, next };
}

/** Minutes until an item, from now. Negative once it has passed. */
export function minutesUntil(item: AgendaItem, profile: UserProfile, now: Date = new Date()): number {
  return item.offset - nowOffset(profile, now);
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const profile = {
    weight_kg: 82, height_cm: 183, age: 34,
    sex: 'male', fitness_level: 'advanced', goal: 'muscle_gain',
    omad_window_start: '18:00', omad_window_hours: 2, default_training_time: '19:00',
  } as UserProfile;

  const plan: PlanLike = {
    main_meal_time: '18:30',
    pre_training_snack_time: null,
    total_kcal: 3300,
    protein_g: 164,
    timing_pattern: 'post',
    recipe: { prep_time_min: 35 },
  };

  const at = (h: number, m = 0) => new Date(2026, 7, 5, h, m, 0);

  // Order is the day's real sequence, not clock-number order.
  const { items } = dayAgenda(profile, plan, { cooked: false, fastLogged: false }, at(12));
  const kinds = items.map((i) => i.kind);
  assert(
    JSON.stringify(kinds) === JSON.stringify(['cook', 'window_open', 'meal', 'window_close', 'log_fast']),
    'sequence is cook -> open -> meal -> close -> log, got ' + kinds.join(',')
  );

  // Cooking starts prep+10 before the meal.
  const cook = items.find((i) => i.kind === 'cook')!;
  assert(cook.at === '17:45', `cook at 17:45 for a 35min recipe, got ${cook.at}`);
  assert(cook.offset < 0, 'cook happens before the window opens');

  // Without a plan there is nothing to cook.
  const noPlan = dayAgenda(profile, null, { cooked: false, fastLogged: false }, at(12));
  assert(!noPlan.items.some((i) => i.kind === 'cook'), 'no plan means no cook step');
  assert(!noPlan.items.some((i) => i.kind === 'meal'), 'no plan means the opening carries the meal, not a duplicate row');
  assert(noPlan.items.find((i) => i.kind === 'window_open')!.body === 'Break the fast', 'opening says what to do when there is no plan');

  // `next` skips what has already happened.
  assert(dayAgenda(profile, plan, { cooked: false, fastLogged: false }, at(12)).next!.kind === 'cook', 'midday: cook is next');
  assert(dayAgenda(profile, plan, { cooked: false, fastLogged: false }, at(18, 10)).next!.kind === 'meal', 'just after opening: meal is next');
  assert(dayAgenda(profile, plan, { cooked: false, fastLogged: false }, at(19, 30)).next!.kind === 'window_close', 'late in window: close is next');

  // ...and what has been ticked off.
  const cooked = dayAgenda(profile, plan, { cooked: true, fastLogged: false }, at(12));
  assert(cooked.next!.kind === 'window_open', 'cooked already: next is the opening');
  const allDone = dayAgenda(profile, plan, { cooked: true, fastLogged: true }, at(23));
  assert(allDone.next !== null, 'there is always a next cycle');
  assert(!allDone.items.some((i) => i.past), 'late at night the whole agenda is ahead again');

  // The half hour after the close belongs to today, so the fast can be logged.
  const justClosed = dayAgenda(profile, plan, { cooked: true, fastLogged: false }, at(20, 15));
  assert(justClosed.next!.kind === 'log_fast', 'log is reachable right after the close, got ' + justClosed.next!.kind);
  assert(justClosed.items.find((i) => i.kind === 'window_close')!.past, 'close is past at 20:15');

  // Past flags follow the clock.
  const evening = dayAgenda(profile, plan, { cooked: false, fastLogged: false }, at(19));
  assert(evening.items.find((i) => i.kind === 'cook')!.past, 'cook is past by 19:00');
  assert(!evening.items.find((i) => i.kind === 'log_fast')!.past, 'log is not past by 19:00');

  // Fasted morning session: the snack is hours BEFORE a late window, and must
  // sort first rather than being read as "later today".
  const morning: PlanLike = { ...plan, pre_training_snack_time: '05:15', timing_pattern: 'post' };
  const m = dayAgenda(profile, morning, { cooked: false, fastLogged: false }, at(4));
  assert(m.items[0].kind === 'snack', 'early fasted snack sorts first, got ' + m.items[0].kind);
  assert(m.items.find((i) => i.kind === 'snack')!.at === '05:15', 'snack keeps its clock time');

  // Training inside the window: the snack sits after the opening.
  const overlap: PlanLike = { ...plan, pre_training_snack_time: '18:30', timing_pattern: 'overlap', main_meal_time: '19:20' };
  const o = dayAgenda(profile, overlap, { cooked: false, fastLogged: false }, at(12));
  assert(o.items.find((i) => i.kind === 'snack')!.offset > 0, 'overlap snack is inside the window');

  // A window crossing midnight must not scramble the order.
  const late = { ...profile, omad_window_start: '23:00', omad_window_hours: 2 } as UserProfile;
  const latePlan: PlanLike = { ...plan, main_meal_time: '23:30' };
  const l = dayAgenda(late, latePlan, { cooked: false, fastLogged: false }, at(22));
  const lk = l.items.map((i) => i.kind);
  assert(
    JSON.stringify(lk) === JSON.stringify(['cook', 'window_open', 'meal', 'window_close', 'log_fast']),
    'midnight-crossing window keeps its order, got ' + lk.join(',')
  );
  assert(l.items.find((i) => i.kind === 'window_close')!.at === '01:00', 'close wraps past midnight');
  assert(l.items.find((i) => i.kind === 'log_fast')!.at === '01:30', 'log wraps past midnight');

  // nowOffset: inside the window is positive, fasting counts down as negative.
  assert(nowOffset(profile, at(19)) === 60, 'one hour into the window');
  assert(nowOffset(profile, at(17)) === -60, 'one hour before opening');
  assert(nowOffset(profile, at(21)) < -1000, 'just after close is a long way from the next opening');

  // minutesUntil is the countdown a reminder would use.
  assert(minutesUntil(cook, profile, at(17, 15)) === 30, 'thirty minutes until cooking');

  // A recipe without a prep time still yields a sane cook step.
  const noPrep = dayAgenda(profile, { ...plan, recipe: { prep_time_min: null } }, { cooked: false, fastLogged: false }, at(12));
  assert(noPrep.items.find((i) => i.kind === 'cook')!.at === '17:50', 'missing prep time falls back to 30min');

  return 'agenda.ts: all checks passed';
}
