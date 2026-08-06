/**
 * What Premium actually buys, as data.
 *
 * This exists because the paywall drifted from the code and nobody noticed. It
 * advertised session-aware macros, reheat instructions and unlimited coaching —
 * all three of which the free plan has always done. Only the plan quota was
 * real. Charging for something the user already has is the kind of claim that
 * gets an app pulled, and prose in a screen has no way to catch it.
 *
 * So the offer is an inventory, each claim is tied to the gate that enforces it,
 * and the self-check below refuses any claim that names a known-free feature.
 * If a gate is ever removed from the code, the claim it backs has to be removed
 * from here too, or the check fails.
 */

/** Where a claim is actually enforced. Every claim must name one. */
export type Gate =
  /** `isPremium()` read on Progress before the measured figure is shown. */
  | 'progress_measured'
  /** `isPremium()` read before the forecast's answer is shown. */
  | 'progress_forecast'
  /** `getQuota()` / `consumeQuota()` in the planner. */
  | 'plan_quota';

export type Claim = {
  title: string;
  body: string;
  gate: Gate;
};

/**
 * Ordered as an argument, not as a feature grid: what the app measured comes
 * first, because it is the thing a formula cannot give them. The quota is last
 * because it is a limit being lifted, not a capability being gained.
 */
export const PREMIUM_CLAIMS: Claim[] = [
  {
    title: 'What your body actually costs',
    body: 'Your maintenance measured from your own eating and weigh-ins, not estimated from a formula.',
    gate: 'progress_measured',
  },
  {
    title: 'A target that follows it',
    body: 'When the measured figure moves, your daily target moves with it.',
    gate: 'progress_measured',
  },
  {
    title: 'Where this leads',
    body: 'How long the goal takes at your current intake, allowing for the rate easing as you get lighter.',
    gate: 'progress_forecast',
  },
  {
    title: 'Unlimited plans',
    body: 'No weekly cap on meal plans.',
    gate: 'plan_quota',
  },
];

/**
 * Things the free plan does, in the words someone might be tempted to sell them
 * in. Written as fragments to match on, not as sentences to display.
 *
 * Each entry earned its place by having been advertised as paid at some point,
 * or by being an obvious candidate for it.
 */
export const FREE_CAPABILITIES: string[] = [
  // Computed on device by nutrition.ts for every user.
  'session-aware macros',
  'macros that follow',
  // Part of every recipe the model returns.
  'reheat',
  'meal-prep instruction',
  // The coach has no client-side or server-side cap.
  'unlimited coaching',
  'unlimited coach',
  // weeklyDecision marks this premiumOnly: false on purpose.
  'eating window suggestion',
  'move your eating window',
  // The dial, the fasting stages and the timeline are the free core.
  'fasting stage',
  'countdown',
  'shopping list',
  'hydration',
];

/** Claims that promise something the free plan already does. Empty is correct. */
export function overpromises(claims: Claim[] = PREMIUM_CLAIMS): string[] {
  const bad: string[] = [];
  for (const c of claims) {
    const text = `${c.title} ${c.body}`.toLowerCase();
    for (const free of FREE_CAPABILITIES) {
      if (text.includes(free.toLowerCase())) bad.push(`${c.title} — claims "${free}", which is free`);
    }
  }
  return bad;
}

/** The distinct gates the offer relies on — what the screens must actually read. */
export function gatesUsed(claims: Claim[] = PREMIUM_CLAIMS): Gate[] {
  return [...new Set(claims.map((c) => c.gate))].sort();
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // The defect this module exists for.
  assert(overpromises().length === 0, `the shipped offer sells nothing free: ${overpromises().join('; ')}`);

  // And proof the check can actually fail — the three claims that used to ship.
  const old: Claim[] = [
    { title: 'Session-aware macros', body: 'Targets that follow duration and intensity.', gate: 'plan_quota' },
    { title: 'Meal-prep instructions', body: 'Reheat guidance for skillet, air fryer and microwave.', gate: 'plan_quota' },
    { title: 'Unlimited coaching', body: 'Ask as much as you want.', gate: 'plan_quota' },
  ];
  // Counted by claim, not by hit: one claim can name several free things at
  // once ("meal-prep instructions" also says "reheat"), and asserting on the
  // hit count made this check fail for the wrong reason.
  const caught = new Set(overpromises(old).map((s) => s.split(' — ')[0]));
  assert(caught.size === 3, `every one of the old claims is caught: ${[...caught]}`);
  assert(overpromises([]).length === 0, 'an empty offer promises nothing');

  // A claim with no gate is a claim nobody enforces.
  const GATES: Gate[] = ['progress_measured', 'progress_forecast', 'plan_quota'];
  for (const c of PREMIUM_CLAIMS) {
    assert(GATES.includes(c.gate), `${c.title} names a real gate`);
    assert(c.title.length > 0 && c.body.length > 20, `${c.title} explains itself`);
  }

  // The measured maintenance is the argument for paying, so it leads.
  assert(PREMIUM_CLAIMS[0].gate === 'progress_measured', 'the measurement is the first thing said');
  // And the quota is a lifted limit, not the pitch.
  assert(PREMIUM_CLAIMS[PREMIUM_CLAIMS.length - 1].gate === 'plan_quota', 'the cap comes last');

  assert(gatesUsed().length === 3, `all three gates are used: ${gatesUsed()}`);
  assert(new Set(PREMIUM_CLAIMS.map((c) => c.title)).size === PREMIUM_CLAIMS.length, 'no claim is made twice');

  // House wording rules: no percentages, no medical verbs, no disease terms.
  const forbidden = /\b(cure|cures|prevent|prevents|detox|proven|clinically)\b|%/i;
  for (const c of PREMIUM_CLAIMS) {
    assert(!forbidden.test(`${c.title} ${c.body}`), `${c.title} avoids health claims and percentages`);
  }

  return 'offer.ts: all checks passed';
}
