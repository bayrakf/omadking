/**
 * Every route renders, reports no console errors, and does not scroll
 * sideways. The cheapest guard against a screen that compiles but is blank.
 */

import { BASE, SEED_WITH_PLAN, createReporter, launch, newPage, body } from './harness.mjs';

// [label, path, seed?] — the first entry deliberately has no profile, so the
// onboarding gate is exercised rather than assumed.
const ROUTES = [
  ['onboarding (fresh user)', '/', null],
  ['dashboard', '/', SEED_WITH_PLAN],
  ['planner', '/planner', SEED_WITH_PLAN],
  ['progress', '/progress', SEED_WITH_PLAN],
  ['grocery', '/grocery', SEED_WITH_PLAN],
  ['profile', '/profile', SEED_WITH_PLAN],
  ['chat', '/chat', SEED_WITH_PLAN],
  ['paywall', '/paywall', SEED_WITH_PLAN],
  ['landing', '/landing', SEED_WITH_PLAN],
  ['about', '/about', SEED_WITH_PLAN],
  ['legal', '/legal', SEED_WITH_PLAN],
  ['recovery', '/recovery', SEED_WITH_PLAN],
  // "You" is an index now; each page it points at is a route, and listing them
  // here is how each one gets its renders-without-a-console-error guard.
  ['you/body', '/you/body', SEED_WITH_PLAN],
  ['you/day', '/you/day', SEED_WITH_PLAN],
  ['you/targets', '/you/targets', SEED_WITH_PLAN],
  ['you/reminders', '/you/reminders', SEED_WITH_PLAN],
  ['you/sync', '/you/sync', SEED_WITH_PLAN],
  ['you/data', '/you/data', SEED_WITH_PLAN],
  ['week/corrections', '/week/corrections', SEED_WITH_PLAN],
];

export default async function run() {
  const r = createReporter('SMOKE');
  const browser = await launch();
  r.section('Routes');

  for (const [label, path, seed] of ROUTES) {
    const { context, page, errors } = await newPage(browser, seed);

    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch((e) => errors.push('goto: ' + e.message));
    await page.waitForTimeout(2500);

    const text = await body(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );

    // A missing favicon is not an app failure.
    const real = errors.filter((e) => !/favicon|manifest|404 \(Not Found\)/i.test(e));
    const blank = text.trim().length < 20;

    r.check(!blank, `${label} renders`, blank ? 'page is blank' : '');
    r.check(overflow <= 1, `${label} fits the viewport`, overflow > 1 ? `${overflow}px overflow` : '');
    r.check(real.length === 0, `${label} logs no errors`, real[0] ?? '');

    await context.close();
  }

  await browser.close();
  return r.finish();
}
