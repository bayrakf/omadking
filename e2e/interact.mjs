/**
 * Behaviour, not just rendering. Each block guards a bug that actually shipped
 * here once: profile values stored in the wrong case, hydration lost on
 * navigation, a session that did not move the macros, and a paywall that handed
 * out premium for free.
 */

import { BASE, SEED, createReporter, launch, newPage, body, has } from './harness.mjs';

export default async function run() {
  const r = createReporter('INTERACT');
  const { check, section } = r;
  const browser = await launch();

  // ------------------------------------------------------------- ONBOARDING
  section('Onboarding flow');
  {
    const { context, page, errors } = await newPage(browser, null);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    await page.getByText('Start', { exact: true }).click();
    await page.waitForTimeout(500);

    const next = page.getByText('Continue', { exact: true });
    // An empty form must not advance.
    await next.click().catch(() => {});
    await page.waitForTimeout(400);
    check(has(await body(page), 'Your body'), 'blocked while body stats are empty');

    await page.getByLabel('Weight · kg').fill('900');
    await page.waitForTimeout(300);
    check(has(await body(page), 'Between 30 and 300'), 'out-of-range weight is rejected inline');

    await page.getByLabel('Weight · kg').fill('82');
    await page.getByLabel('Height · cm').fill('183');
    await page.getByLabel('Age').fill('34');
    await page.getByText('Female', { exact: true }).click();
    await page.waitForTimeout(300);
    await next.click();
    await page.waitForTimeout(600);
    check(has(await body(page), 'Training and goal'), 'advances to the training step');

    await page.getByText('Advanced', { exact: true }).click();
    await page.getByText('Lose fat', { exact: true }).click();
    await page.waitForTimeout(200);
    await next.click();
    await page.waitForTimeout(600);
    check(has(await body(page), 'Your window'), 'advances to the timing step');

    await next.click();
    await page.waitForTimeout(600);
    const summary = await body(page);
    check(has(summary, 'That’s everything'), 'reaches the summary');
    check(summary.includes('18:00–20:00'), 'summary shows the computed window', summary.match(/\d\d:\d\d–\d\d:\d\d/)?.[0]);
    check(has(summary, '22h'), 'summary shows the 22h fast');

    await page.getByText('Open the app').click();
    await page.waitForTimeout(1800);

    // The regression this exists for: values were stored as 'Female' / 'Weight
    // Loss' while the rest of the app compared against 'female' / 'weight_loss',
    // so every macro silently used the male formula.
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('onboarding_profile')));
    check(stored.sex === 'female', 'sex persisted canonically', stored.sex);
    check(stored.goal === 'weight_loss', 'goal persisted canonically', stored.goal);
    check(stored.fitness_level === 'advanced', 'fitness persisted canonically', stored.fitness_level);
    check(/Fasting|Window open/.test(await body(page)), 'lands on the dashboard afterwards');
    check(errors.length === 0, 'no console errors', errors[0] ?? '');
    await context.close();
  }

  // -------------------------------------------------------------- DASHBOARD
  section('Dashboard');
  {
    const { context, page, errors } = await newPage(browser, SEED);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.getByLabel('Add 500 millilitres').click();
    await page.getByLabel('Add 250 millilitres').click();
    await page.waitForTimeout(600);
    // 82kg * 40ml = 3.3L. A flat target here would mean the formula regressed.
    check(has(await body(page), '0.8 / 3.3 L'), 'water adds up against a bodyweight target',
      (await body(page)).match(/[\d.]+ \/ [\d.]+ L/)?.[0]);

    const hydration = JSON.parse(await page.evaluate(() => localStorage.getItem('hydration_today')));
    check(hydration.ml === 750, 'hydration persisted', String(hydration.ml));

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    check(has(await body(page), '0.8 / 3.3 L'), 'hydration survives a reload');

    check(has(await body(page), 'Window opens'), 'the day timeline renders');
    await page.getByLabel(/Log the fast at/).click();
    await page.waitForTimeout(700);
    const after = await body(page);
    check(has(after, '1 day clean'), 'streak starts at one', after.match(/\d+ days? clean/)?.[0]);
    check(!has(after, 'Tick'), 'a ticked moment stops offering an action');
    check(errors.length === 0, 'no console errors', errors[0] ?? '');
    await context.close();
  }

  // ---------------------------------------------------------------- PLANNER
  section('Planner');
  {
    const { context, page, errors } = await newPage(browser, SEED);
    await page.goto(BASE + '/planner', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const kcal = async () => {
      const m = (await body(page)).match(/(\d{4})\s*kcal/);
      return m ? Number(m[1]) : NaN;
    };

    // Sport, duration and intensity were collected but ignored for months.
    const medium = await kcal();
    await page.getByText('All out', { exact: true }).click();
    await page.waitForTimeout(500);
    const max = await kcal();
    check(max > medium, 'raising intensity raises kcal', `${medium} → ${max}`);

    await page.getByText('120 min', { exact: true }).click();
    await page.waitForTimeout(500);
    const long = await kcal();
    check(long > max, 'a longer session raises kcal further', `${max} → ${long}`);

    await page.locator('input[type="checkbox"]').first().click();
    await page.waitForTimeout(600);
    const rest = await kcal();
    check(rest < medium, 'a rest day is below any training day', String(rest));
    check(has(await body(page), 'Rest day'), 'the header switches to rest day');

    // The model may be unreachable; the offline recipe has to cover it either way.
    await page.locator('input[type="checkbox"]').first().click();
    await page.waitForTimeout(400);
    await page.getByText('Build the plan').click();
    await page.waitForTimeout(45000);

    const plan = await body(page);
    check(has(plan, 'Today’s timing'), 'a plan renders');
    check(/Main meal\s*\d\d:\d\d/.test(plan), 'the main meal time is shown', plan.match(/Main meal\s*\d\d:\d\d/)?.[0]);
    check(has(plan, 'Ingredients'), 'ingredients render');
    check(has(plan, 'Method'), 'method steps render');
    check(has(plan, '2 of 3 plans left'), 'the quota decrements', plan.match(/\d OF 3 PLANS LEFT/i)?.[0]);
    check(errors.length === 0, 'no console errors', errors[0] ?? '');
    await context.close();
  }

  // ------------------------------------------------------------------ QUOTA
  section('Free-tier quota');
  {
    const { context, page } = await newPage(browser, SEED);
    await page.addInitScript(() => {
      // Pre-exhaust the week, mirroring the ISO week key the app uses.
      const t = new Date();
      t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
      const ft = new Date(t.getFullYear(), 0, 4);
      ft.setDate(ft.getDate() - ((ft.getDay() + 6) % 7) + 3);
      const wk = 1 + Math.round((t.getTime() - ft.getTime()) / (7 * 86400000));
      localStorage.setItem('plan_quota', JSON.stringify({
        week: `${t.getFullYear()}-W${String(wk).padStart(2, '0')}`, used: 3,
      }));
    });
    await page.goto(BASE + '/planner', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    check(has(await body(page), 'Weekly plans used'), 'shows the quota as spent');

    await page.getByText('Build the plan').click();
    await page.waitForTimeout(2500);
    check(has(await body(page), 'Premium'), 'a spent quota routes to the paywall');
    await context.close();
  }

  // ---------------------------------------------------------------- PAYWALL
  section('Paywall honesty');
  {
    const { context, page } = await newPage(browser, SEED);
    await page.goto(BASE + '/paywall', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const t = await body(page);
    check(has(t, 'Unavailable'), 'no fake purchase is offered on web');
    check(has(t, 'only available in the iOS and Android apps'), 'and it says why');

    // This once wrote user_premium=true on tap, with no payment involved.
    await page.getByText('Unavailable').click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const premium = await page.evaluate(() => localStorage.getItem('user_premium'));
    check(premium !== 'true', 'tapping subscribe never grants premium', String(premium));
    await context.close();
  }

  // ------------------------------------------------- OFFLINE RECIPE FALLBACK
  section('Offline recipe fallback');
  {
    const { context, page } = await newPage(browser, SEED);
    // Cut the recipe service off so the built-in plate is guaranteed, rather
    // than depending on whether the model happens to be up during the run.
    await context.route('**/functions/v1/generate_meal_plan', (route) => route.abort());

    await page.goto(BASE + '/planner', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    check(has(await body(page), '3 of 3 plans left'), 'starts with a full quota');

    await page.getByText('Build the plan').click();
    await page.waitForTimeout(6000);

    const after = await body(page);
    check(has(after, 'Today’s timing'), 'a plan still renders without the service');
    check(has(after, 'standard plate'), 'the fallback says it is the standard plate');
    check(has(after, 'unaffected'), 'and that the numbers still hold');

    // The point of the change: an outage must not cost the user a plan.
    check(has(after, '3 of 3 plans left'), 'a fallback recipe does not spend quota',
      after.match(/\d OF 3 PLANS LEFT/i)?.[0]);
    const quota = await page.evaluate(() => localStorage.getItem('plan_quota'));
    check(quota === null || JSON.parse(quota).used === 0, 'quota counter untouched', String(quota));
    await context.close();
  }

  // --------------------------------------------------------------- PROGRESS
  section('Progress');
  {
    const { context, page, errors } = await newPage(browser, SEED);
    await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.getByLabel('Weight in kilograms').fill('999');
    await page.getByText('Save entry').click();
    await page.waitForTimeout(500);
    check(has(await body(page), 'between 30 and 300'), 'an absurd weight is rejected');

    await page.getByLabel('Weight in kilograms').fill('81.4');
    await page.getByText('Save entry').click();
    await page.waitForTimeout(800);
    check(has(await body(page), 'Logged.'), 'a valid weight is accepted');

    const prof = JSON.parse(await page.evaluate(() => localStorage.getItem('onboarding_profile')));
    check(prof.weight_kg === 81.4, "today's weigh-in syncs into the profile", String(prof.weight_kg));
    check(errors.length === 0, 'no console errors', errors[0] ?? '');
    await context.close();
  }

  await browser.close();
  return r.finish();
}
