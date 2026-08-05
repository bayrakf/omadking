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

    // Named protocols rather than bare hours, and the name must move the maths.
    const timing = await body(page);
    check(has(timing, 'Warrior 20:4'), 'protocols are offered by name, not as hours');
    check(has(timing, 'One meal with room to finish it'), 'and the chosen one explains itself');

    await page.getByText('Warrior 20:4', { exact: true }).click();
    await page.waitForTimeout(400);
    check(has(await body(page), '20 hour fast'), 'choosing Warrior gives a 20 hour fast',
      (await body(page)).match(/\d+ hour fast/)?.[0]);

    // Back to the default so the rest of the flow asserts the usual window.
    await page.getByText('OMAD', { exact: true }).click();
    await page.waitForTimeout(400);

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

    // Physiology band under the dial, labelled as approximate.
    const dash = await body(page);
    check(/Fed|Post-absorptive|Glycogen falling|Ketones rising|Deep fast/.test(dash),
      'the dial names the fasting stage', dash.match(/Fed|Post-absorptive|Glycogen falling|Ketones rising|Deep fast/)?.[0]);
    check(has(dash, 'approximate'), 'and marks it as approximate');
    // The wording rule, enforced where a user would actually read it.
    check(!/cure|prevent|detox|proven|guarantee/i.test(dash), 'the dashboard makes no health claim');
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
    // Serve a valid generated recipe. Since a fallback deliberately no longer
    // spends quota, leaving this to the live service would make the quota
    // assertion depend on whether the model happens to answer during the run.
    await context.route('**/functions/v1/generate_meal_plan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'ai',
          recipe: {
            title: 'Seared Honey-Sesame Chicken Breast with Jasmine Rice and Charred Tenderstem',
            ingredients: ['400g chicken breast', '500g sweet potato', '2 tbsp olive oil'],
            instructions: '1. Season the chicken. 2. Roast the potato at 200C for 25 minutes.',
            reheat_instructions: '1. Skillet: 4 minutes over medium heat.',
            prep_time_min: 30,
            is_meal_prep: true,
          },
        }),
      })
    );
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

    await page.locator('input[type="checkbox"]').first().click();
    await page.waitForTimeout(400);
    await page.getByText('Build the plan').click();
    await page.waitForTimeout(6000);

    const plan = await body(page);
    check(has(plan, 'Today’s timing'), 'a plan renders');
    check(has(plan, 'Charred Tenderstem'), 'the full title is shown, not a clipped prefix');
    // Titles used to be clipped to one line, turning them into riddles.
    check(!/\u2026|\.\.\./.test(plan), 'nothing on the planner is truncated with an ellipsis',
      plan.match(/\S*\u2026/)?.[0] ?? '');
    check(!has(plan, 'standard plate'), 'a generated recipe carries no fallback notice');
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

  // --------------------------------------------------------- WEEKLY REVIEW
  section('Weekly review');
  {
    // Sparse first: an empty week must say what is missing, not show a blank card.
    const bare = await newPage(browser, SEED);
    await bare.page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await bare.page.waitForTimeout(1800);
    check(has(await body(bare.page), 'Last 7 days'), 'the review card is on Progress');
    check(has(await body(bare.page), 'reads back'), 'a sparse week says what is missing');
    await bare.context.close();

    // A week with real data reports counted facts and one consequence.
    const iso = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return d.toISOString().slice(0, 10);
    };
    const { context, page } = await newPage(browser, {
      ...SEED,
      fast_log: JSON.stringify([0, 1, 2, 3].map(iso)),
      cook_log: JSON.stringify([0, 2].map(iso)),
      weight_log: JSON.stringify([
        { id: '1', date: iso(6), weight_kg: 83.0 },
        { id: '2', date: iso(3), weight_kg: 82.6 },
        { id: '3', date: iso(0), weight_kg: 82.3 },
      ]),
    });
    await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);

    const t = await body(page);
    check(has(t, '4 of 7 fasts logged'), 'fasts are counted', t.match(/\d of 7 fasts logged/i)?.[0]);
    check(has(t, '2 cooked'), 'cooks are counted');
    check(has(t, 'four weeks'), 'the consequence extrapolates the trend');
    // The wording rule: counted facts only.
    check(!t.includes('%'), 'no invented percentage appears');
    check(!/great job|well done|keep it up/i.test(t), 'no praise is offered');
    await context.close();
  }

  // -------------------------------------------------------- SESSION MEMORY
  section('Planner remembers the session');
  {
    const { context, page } = await newPage(browser, SEED);
    await context.route('**/functions/v1/generate_meal_plan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'ai',
          recipe: {
            title: 'Stubbed Plate',
            ingredients: ['400g chicken breast'],
            instructions: '1. Cook it.',
            prep_time_min: 30,
          },
        }),
      })
    );

    await page.goto(BASE + '/planner', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Defaults on a first visit: profile training time, not a stored session.
    check(has(await body(page), 'weights · 60 min · medium'), 'starts from the defaults',
      (await body(page)).match(/\w+ · \d+ min · \w+/)?.[0]);

    await page.getByText('Running', { exact: true }).click();
    await page.getByText('90 min', { exact: true }).click();
    await page.getByText('Hard', { exact: true }).click();
    await page.waitForTimeout(400);

    // Nothing is remembered until a plan is actually built.
    check(await page.evaluate(() => localStorage.getItem('last_session')) === null,
      'browsing the options alone stores nothing');

    await page.getByText('Build the plan').click();
    await page.waitForTimeout(6000);

    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('last_session')) ?? 'null');
    check(stored?.sport === 'running', 'the sport is remembered', stored?.sport);
    check(stored?.duration_min === 90, 'the duration is remembered', String(stored?.duration_min));
    check(stored?.intensity === 'high', 'the intensity is remembered', stored?.intensity);

    // A full reload is the real test: this used to reset to weights/60/medium.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    check(has(await body(page), 'running · 90 min · high'), 'the session survives a reload',
      (await body(page)).match(/\w+ · \d+ min · \w+/)?.[0]);
    await context.close();
  }

  // --------------------------------------------------------------- SHOPPING
  section('Shopping list');
  {
    // Two plans with the same ingredient in different amounts. Before this the
    // list kept the first amount and dropped the rest, so shopping from it left
    // you short for the second day.
    const twoPlans = [
      { date: '2026-08-04', recipe: { ingredients: [
        '320g chicken breast', '2 tbsp olive oil', 'Sea salt, to taste',
        '350g sweet potato', '250g broccoli',
      ] } },
      { date: '2026-08-05', recipe: { ingredients: [
        '400g raw boneless skinless chicken breast, diced into 2cm cubes',
        '1.2 kg beef', 'Sea salt, to taste', '200g potato',
      ] } },
    ];
    const { context, page } = await newPage(browser, {
      ...SEED,
      meal_history: JSON.stringify(twoPlans),
    });
    await page.goto(BASE + '/grocery', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const list = await body(page);
    // The wording differs across the two plans; only stripping preparation
    // words lets the amounts meet at all.
    check(/720g[^|]*chicken breast/i.test(list), '320g and 400g add up despite different wording',
      list.match(/\d+g[^\n]{0,40}chicken breast/i)?.[0]);
    check(!has(list, '320g chicken'), 'the first amount is no longer shown on its own');
    // The guard that matters more than the merge itself.
    check(has(list, 'sweet potato') && has(list, '200g potato'),
      'sweet potato and potato stay separate');
    // The name is what you buy; how it is cut sits underneath.
    check(!/720g[^\n]{0,10}(raw|boneless|skinless|diced)/i.test(list),
      'preparation words are not part of the name');
    check(has(list, 'diced into 2cm cubes'), 'but the preparation detail is still shown');
    // Aisle order, not code order.
    const produceAt = list.toLowerCase().indexOf('vegetables & fruit');
    const proteinAt = list.toLowerCase().indexOf('protein');
    check(produceAt !== -1 && produceAt < proteinAt, 'produce is listed before protein',
      `produce@${produceAt} protein@${proteinAt}`);
    check(has(list, '1.2kg beef'), 'kilograms are kept as kilograms', list.match(/[\d.]+kg beef/i)?.[0]);
    check(has(list, '2 tbsp olive oil'), 'spoons are left as spoons');
    // Duplicated across both plans, but it is one thing to buy.
    check((list.match(/to taste/gi) ?? []).length === 1, 'an amount-less line appears once');
    await context.close();
  }

  // ------------------------------------------------------------------- CHAT
  section('Coach conversation');
  {
    const { context, page } = await newPage(browser, SEED);
    // Answer locally so the check does not depend on the model being up, and
    // so the assertion is about persistence rather than about the reply.
    await context.route('**/functions/v1/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response:
            'Aim for **3 to 5 grams** of sodium a day.\n\n' +
            '* **Sodium:** 3,000-5,000 mg\n' +
            '* **Potassium:** 1,000-2,000 mg\n\n' +
            '**Why:** Fasting lowers insulin.',
        }),
      })
    );

    await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.getByLabel('Message').fill('How much sodium?');
    await page.getByLabel('Send').click();
    await page.waitForTimeout(2500);
    const answered = await body(page);
    check(has(answered, '3 to 5 grams'), 'the coach answers');
    // The regression this guards: markdown used to print verbatim on screen.
    check(!answered.includes('**'), 'no literal asterisks are shown',
      answered.match(/\*\*[^*]{0,20}/)?.[0] ?? '');
    check(!/(^|\s)\* /.test(answered), 'no literal bullet markers are shown');
    check(has(answered, 'Sodium:') && has(answered, 'Potassium:'), 'the bullet content survives');
    // Structure, not the glyph: the renderer draws its own dot, so asserting a
    // bullet character would pin the test to an implementation detail.
    const blocks = await page.evaluate(() => {
      const labelled = [...document.querySelectorAll('[aria-label]')]
        .map((el) => el.getAttribute('aria-label') ?? '')
        .filter((l) => l.includes('Sodium'));
      return labelled[0]?.split('\n').filter(Boolean).length ?? 0;
    });
    check(blocks >= 4, 'the answer renders as separate blocks, not one run-on', String(blocks));

    // The regression this guards: the thread used to reset on every open, so
    // askCoach received an empty history and the coach could not follow up.
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const back = await body(page);
    check(has(back, 'How much sodium?'), 'the question survives leaving the screen');
    check(has(back, '3 to 5 grams'), 'and so does the answer');

    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('chat_log')) ?? 'null');
    check(Array.isArray(stored) && stored.length === 2, 'exactly the two real messages are stored', String(stored?.length));
    check(!stored?.some((m) => m.id === 'greeting'), 'the canned greeting is not stored');

    await page.getByLabel('Clear conversation').click();
    await page.waitForTimeout(800);
    const cleared = await body(page);
    check(!has(cleared, 'How much sodium?'), 'clearing empties the thread');
    check(await page.evaluate(() => localStorage.getItem('chat_log')) === null, 'and clears storage too');
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
