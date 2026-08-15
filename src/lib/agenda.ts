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
import { t, type Lang } from './i18n';

const DAY = 1440;
const mod = (n: number) => ((n % DAY) + DAY) % DAY;

/**
 * How long after the window closes the day still counts as the current cycle.
 * Without this the cycle ended at the close, so the half hour in which the
 * fast is meant to be logged was already attributed to tomorrow and the
 * reminder could never come up as `next`.
 */
const LOG_TAIL_MIN = 30;

/**
 * The day as one 24-hour strip, for drawing rather than for listing.
 *
 * Everything else here is ordered by offset from the window opening, which is
 * the only ordering that survives a window crossing midnight. A strip has the
 * opposite requirement: it is read against the clock, so it needs positions on
 * a midnight-to-midnight axis — and that is exactly where a 23:00 window has to
 * become two pieces, one at each end.
 *
 * Fractions rather than minutes, so the renderer multiplies by its own width
 * and no layout arithmetic leaks into a component.
 */
export type BandSegment = { from: number; to: number };

export function windowSegments(startMin: number, lengthMin: number): BandSegment[] {
  const len = Math.max(0, Math.min(DAY, lengthMin));
  if (len === 0) return [];
  if (len >= DAY) return [{ from: 0, to: 1 }];

  const start = mod(startMin);
  const end = start + len;
  if (end <= DAY) return [{ from: start / DAY, to: end / DAY }];

  // Wraps midnight: the tail of today and the head of tomorrow are the same
  // window, drawn as two pieces at opposite ends of the same strip.
  return [
    { from: start / DAY, to: 1 },
    { from: 0, to: (end - DAY) / DAY },
  ];
}

