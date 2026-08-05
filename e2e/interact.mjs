/**
 * Behaviour, not just rendering. Each block guards a bug that actually shipped
 * here once: profile values stored in the wrong case, hydration lost on
 * navigation, a session that did not move the macros, and a paywall that handed
 * out premium for free.
 */

import { BASE, SEED, SEED_WITH_PLAN, createReporter, launch, newPage, body, has } from './harness.mjs';

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
            ingredients: ['450g chicken breast', '500g sweet potato', 'Sea salt, to taste'],
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
    // The app computed when to eat for weeks without ever saying how.
    check(has(plan, 'Breaking the fast'), 'the plan says how to start eating');
    check(has(plan, 'Start with protein'), 'and protein leads');

    // Cooking for two must not double the day's macro targets.
    const macrosBefore = plan.match(/(\d+)\s*\n?\s*protein/i)?.[1];
    await page.getByLabel('2 portions').click();
    await page.waitForTimeout(800);
    const doubled = await body(page);
    check(has(doubled, '900g chicken breast'), 'two portions double the ingredients',
      doubled.match(/[\d.]+(g|kg) chicken breast/i)?.[0]);
    check(doubled.match(/(\d+)\s*\n?\s*protein/i)?.[1] === macrosBefore,
      'but the macro targets stay put — they are for one portion',
      `${macrosBefore} -> ${doubled.match(/(\d+)\s*\n?\s*protein/i)?.[1]}`);
    check(has(doubled, 'Sea salt, to taste'), 'and an amount-less line is untouched');
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

  // ------------------------------------------------------------- ABOUT OMAD
  section('About OMAD');
  {
    const { context, page } = await newPage(browser, SEED);
    await page.goto(BASE + '/about', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);

    const t = await body(page);
    check(has(t, 'Not for everyone'), 'the page states who should not do this');
    for (const item of ['Pregnancy', 'Diabetes', 'disordered eating', 'Under 18']) {
      check(has(t, item), `contraindication listed: ${item}`);
    }

    // The rule that matters most: this must not read as a sales page.
    check(!t.includes('%'), 'no percentage is invented');
    check(!/\bstudies (show|prove)|proven|clinically|guarantee/i.test(t), 'no study or proof is claimed');
    // Word-bounded verbs, so the disclaimer's own "not a diagnosis or treatment"
    // does not trip a check that exists to catch the opposite claim.
    check(!/\b(cures?|treats?|prevents?|reverses?|heals?|detox\w*|toxins?)\b/i.test(t),
      'nothing claims to cure, treat or detox',
      t.match(/\b(cures?|treats?|prevents?|reverses?|heals?|detox\w*|toxins?)\b/i)?.[0] ?? '');
    check(has(t, 'not medical advice'), 'and the page says it is not medical advice');
    check(has(t, 'not metabolically superior'), 'and it says plainly what OMAD does not do');

    // Contraindications must come before the benefits, not after them.
    const warnAt = t.indexOf('Not for everyone');
    const goodAt = t.toLowerCase().indexOf('plausibly help');
    check(warnAt !== -1 && warnAt < goodAt, 'the warning comes before the upside',
      `warning@${warnAt} upside@${goodAt}`);
    await context.close();
  }

  // ---------------------------------------------------------------- PLATEAU
  section('Plateau');
  {
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return d.toISOString().slice(0, 10);
    };
    // Sixteen days of held weight while eating ~2100.
    const flat = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, date: day(16 - i * 2), weight_kg: 85 }));
    const intake = Array.from({ length: 14 }, (_, i) => ({ date: day(14 - i), factor: 1, target_kcal: 2100 }));
    const seed = {
      ...SEED,
      onboarding_profile: JSON.stringify({
        weight_kg: 85, height_cm: 183, age: 34, sex: 'male',
        fitness_level: 'advanced', goal: 'weight_loss',
        omad_window_start: '18:00', omad_window_hours: 2, default_training_time: '19:00',
      }),
      weight_log: JSON.stringify(flat),
      intake_log: JSON.stringify(intake),
    };

    {
      const { context, page } = await newPage(browser, { ...seed, user_premium: 'true' });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Weight has held'), 'a stall is named rather than left to be guessed at');
      check(has(t, 'not your discipline'), 'and it says whose fault it is not');
      check(/Eating \d{4} puts the deficit back/.test(t), 'with a concrete new target',
        t.match(/Eating \d{4}[^.]*/)?.[0] ?? '');
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, seed);
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Weight has held'), 'the stall itself is shown without premium');
      check(!/Eating \d{4} puts/.test(t), 'but the new figure is not');
      await context.close();
    }
  }

  // -------------------------------------------------- MEASURING MAINTENANCE
  section('Measured maintenance');
  {
    // Fourteen days at 1800 kcal while losing ~0.5 kg/week → about 2350.
    const day = (back) => {
      const d = new Date('2026-08-20T12:00:00Z');
      d.setDate(d.getDate() - back);
      return d.toISOString().slice(0, 10);
    };
    const intake = Array.from({ length: 14 }, (_, i) => ({
      date: day(13 - i), factor: 1, target_kcal: 1800,
    }));
    const weights = Array.from({ length: 7 }, (_, i) => ({
      id: `w${i}`, date: day(12 - i * 2), weight_kg: 85 - i * (0.5 * 2 / 7),
    }));

    // Without premium: the app says it measured something, not what.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, intake_log: JSON.stringify(intake), weight_log: JSON.stringify(weights),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'What your body actually costs'), 'the measurement card is shown to everyone');
      check(has(t, '14 days'), 'and says what it is based on');
      check(!/\b2[0-9]{3}\s*kcal a day/.test(t), 'but the figure itself is not given away',
        t.match(/\d+\s*kcal a day/)?.[0] ?? '');
      check(has(t, 'Premium'), 'and it names what unlocks it');
      await context.close();
    }

    // With premium: the number, and the gap to the formula.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, intake_log: JSON.stringify(intake), weight_log: JSON.stringify(weights),
        user_premium: 'true',
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(/\d{4}\s*kcal a day/.test(t), 'premium sees the measured figure',
        t.match(/\d{4}\s*kcal a day/)?.[0] ?? '');
      check(has(t, 'formula'), 'and how it compares to the estimate');
      check(has(t, '7,700'), 'and that it rests on an approximation');
      await context.close();
    }

    // Too little data: it asks rather than inventing a number.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, intake_log: JSON.stringify(intake.slice(0, 2)), user_premium: 'true',
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Not enough to measure yet'), 'thin data produces a request, not a figure');
      check(!/\d{4}\s*kcal a day/.test(t), 'and no number is shown');
      await context.close();
    }
  }

  // ------------------------------------------------------ SYNC SENDS CIPHERTEXT
  section('Sync sends nothing readable');
  {
    const HEX = '030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc';
    const { context, page } = await newPage(browser, {
      ...SEED_WITH_PLAN,
      omadcoach_sync_key: HEX,
      weight_log: JSON.stringify([{ date: '2026-08-04', weight_kg: 81.7 }]),
    });

    // Stand in for Supabase so the test never touches the real project. What
    // matters is what the client puts on the wire, not what the server does.
    await context.route('**/auth/v1/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'stub', refresh_token: 'stub', token_type: 'bearer', expires_in: 3600,
          user: { id: '11111111-1111-1111-1111-111111111111', is_anonymous: true },
        }),
      })
    );

    const bodies = [];
    await context.route('**/rest/v1/sync_state*', (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      }
      bodies.push(req.postData() ?? '');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ user_id: '11111111-1111-1111-1111-111111111111' }]),
      });
    });

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.getByText('Sync now').click();
    await page.waitForTimeout(3000);

    check(bodies.length > 0, 'the client writes to sync_state', String(bodies.length));
    const sent = bodies.join('\n');

    // The claim this whole design rests on.
    for (const secret of ['81.7', 'weight_kg', 'muscle_gain', '2026-08-04', 'onboarding_profile']) {
      check(!sent.includes(secret), `the request body does not contain "${secret}"`);
    }
    check(/"ciphertext"\s*:\s*"[A-Za-z0-9+/=]{40,}"/.test(sent), 'it carries base64 ciphertext instead');
    check(/"nonce"/.test(sent), 'and a nonce');
    check(has(await body(page), 'Last synced'), 'and the screen reports it synced');
    await context.close();
  }

  // -------------------------------------------------------- RECOVERY PHRASE
  section('Recovery phrase');
  {
    // A fixed key and its phrase, so the test asserts the real encoding rather
    // than whatever the app happened to generate.
    const HEX = '030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc';
    const PHRASE = 'AAXE RNK4 BT72 CEZF XHX3 46NE FGXN YZ2J 8378 P3MR HD9W WKWS RQH6 89AS';
    const OTHER = 'BBXE RNK4 BT72 CEZF XHX3 46NE FGXN YZ2J 8378 P3MR HD9W WKWS RQH6 89AS';

    const { context, page } = await newPage(browser, { ...SEED, omadcoach_sync_key: HEX });
    await page.goto(BASE + '/recovery', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);

    // Not shown until asked for.
    check(!has(await body(page), 'AAXE'), 'the phrase is hidden until tapped');
    await page.getByLabel('Show recovery phrase').click();
    await page.waitForTimeout(500);
    check(has(await body(page), PHRASE), 'and then shows in full');
    check(has(await body(page), 'gone for good'), 'the consequence of losing it is stated plainly');

    // A wrong phrase must cost nothing. This is the check that matters:
    // replacing a good key with a bad one would look like total data loss.
    await page.getByLabel('Enter recovery phrase').fill(OTHER.slice(0, 30));
    await page.getByText('Use this phrase').click();
    await page.waitForTimeout(700);
    check(has(await body(page), 'not right'), 'a bad phrase is refused in plain words');
    check(
      await page.evaluate(() => localStorage.getItem('omadcoach_sync_key')) === HEX,
      'and the existing key is untouched'
    );

    // A valid phrase from another device replaces the key.
    await page.getByLabel('Enter recovery phrase').fill(PHRASE.toLowerCase());
    await page.getByText('Use this phrase').click();
    await page.waitForTimeout(700);
    check(
      await page.evaluate(() => localStorage.getItem('omadcoach_sync_key')) === HEX,
      'a valid phrase produces exactly that key, whatever the case'
    );
    await context.close();
  }

  // ------------------------------------------------------------------- LEGAL
  section('Privacy and imprint');
  {
    const { context, page } = await newPage(browser, SEED);
    await page.goto(BASE + '/legal', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);

    const t = await body(page);
    // The draft banner must be impossible to miss while details are missing.
    check(has(t, 'Entwurf'), 'an unfilled page says so in plain sight');
    check(!has(t, 'TODO'), 'but never shows the raw placeholder', t.match(/TODO/)?.[0] ?? '');

    // Every recipient the code actually talks to has to be named.
    for (const r of ['Supabase', 'Google', 'RevenueCat']) {
      check(has(t, r), `recipient named: ${r}`);
    }
    check(has(t, 'Nur auf deinem Ger'), 'and it says what never leaves the device');
    // The claim the edge function now backs.
    check(has(t, 'nicht mitgeschickt'), 'the policy states which fields are withheld');
    check(has(t, 'Datenschutzbeh'), 'the supervisory authority is named');

    await page.getByLabel('Impressum').click();
    await page.waitForTimeout(900);
    const imp = await body(page);
    check(has(imp, 'Firmenbuch'), 'the imprint lists the required fields');
    check(!has(imp, 'TODO'), 'and shows no raw placeholder either');
    await context.close();
  }

  // ------------------------------------------------------------ DELETE MY DATA
  section('Deleting everything');
  {
    const { context, page } = await newPage(browser, SEED_WITH_PLAN);
    page.on('dialog', (dlg) => dlg.accept());
    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    check(has(await body(page), 'Delete all data'), 'deletion is offered, not just reset');
    await page.getByLabel('Delete all data').click();
    await page.waitForTimeout(2500);

    // Deletion means onboarding, and nothing left behind in storage.
    check(page.url().includes('/onboarding'), 'the app returns to onboarding', page.url());
    const left = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => /profile|weight_log|fast_log|chat_log|meal_history/.test(k))
    );
    check(left.length === 0, 'no logs survive the deletion', left.join(', '));
    await context.close();
  }

  // -------------------------------------------------------- LANDING REACHABLE
  section('Landing from the app');
  {
    const { context, page } = await newPage(browser, SEED);
    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    check(has(await body(page), 'What this app is for'), 'the profile links to the landing page');
    await page.getByLabel('What this app is for').click();
    await page.waitForTimeout(1800);
    check(page.url().includes('/landing'), 'and it goes there', page.url());
    check((await body(page)).trim().length > 200, 'the landing page has content');
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

    // Adaptation phase, counted from logged days rather than a calendar.
    check(has(t, 'Fasts this week'), 'the week strip renders');
    check(has(t, 'First week'), 'the adaptation phase is named', t.match(/First (days|week)|Settling|Settled/)?.[0]);
    check(has(t, '4 days logged'), 'and counts the days actually logged');
    check(!/cure|prevent|detox|proven|guarantee/i.test(t), 'progress makes no health claim');

    // A streak you cannot correct stops being true — that is the whole point.
    const cells = page.locator('[role="checkbox"]');
    const before = await cells.count();
    check(before === 7, 'seven days are offered', String(before));

    const dayCount = () => page.evaluate(() =>
      Number((document.body.innerText.match(/(\d+) days? logged/) ?? [])[1] ?? -1));
    const startDays = await dayCount();
    // Tick an unlogged day, then untick it again.
    const unticked = page.locator('[role="checkbox"][aria-checked="false"]').first();
    await unticked.click();
    await page.waitForTimeout(900);
    check(await dayCount() === startDays + 1, 'adding a missed fast counts it',
      `${startDays} -> ${await dayCount()}`);

    await page.locator('[role="checkbox"][aria-checked="true"]').last().click();
    await page.waitForTimeout(900);
    check(await dayCount() === startDays, 'and a mistap can be taken back',
      `back to ${await dayCount()}`);
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

  // ------------------------------------------------------------ QUOTA WORDING
  section('Rate-limit wording');
  {
    const { context, page } = await newPage(browser, SEED);
    // A daily cap, reported exactly as Google reports it — including a retry
    // hint under a minute, which is what made the old message wrong.
    await context.route('**/functions/v1/chat', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'UPSTREAM',
          reason: 'quota',
          detail:
            'You exceeded your current quota. Please retry in 39.5s. ' +
            'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20',
        }),
      })
    );

    await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.getByLabel('Message').fill('anything');
    await page.getByLabel('Send').click();
    await page.waitForTimeout(2500);

    const t = await body(page);
    check(has(t, 'resets tomorrow'), 'a daily cap says it resets tomorrow');
    check(!/try again in a minute/i.test(t), 'and never tells the user to wait a minute');
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
