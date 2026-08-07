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
  /** `isPremium()` read before the month-against-month figures are shown. */
  | 'progress_months'
  /** `isPremium()` read before the worst weekday is named. */
  | 'progress_pattern'
  /** `isPremium()` read before the training/rest split is shown. */
  | 'progress_cycle'
  /** `isPremium()` read before the best weeks are counted against the rest. */
  | 'progress_best'
  /** `isPremium()` read before the redistributed figure for a planned big day. */
  | 'week_ahead'
  /** `isPremium()` read before the coach is handed the user's own figures. */
  | 'chat_context'
  /** `getQuota()` / `consumeQuota()` in the planner. */
  | 'plan_quota';

/** Every gate the app can enforce. Kept next to the type so it can be iterated. */
export const ALL_GATES: Gate[] = [
  'progress_measured', 'progress_forecast', 'progress_months',
  'progress_pattern', 'progress_cycle', 'progress_best', 'week_ahead',
  'chat_context', 'plan_quota',
];

/**
 * Where each gate is actually enforced.
 *
 * `SELL_GATE` covers the cards that ask for money, and `npm run check` reads
 * the screens for those. It could not see `chat_context`, because the chat does
 * not sell anything — it quietly answers with ranges instead of your numbers.
 * A gate that withholds without offering is the same defect as a claim nobody
 * enforces, only harder to notice: nobody complains about a feature they were
 * never told existed.
 *
 * The check below asserts every gate names a file, that the file is there, and
 * that it still reads the entitlement at all.
 */
export const GATE_SITES: Record<Gate, string> = {
  progress_measured: 'src/app/(tabs)/progress.tsx',
  progress_forecast: 'src/app/(tabs)/progress.tsx',
  progress_months: 'src/app/(tabs)/progress.tsx',
  progress_pattern: 'src/app/(tabs)/progress.tsx',
  progress_cycle: 'src/app/(tabs)/progress.tsx',
  progress_best: 'src/app/(tabs)/progress.tsx',
  week_ahead: 'src/app/(tabs)/progress.tsx',
  chat_context: 'src/app/chat.tsx',
  plan_quota: 'src/app/(tabs)/planner.tsx',
};

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
    title: 'Why it got harder',
    body: 'Month against month from your own log: what you ate, what you lost, and how far your '
      + 'maintenance moved while you got lighter.',
    gate: 'progress_months',
  },
  {
    title: 'The day that costs you',
    body: 'Which weekday runs over the rest, by how much, and what it adds up to across a week.',
    gate: 'progress_pattern',
  },
  {
    title: 'A week built around your training',
    body: 'The same weekly total, split so training days carry more and rest days less. Never below '
      + 'what your body needs at rest.',
    gate: 'progress_cycle',
  },
  {
    title: 'What your best weeks had in common',
    body: 'Your strongest weeks counted against the rest — sessions, days on plan, fasts logged. '
      + 'What the log actually shows, not what usually helps people.',
    gate: 'progress_best',
  },
  {
    title: 'Plan the big day before it happens',
    body: 'Say roughly how far next Saturday will run over, and see what the other days become so '
      + 'the week still lands where it was going — or that it cannot, and what the evening costs.',
    gate: 'week_ahead',
  },
  {
    title: 'A coach that knows your numbers',
    body: 'Your measured maintenance, your trend, how long the scale has held and which weekday runs '
      + 'over go into the answer, so it stops replying with the ranges that fit anybody.',
    gate: 'chat_context',
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

/**
 * Which gate each sellable Progress card sits behind.
 *
 * The card names and the gate names differ on purpose — `outlook` is the card,
 * `progress_forecast` is the thing being withheld — so the link has to be
 * written down somewhere. Here, because `npm run check` reads it back out of
 * the screens and compares.
 */
export const SELL_GATE: Record<string, Gate> = {
  measured: 'progress_measured',
  months: 'progress_months',
  outlook: 'progress_forecast',
  pattern: 'progress_pattern',
  cycle: 'progress_cycle',
  best: 'progress_best',
  ahead: 'week_ahead',
};

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
  for (const c of PREMIUM_CLAIMS) {
    assert(ALL_GATES.includes(c.gate), `${c.title} names a real gate`);
    assert(c.title.length > 0 && c.body.length > 20, `${c.title} explains itself`);
  }

  // The measured maintenance is the argument for paying, so it leads.
  assert(PREMIUM_CLAIMS[0].gate === 'progress_measured', 'the measurement is the first thing said');
  // And the quota is a lifted limit, not the pitch.
  assert(PREMIUM_CLAIMS[PREMIUM_CLAIMS.length - 1].gate === 'plan_quota', 'the cap comes last');

  // The defect that made this check worth widening: three cards were put behind
  // the paywall without ever being offered on it, so people paid for functions
  // nobody had told them about. A gate the offer does not name is money taken
  // for something unsold.
  const unsold = ALL_GATES.filter((g) => !gatesUsed().includes(g));
  assert(unsold.length === 0, `every gate the app enforces is also offered: ${unsold}`);
  assert(gatesUsed().length === ALL_GATES.length, `all gates are used: ${gatesUsed()}`);
  assert(
    gatesUsed([{ title: 'x', body: 'x'.repeat(21), gate: 'plan_quota' }]).length === 1,
    'and the check reads the claims rather than the constant'
  );
  assert(new Set(PREMIUM_CLAIMS.map((c) => c.title)).size === PREMIUM_CLAIMS.length, 'no claim is made twice');

  // Every gate says where it is enforced, including the ones that never sell.
  for (const g of ALL_GATES) {
    assert(typeof GATE_SITES[g] === 'string' && GATE_SITES[g].length > 0,
      `${g} names the file that enforces it`);
  }
  assert(
    Object.keys(GATE_SITES).length === ALL_GATES.length,
    'and no site is listed for a gate that no longer exists'
  );

  // Each sellable card resolves to a gate, and each of those gates is offered.
  for (const [card, gate] of Object.entries(SELL_GATE)) {
    assert(ALL_GATES.includes(gate), `${card} maps to a real gate`);
    assert(gatesUsed().includes(gate), `${card} is a card someone can be sold`);
  }

  // House wording rules: no percentages, no medical verbs, no disease terms.
  const forbidden = /\b(cure|cures|prevent|prevents|detox|proven|clinically)\b|%/i;
  for (const c of PREMIUM_CLAIMS) {
    assert(!forbidden.test(`${c.title} ${c.body}`), `${c.title} avoids health claims and percentages`);
  }

  return 'offer.ts: all checks passed';
}