/** Where a moment sits on that strip. `offset` is relative to the opening. */
export function bandPosition(startMin: number, offsetMin: number): number {
  return mod(startMin + offsetMin) / DAY;
}

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
  now: Date = new Date(),
  /**
   * Defaulted here, unlike the model calls.
   *
   * These are labels the app writes for itself, so a caller that forgets shows
   * English rows on a German screen — visible, and fixed by looking. A recipe
   * in the wrong language costs a model call and is not visible until it
   * arrives, which is why that one is required and this one is not.
   */
  lang: Lang = 'en'
): { items: AgendaItem[]; next: AgendaItem | null } {
  const windowStart = toMinutes(profile.omad_window_start);
  const windowLen = profile.omad_window_hours * 60;
  const fastHours = Math.round(((DAY - windowLen) / 60) * 10) / 10;
  const current = nowOffset(profile, now);

  const raw: Omit<AgendaItem, 'at' | 'past'>[] = [];

  /**
   * Meal sits inside the window by construction in `mealTiming()` — but only
   * against the window it was built for, and a saved plan outlives that.
   *
   * Move the opening from 18:00 to 19:00 and yesterday's 18:30 meal is no
   * longer 30 minutes into the window; `mod` reads it as 23.5 hours into the
   * next one. The row then sorted after "Log the fast", printed cooking at
   * 17:50 below a 21:30 entry, and `next` could point at a meal a day away.
   *
   * A plan that no longer fits its window is placed at the opening, which is
   * where `mealTiming()` would put a fresh one.
   */
  const plannedOffset = plan ? mod(toMinutes(plan.main_meal_time) - windowStart) : 0;
  const mealOffset = plannedOffset > windowLen ? 0 : plannedOffset;

  if (plan) {
    const lead = cookLead(plan);
    raw.push({
      kind: 'cook',
      offset: mealOffset - lead,
      title: t(lang, 'agenda.cook'),
      body: t(lang, 'agenda.cookBody', { min: lead - 10, time: plan.main_meal_time }),
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
      title: t(lang, 'agenda.snack'),
      body: t(lang, 'agenda.snackBody'),
      actionable: false,
      done: false,
    });
  }

  raw.push({
    kind: 'window_open',
    offset: 0,
    title: t(lang, 'agenda.open'),
    // Without a plan this *is* the meal moment, so it carries that meaning
    // rather than printing a second row at the identical time.
    body: plan ? t(lang, 'agenda.openBody', { hours: fastHours }) : t(lang, 'agenda.openBodyNoPlan'),
    actionable: false,
    done: false,
  });

  if (plan) {
    raw.push({
      kind: 'meal',
      offset: mealOffset,
      title: t(lang, 'agenda.meal'),
      body: t(lang, 'agenda.mealBody', { kcal: plan.total_kcal, protein: plan.protein_g }),
      actionable: false,
      done: false,
    });
  }

  raw.push({
    kind: 'window_close',
    offset: windowLen,
    title: t(lang, 'agenda.close'),
    body: t(lang, 'agenda.closeBody', { hours: fastHours }),
    actionable: false,
    done: false,
  });

  raw.push({
    kind: 'log_fast',
    offset: windowLen + LOG_TAIL_MIN,
    title: t(lang, 'agenda.log'),
    body: t(lang, 'agenda.logBody'),
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

  // --- the strip ------------------------------------------------------------
  //
  // The band is read against the clock, so a window that crosses midnight has
  // to come back as two pieces. Getting this wrong draws a bar that runs
  // backwards across the whole day, which is the failure this exists to catch.
  {
    const noon = windowSegments(12 * 60, 120);
    assert(noon.length === 1, 'a window inside one day is one piece');
    assert(Math.abs(noon[0].from - 0.5) < 1e-9, 'starting at noon starts at half way');
    assert(Math.abs(noon[0].to - 0.5 - 120 / 1440) < 1e-9, 'and runs its own length');

    const late = windowSegments(23 * 60, 120);
    assert(late.length === 2, 'a window over midnight is two pieces');
    assert(late[0].to === 1 && late[1].from === 0, 'meeting at the ends of the strip');
    const drawn = (late[0].to - late[0].from) + (late[1].to - late[1].from);
    assert(Math.abs(drawn - 120 / 1440) < 1e-9, `and together they are its length: ${drawn}`);

    assert(windowSegments(0, 0).length === 0, 'a window of no length is not drawn');
    assert(windowSegments(60, 5000)[0].to === 1, 'a window longer than a day fills it');
    assert(windowSegments(-60, 60)[0].from === 23 / 24, 'a negative start wraps rather than escapes');

    for (const s of [...noon, ...late]) {
      assert(s.from >= 0 && s.to <= 1 && s.from < s.to, `every piece stays on the strip: ${JSON.stringify(s)}`);
    }

    // Moments land where the clock says, including the ones before the opening.
    assert(bandPosition(18 * 60, 0) === 0.75, 'the opening sits at its own clock time');
    assert(bandPosition(18 * 60, 60) === 19 / 24, 'an hour later is an hour along');
    assert(bandPosition(0, -60) === 23 / 24, 'and an hour before midnight is the far end');
  }

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

  // A plan kept from before the window moved. Its 18:30 meal is half an hour
  // *before* a 19:00 opening, which mod() reads as 23.5 hours after it — the
  // meal then sorted last, cooking printed at 17:50 under a 21:30 row, and
  // `next` offered a meal a day out.
  const moved = { ...profile, omad_window_start: '19:00' } as UserProfile;
  const stale = dayAgenda(moved, plan, { cooked: false, fastLogged: false }, at(12));
  const staleKinds = stale.items.map((i) => i.kind);
  assert(
    JSON.stringify(staleKinds) === JSON.stringify(['cook', 'window_open', 'meal', 'window_close', 'log_fast']),
    'a plan older than the window still reads in order, got ' + staleKinds.join(',')
  );
  assert(
    stale.items.find((i) => i.kind === 'meal')!.at === '19:00',
    'a meal that no longer fits the window falls back to the opening, got ' + stale.items.find((i) => i.kind === 'meal')!.at
  );

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
