/**
 * Which onboarding screens a given person will actually see.
 *
 * The flow is not the same length for everyone: the target-weight-and-rate
 * screen means nothing to someone maintaining or gaining, so it is skipped.
 * The counter and the progress bar were both computed from the fixed total
 * instead, which made them say two untrue things at once — the numbers jumped
 * (04 straight to 06) and the denominator promised a screen that would never
 * be shown.
 *
 * It is a small lie, and this app is built on not telling those. A progress
 * indicator exists to answer "how much longer", and the honest answer changes
 * when an answer changes the path. It moves at the moment the goal is chosen,
 * which is the moment the person caused it — visible cause, visible effect.
 */

/** Total screens in the flow, including the intro and the summary. */
export const STEPS = 6;

/** The one screen that does not apply to everyone. */
const TARGET_STEP = 4;

export function skipsStep(index: number, goal: string | null): boolean {
  return index === TARGET_STEP && goal !== 'weight_loss';
}

/** The screen indices this person walks, in order. */
export function onboardingPath(goal: string | null): number[] {
  return Array.from({ length: STEPS }, (_, i) => i).filter((i) => !skipsStep(i, goal));
}

export type StepPosition = { position: number; total: number };

/**
 * Where this screen sits in this person's flow, one-based.
 *
 * A step that is being skipped has no position of its own; it reports the place
 * it would occupy, so a transient render during navigation cannot show a zero.
 */
export function stepPosition(step: number, goal: string | null): StepPosition {
  const path = onboardingPath(goal);
  const at = path.indexOf(step);
  return {
    position: at === -1 ? Math.min(path.length, step) : at + 1,
    total: path.length,
  };
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const losing = onboardingPath('weight_loss');
  const gaining = onboardingPath('muscle_gain');

  assert(losing.length === STEPS, 'someone losing weight sees every screen');
  assert(gaining.length === STEPS - 1, 'everyone else sees one fewer');
  assert(!gaining.includes(TARGET_STEP), 'and the one they skip is the target screen');

  // The defect this exists to prevent: a counter that jumps a number, and a
  // total that promises a screen nobody will be shown.
  // null is the real state before the goal question is answered, not a
  // theoretical one — the screen holds it that way.
  for (const goal of ['weight_loss', 'muscle_gain', 'performance', '', null]) {
    const path = onboardingPath(goal);
    const seen = path.map((i) => stepPosition(i, goal));
    assert(
      seen.every((p, i) => p.position === i + 1),
      `${goal || 'unanswered'}: positions run 1..n without a gap: ${seen.map((p) => p.position)}`
    );
    assert(
      seen.every((p) => p.total === path.length),
      `${goal || 'unanswered'}: the total is the number of screens actually walked`
    );
    assert(seen[seen.length - 1].position === seen[0].total, `${goal || 'unanswered'}: the last screen is the last`);
  }

  // Before the goal is answered the flow is the shorter one, and choosing to
  // lose weight lengthens it. That is a real change caused by a real answer,
  // not a glitch — the alternative is promising a screen and then not showing
  // it, which is the thing being fixed.
  assert(onboardingPath('').length === STEPS - 1, 'an unanswered goal reads as the shorter path');
  assert(onboardingPath(null).length === STEPS - 1, 'and so does one that was never set');
  assert(
    onboardingPath('weight_loss').length > onboardingPath('').length,
    'and choosing to lose weight adds the screen that only then applies'
  );

  assert(stepPosition(0, 'weight_loss').position === 1, 'the intro is the first screen');
  assert(stepPosition(TARGET_STEP, 'muscle_gain').position <= STEPS, 'a skipped step reports no impossible position');

  return 'onboarding.ts: all checks passed';
}
