/**
 * Behaviour, not just rendering. Each block guards a bug that actually shipped
 * here once: profile values stored in the wrong case, hydration lost on
 * navigation, a session that did not move the macros, and a paywall that handed
 * out premium for free.
 */

import {
  BASE, SEED, SEED_WITH_PLAN, closedWindowProfile,
  createReporter, launch, newPage, body, bodyIn, has, localISO,
} from './harness.mjs';

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

    // The step that used to be assumed rather than asked: the goal weight was
    // a healthy-BMI midpoint nobody agreed to, and the deficit was 500 kcal
    // whether the body was 60 kg or 120.
    const pace = await body(page);
    check(has(pace, 'Where to, and how fast'), 'losing weight now asks where to and how fast');
    check(/middle of the healthy range/.test(pace), 'and offers the default rather than imposing it');
    // For this body 0.75 kg a week lands under resting expenditure, and the
    // app says so instead of clamping quietly to something it is not
    // delivering. Selecting it used to do nothing at all, which taught the
    // person nothing.
    await page.getByLabel('0.75 kg / week').click();
    await page.waitForTimeout(400);
    const refused = await body(page);
    check(/will not set it/.test(refused), 'a rate that is too fast is refused out loud',
      refused.match(/That would leave[^.]*\./)?.[0] ?? '');
    check(/below the \d{3,4} your body uses at rest/.test(refused), 'naming the floor it would break');

    await page.getByLabel('0.25 kg / week').click();
    await page.waitForTimeout(400);
    const chosen = await body(page);
    // The part every other app leaves out: what the rate actually costs.
    check(/\d{3} kcal a day under what your body uses/.test(chosen),
      'and one that fits states what it costs',
      chosen.match(/\d+ kcal a day under[^.]*/)?.[0] ?? '');

    await next.click();
    await page.waitForTimeout(600);
    const summary = await body(page);
    check(has(summary, '0.25 kg / week'), 'and the summary repeats back what will be saved');
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
    check(stored.weekly_rate_kg === 0.25, 'the chosen pace persisted', String(stored.weekly_rate_kg));

    // The weight typed during setup is a weigh-in. It used to go to the profile
    // and nowhere else, so the log stayed empty, Progress said nothing was
    // logged, and the ten-day span the measurement needs started whenever
    // somebody happened to find the weigh-in field.
    const firstWeights = JSON.parse(
      await page.evaluate(() => localStorage.getItem('weight_log')) ?? '[]'
    );
    check(firstWeights.length === 1, 'the typed weight became a weigh-in',
      JSON.stringify(firstWeights));
    check(firstWeights[0]?.weight_kg === 82, 'with the number that was given',
      String(firstWeights[0]?.weight_kg));
    check(firstWeights[0]?.date === localISO(),
      'dated today, so the span starts on day one', firstWeights[0]?.date);
    check(/Fasting|Window open/.test(await body(page)), 'lands on the dashboard afterwards');
    check(errors.length === 0, 'no console errors', errors[0] ?? '');
    await context.close();
  }

  // -------------------------------------------------------------- DASHBOARD
  section('Dashboard');
  {
    // The fasting stage only has a name while the window is shut, so the window
    // is placed relative to the clock rather than fixed at 18:00.
    const { context, page, errors } = await newPage(browser, {
      ...SEED, onboarding_profile: closedWindowProfile(),
    });
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

  // ------------------------------------------------ ROTATION AND CONSISTENCY
  section('Rotation and consistency');
  {
    const day = (back) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - back);
      return localISO(dt);
    };

    // A rotation outlives the ten-plan window, so it is stored separately.
    {
      const { context, page } = await newPage(browser, {
        ...SEED_WITH_PLAN,
        cooked_recipes: JSON.stringify([
          { title: 'Salmon and jasmine rice', count: 5, lastCooked: day(2), recipe: { title: 'Salmon and jasmine rice', ingredients: ['300g salmon'], instructions: '1. Cook.' } },
          { title: 'Chicken and sweet potato', count: 2, lastCooked: day(6), recipe: { title: 'Chicken and sweet potato', ingredients: ['300g chicken'], instructions: '1. Cook.' } },
        ]),
      });
      await page.goto(BASE + '/planner', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Cooked before'), 'the rotation is offered');
      check(has(t, 'cooked 5×'), 'with how often each was made', t.match(/cooked \d+×/)?.[0] ?? '');
      // Most cooked leads, whatever the dates say.
      check(t.indexOf('Salmon and jasmine rice') < t.indexOf('Chicken and sweet potato'),
        'and the most cooked one leads');
      check(has(t, 'no plan used'), 'and it says re-cooking costs no quota');
      await context.close();
    }

    // Consistency survives a gap that destroys the streak.
    {
      const fasts = Array.from({ length: 30 }, (_, i) => day(i)).filter((_, i) => i !== 3);
      const { context, page } = await newPage(browser, {
        ...SEED, fast_log: JSON.stringify(fasts),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Consistency'), 'consistency is shown');
      check(has(t, '29'), 'and one missed day costs exactly one', t.match(/29/)?.[0] ?? '');
      // The streak collapsed to 3, and that is deliberately not the headline.
      check(has(t, '3 in a row'), 'the streak is still there, behind it');
      await context.close();
    }
  }

  // --------------------------------------------------- PATTERN AND BUDGET
  section('Pattern and weekly budget');
  {
    const day = (back) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - back);
      return localISO(dt);
    };
    // Four weeks where Saturdays run 30% over and nothing else does.
    const intake = Array.from({ length: 28 }, (_, i) => {
      const date = day(27 - i);
      const sat = new Date(date + 'T12:00:00Z').getUTCDay() === 6;
      return { date, factor: sat ? 1.3 : 1, target_kcal: 2000 };
    });
    const seed = { ...SEED, intake_log: JSON.stringify(intake) };

    {
      const { context, page } = await newPage(browser, { ...seed, user_premium: 'true' });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await bodyIn(page, 'Your body');
      check(has(t, 'Your pattern'), 'the pattern card is there');
      check(has(t, 'Saturdays run 30% over'), 'and names the day with its size',
        t.match(/\w+s run \d+% over/)?.[0] ?? '');
      check(/\d+ kcal more than planned/.test(t), 'and what it costs across a week',
        t.match(/about \d+ kcal more than planned/)?.[0] ?? '');
      // The budget is free arithmetic and must be visible either way.
      check(has(await bodyIn(page, 'This week'), "This week's budget"), 'the weekly budget is shown');
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, seed);
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      check(has(await bodyIn(page, 'This week'), "This week's budget"), 'the budget stays free');
      const t = await bodyIn(page, 'Your body');
      check(!has(t, 'Saturdays run'), 'but the day itself is not given away');
      check(has(t, 'Premium names it'), 'and it says what unlocks it');
      await context.close();
    }
  }

  // ------------------------------------------------------------- TYPING
  section('Typing without losing focus');
  {
    // The regression: NumField and the profile Row were declared inside their
    // screens, so every keystroke produced a new component type and React threw
    // the input away and mounted a fresh one. One character landed per tap.
    const { context, page } = await newPage(browser, null);
    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    // Step 0 is the welcome screen; the number fields are on step 1.
    await page.getByText('Start', { exact: true }).click();
    await page.waitForTimeout(700);

    const weight = page.getByLabel('Weight · kg');
    await weight.click();
    await page.keyboard.type('82.4', { delay: 40 });
    check(await weight.inputValue() === '82.4', 'a whole number survives typing',
      await weight.inputValue());
    // Focus has to still be there, or the next character would go nowhere.
    check(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Weight · kg',
      'and the field still holds focus afterwards'
    );
    await context.close();
  }

  {
    const { context, page } = await newPage(browser, SEED);
    await page.goto(BASE + '/you/body', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);

    // The chosen target weight: editable, and it must accept a full number.
    await page.getByLabel('Edit Target weight').click();
    await page.waitForTimeout(400);
    const target = page.getByLabel('Target weight');
    await page.keyboard.type('78.5', { delay: 40 });
    check(await target.inputValue() === '78.5', 'the target weight takes a full number too',
      await target.inputValue());

    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('onboarding_profile') ?? '{}').target_weight_kg);
    check(stored === 78.5, 'and it is what gets stored', String(stored));
    await context.close();
  }

  // --------------------------------------------------------- ONE BUY BUTTON
  section('Progress asks for money once');
  {
    // progressCards has said "one selling card" since it was written, but only
    // two cards obeyed it. Three more were added that pushed to the paywall on
    // their own, so a free user with plenty of data met four buy buttons on one
    // screen. Counted across all three segments, because that is where they hid.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    const rich = {
      ...SEED,
      intake_log: JSON.stringify(Array.from({ length: 40 }, (_, i) => {
        const date = day(39 - i);
        const sat = new Date(date + 'T12:00:00Z').getUTCDay() === 6;
        return { date, factor: sat ? 1.3 : 1, target_kcal: 2000 };
      })),
      weight_log: JSON.stringify(Array.from({ length: 12 }, (_, i) => ({
        id: `r${i}`, date: day(36 - i * 3), weight_kg: 90 - i * 0.4,
      }))),
      meal_history: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({
        date: day(20 - i * 2), training_start_time: '19:00', recipe: { ingredients: [] },
      }))),
    };

    const countBuys = async (page) => {
      let n = 0;
      for (const seg of ['This week', 'Your body', 'History']) {
        await page.getByLabel(seg).click();
        await page.waitForTimeout(500);
        // The five labels that lead to the paywall, listed rather than matched
        // loosely — a pattern that silently stops matching would make this
        // check pass by finding nothing, which is the failure it exists for.
        n += await page.getByText(
          /^(See what it measured|Compare the months|See which day|See the split|See where this leads|Plan the day|Count the difference|Keep it moving)$/
        ).count();
      }
      return n;
    };

    {
      const { context, page } = await newPage(browser, rich);
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const n = await countBuys(page);
      check(n === 1, 'a free user is asked for money exactly once', String(n));
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { ...rich, user_premium: 'true' });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const n = await countBuys(page);
      check(n === 0, 'and someone who already paid is never asked again', String(n));
      await context.close();
    }
  }

  // ------------------------------------------------------ SUMMARY TO TAKE
  section('The log can be taken to an appointment');
  {
    // A doctor's appointment is where this data is worth most and reaches
    // least: it sits on the phone in charts nobody else can read.
    const { context, page } = await newPage(browser, {
      ...SEED,
      weight_log: JSON.stringify([
        { id: 's1', date: '2026-05-01', weight_kg: 95 },
        { id: 's2', date: '2026-06-01', weight_kg: 91.2 },
      ]),
      intake_log: JSON.stringify([
        { date: '2026-05-02', factor: 1, target_kcal: 2000 },
        { date: '2026-05-03', factor: 0.75, target_kcal: 2000 },
      ]),
      fast_log: JSON.stringify(['2026-05-02', '2026-05-03']),
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(BASE + '/you/data', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const btn = page.getByText('Summary for an appointment');
    check(await btn.count() === 1, 'the action is offered');
    await btn.click();
    await page.waitForTimeout(900);
    check(has(await body(page), 'Copied'), 'and reports that it produced something');

    const text = await page.evaluate(() => navigator.clipboard.readText());
    check(/2026-05-01 to 2026-06-01/.test(text), 'the period is in it',
      text.match(/\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/)?.[0] ?? '');
    check(/95 kg/.test(text) && /91.2 kg/.test(text), 'with both weights');
    check(/1750 kcal/.test(text), 'and the mean intake computed from the entries',
      text.match(/Mean[^\n]*/)?.[0] ?? '');
    check(/completed: 2/.test(text), 'and the fasts counted');
    // The sentence without which the document would be dangerous.
    check(/not a medical assessment/.test(text), 'it says plainly what it is not');
    check(/Pregnancy or breastfeeding/.test(text), 'and carries the contraindications');
    // A record, not a report.
    check(!/should|recommend|indicates|risk of|diagnos/i.test(text),
      'and nothing in it interprets or advises');
    await context.close();
  }

  // -------------------------------------------------------- THE BEST WEEKS
  section('What the best weeks had in common');
  {
    // Twelve measured weeks where the strong ones differ in exactly one thing.
    // The claim is a count, and the check that matters is the one that reads
    // the rendered sentence for a causal word.
    const mon = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - back * 7);
      return localISO(d);
    };
    const plus = (iso, n) => {
      const d = new Date(iso + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return localISO(d);
    };
    const weights = [];
    const plans = [];
    const intake = [];
    let kg = 96;
    for (let i = 12; i >= 1; i--) {
      const m = mon(i);
      const good = i >= 10;
      weights.push({ id: `b${i}a`, date: m, weight_kg: Math.round(kg * 10) / 10 });
      kg -= good ? 0.8 : 0.1;
      weights.push({ id: `b${i}b`, date: plus(m, 6), weight_kg: Math.round(kg * 10) / 10 });
      for (let t = 0; t < (good ? 4 : 1); t++) {
        plans.push({ date: plus(m, t), training_start_time: '19:00', recipe: { ingredients: [] } });
      }
      for (let d = 0; d < 7; d++) intake.push({ date: plus(m, d), factor: 1, target_kcal: 2000 });
    }
    const seed = {
      ...SEED,
      weight_log: JSON.stringify(weights),
      meal_history: JSON.stringify(plans),
      intake_log: JSON.stringify(intake),
    };

    {
      const { context, page } = await newPage(browser, { ...seed, user_premium: 'true' });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyIn(page, 'Your body');
      check(has(t, 'What your best weeks had in common'), 'the card is there');
      check(/sessions a week, against/.test(t), 'and names the difference as a count',
        t.match(/[\d.]+ sessions a week, against [\d.]+ in the others/)?.[0] ?? '');
      // The rule the whole feature stands on.
      check(
        !/\b(because|causes?|leads to|results in|proves|works for you|makes you)\b/i.test(t),
        'and states it without claiming a cause'
      );
      check(!/you should|try to|we recommend/i.test(t), 'and without instructing anyone');
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, seed);
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyIn(page, 'Your body');
      check(has(t, 'What your best weeks had in common'), 'free users see the card exists');
      check(!/sessions a week, against/.test(t), 'but not what the difference was');
      await context.close();
    }

    // Three weeks: the honest answer is how many are missing, not a comparison
    // of two against one.
    {
      const { context, page } = await newPage(browser, {
        ...SEED,
        weight_log: JSON.stringify(weights.slice(-6)),
        meal_history: JSON.stringify(plans), intake_log: JSON.stringify(intake),
        user_premium: 'true',
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyIn(page, 'Your body');
      check(/\d+ more weeks?/.test(t), 'thin data asks for weeks rather than comparing',
        t.match(/\d+ more weeks?[^.]*/)?.[0] ?? '');
      check(!/sessions a week, against/.test(t), 'and names no difference');
      await context.close();
    }
  }

  // --------------------------------------------- WHAT YOU WILL NOT EAT
  section('The recipe knows what you cannot eat');
  {
    // Until this existed the prompt carried targets, goal and training time and
    // nothing else, so a vegetarian got chicken — and rejecting the plate cost
    // one of three weekly plans.
    //
    // Two contexts on purpose: the harness re-seeds localStorage on every
    // document load, so anything saved through the UI is wiped by the next
    // navigation. Saving and sending have to be checked apart.
    {
      const { context, page } = await newPage(browser, SEED);
      await page.goto(BASE + '/you/body', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const field = page.getByLabel('Never put in a recipe');
      check(await field.count() === 1, 'the profile has a place to say it');
      await field.fill('no fish, no dairy');
      // Saved on blur, like the numeric rows.
      await page.keyboard.press('Tab');
      await page.waitForTimeout(900);
      const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('onboarding_profile')) ?? '{}');
      check(saved.avoid === 'no fish, no dairy', 'and it is stored', String(saved.avoid));
      await context.close();
    }

    {
      const profile = JSON.parse(SEED.onboarding_profile);
      const { context, page } = await newPage(browser, {
        ...SEED,
        onboarding_profile: JSON.stringify({ ...profile, avoid: 'no fish, no dairy' }),
      });

      const sent = [];
      await context.route('**/functions/v1/generate_meal_plan', (route) => {
        try { sent.push(JSON.parse(route.request().postData() ?? '{}')); } catch { sent.push({}); }
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ recipe: {
            title: 'Test plate', ingredients: ['200g tofu'], instructions: '1. Cook.',
            reheat_instructions: '1. Skillet.', prep_time_min: 20, is_meal_prep: true,
          } }),
        });
      });

      await page.goto(BASE + '/planner', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await page.getByText('Build the plan').click();
      await page.waitForTimeout(3000);
      check(sent[0]?.avoid === 'no fish, no dairy', 'and rides along with the recipe request',
        String(sent[0]?.avoid));

      const afterBuild = JSON.parse(await page.evaluate(() => localStorage.getItem('plan_quota')) ?? '{}');
      check(afterBuild.used === 1, 'a built plan costs one of the three', String(afterBuild.used));

      // The rejection that used to cost a third of the week.
      const reject = page.getByText('Not this one');
      check(await reject.count() === 1, 'a plate you cannot eat can be rejected');
      await reject.click();
      await page.waitForTimeout(3000);
      const afterReject = JSON.parse(await page.evaluate(() => localStorage.getItem('plan_quota')) ?? '{}');
      check(afterReject.used === 1, 'and the rejection is free', String(afterReject.used));
      check(sent.length === 2, 'while still asking for a different plate', String(sent.length));
      check(await page.getByText('Not this one').count() === 0,
        'one rejection per build, not an endless supply');
      await context.close();
    }
  }

  // ------------------------------------------------------ THE LINE TURNED
  section('Gaining gets an answer');
  {
    // The worst response the app could give: four weeks of the weight climbing
    // and a headline saying "Carry on. Nothing to change this week." with the
    // rising trend printed underneath it.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    const { context, page } = await newPage(browser, {
      ...SEED, user_premium: 'true',
      onboarding_profile: JSON.stringify({
        weight_kg: 88, height_cm: 183, age: 34, sex: 'male',
        fitness_level: 'advanced', goal: 'weight_loss',
        omad_window_start: '20:30', omad_window_hours: 2, default_training_time: '19:00',
      }),
      intake_log: JSON.stringify(Array.from({ length: 14 }, (_, i) => ({
        date: day(13 - i), factor: 1, target_kcal: 2600,
      }))),
      weight_log: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({
        id: `u${i}`, date: day(21 - i * 3), weight_kg: Math.round((88 + i * 0.13) * 10) / 10,
      }))),
    });
    await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const t = await body(page);
    check(!has(t, 'Carry on'), 'a rising line is not "nothing to change"');
    check(has(t, 'The line has turned'), 'it says what happened', t.match(/The line[^.]*/)?.[0] ?? '');
    // The screen renders the decision's own wording, not readPlateau's note.
    check(/\d+ days climbing at this intake/.test(t), 'and for how long',
      t.match(/\d+ days climbing[^.]*\./)?.[0] ?? '');
    check(has(t, 'gone the other way'), 'naming what the deficit did');
    check(/Eat \d{4} kcal this week/.test(t), 'with a figure to act on',
      t.match(/Eat \d{4} kcal this week/)?.[0] ?? '');
    // Same rule as everywhere: state it, do not scold.
    check(!/should|too much|slipped|failed|discipline/i.test(t), 'and nobody is told off');
    await context.close();
  }

  // ----------------------------------------------------- A LAPSED MEASUREMENT
  section('A measurement that lapsed says so');
  {
    // Every reading looks at 21 days. Three weeks away and the figure is gone,
    // the target silently reverts to the formula, and nothing used to mention it.
    const { context, page } = await newPage(browser, {
      ...SEED, user_premium: 'true',
      measurement_announced: 'true',
      intake_log: '[]',
      weight_log: JSON.stringify([{ id: 'l1', date: '2026-01-05', weight_kg: 88 }]),
    });
    await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const t = await bodyIn(page, 'Your body');
    check(has(t, 'has lapsed'), 'the card says the measurement expired',
      t.match(/Your measurement[^.]*\./)?.[0] ?? '');
    check(has(t, '21 days'), 'and why — it reads a window');
    check(!has(t, 'Not enough to measure yet'), 'rather than the first-run wording');
    await context.close();
  }

  // ------------------------------------------------- ASKING FOR WHAT IT NEEDS
  section('The app asks for what the measurement needs');
  {
    // The defect: weeklyDecision counted intake days only. After eight
    // evenings it said "carry on" while the measurement was still impossible
    // for want of weigh-ins — and nothing in the app had ever asked for one.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    const evenings = Array.from({ length: 10 }, (_, i) => ({
      date: day(9 - i), factor: 1, target_kcal: 2000,
    }));

    {
      const { context, page } = await newPage(browser, {
        // SEED carries three weigh-ins; this block is about having none.
        ...SEED, intake_log: JSON.stringify(evenings), weight_log: '[]',
        onboarding_profile: JSON.stringify({
          weight_kg: 90, height_cm: 183, age: 34, sex: 'male',
          fitness_level: 'advanced', goal: 'weight_loss',
          omad_window_start: '20:30', omad_window_hours: 2, default_training_time: '19:00',
        }),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(!has(t, 'Carry on'), 'ten evenings and no scale is not "nothing to change"');
      check(/weigh-in/i.test(t), 'it asks for the scale instead',
        t.match(/\d+ more weigh-ins?/i)?.[0] ?? '');
      check(has(t, 'of 8 evenings'), 'while crediting what is already done');
      await context.close();
    }

    // The progress line on the screen people actually land on.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, intake_log: JSON.stringify(evenings.slice(0, 5)), weight_log: '[]',
      });
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Until your maintenance can be measured'), 'the dashboard carries the countdown');
      check(/5 of 8 evenings/.test(t), 'and counts the evenings',
        t.match(/\d+ of 8 evenings/)?.[0] ?? '');
      check(/0 of 4 weigh-ins/.test(t), 'and the weigh-ins, which nothing used to mention',
        t.match(/\d+ of 4 weigh-ins/)?.[0] ?? '');
      await context.close();
    }
  }

  // ------------------------------------------------- THE FIRST FIGURE, ONCE
  section('The first measured figure is shown once');
  {
    // Two weeks of answering evenings and standing on a scale used to end with
    // a number the person could not see. Showing it once is a better argument
    // for paying than any description of it, because what premium sells is not
    // the number — it is the number continuing to move.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    const seed = {
      ...SEED,
      intake_log: JSON.stringify(Array.from({ length: 14 }, (_, i) => ({
        date: day(13 - i), factor: 1, target_kcal: 1800,
      }))),
      weight_log: JSON.stringify(Array.from({ length: 7 }, (_, i) => ({
        id: `p${i}`, date: day(12 - i * 2), weight_kg: Math.round((85 - i * 0.14) * 10) / 10,
      }))),
    };

    const { context, page } = await newPage(browser, seed);

    // The daily target before the preview, so the rule can be checked after.
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    const targetBefore = (await body(page)).match(/(\d{4})\s*kcal/)?.[1] ?? null;
    check(targetBefore !== null, 'the dashboard shows a daily target', String(targetBefore));

    await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const first = await bodyIn(page, 'Your body');
    check(/\d{4}\s*kcal a day/.test(first), 'a free user sees the measured figure once',
      first.match(/\d{4}\s*kcal a day/)?.[0] ?? '');
    check(has(first, 'two weeks earning'), 'and is told what it is');
    check(has(first, 'Premium keeps measuring it'), 'and what premium actually sells');

    const stored = await page.evaluate(() => localStorage.getItem('measurement_previewed'));
    check(stored === 'true', 'the showing is recorded', String(stored));

    // The rule that must not slip: the preview is display only. If it moved
    // the daily target, the target would jump once and jump back, which is
    // worse than never showing the figure.
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    const targetAfter = (await body(page)).match(/(\d{4})\s*kcal/)?.[1] ?? null;
    check(targetAfter === targetBefore, 'and the daily target did not move',
      `${targetBefore} → ${targetAfter}`);

    // Second visit: gated again.
    await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const second = await bodyIn(page, 'Your body');
    check(!/\d{4}\s*kcal a day/.test(second), 'a second visit no longer shows the figure',
      second.match(/\d{4}\s*kcal a day/)?.[0] ?? '');
    check(has(second, "The formula's estimate is off"), 'and the usual pitch is back');
    await context.close();
  }

  // ------------------------------------------------------ THE SCALE JUMPED
  section('Why the scale is higher');
  {
    // The day people delete the app. Every soothing app says "it's just water",
    // which is a claim about a body it has not looked at. The arithmetic comes
    // first here and rules out the thing they are actually afraid of.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    {
      const { context, page } = await newPage(browser, {
        ...SEED,
        weight_log: JSON.stringify([
          { id: 'j1', date: day(2), weight_kg: 90 },
          { id: 'j2', date: day(0), weight_kg: 91.5 },
        ]),
        intake_log: JSON.stringify([{ date: day(1), factor: 1.7, target_kcal: 2000 }]),
      });
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Up 1.5 kg'), 'the jump is named as measured');
      check(has(t, '11,550 kcal'), 'and what that much fat would have cost',
        t.match(/[\d,]+ kcal on top/)?.[0] ?? '');
      check(has(t, 'water'), 'the mechanism is named second');
      check(/trend/i.test(t), 'with what to read instead');
      check(!/don.t worry|no need to|keep going|you.ve got this/i.test(t),
        'and nothing that reassures rather than explains');
      await context.close();
    }

    // Scatter is not a jump, and a fast loss gets no card at all.
    {
      const { context, page } = await newPage(browser, {
        ...SEED,
        weight_log: JSON.stringify([
          { id: 'q1', date: day(1), weight_kg: 90 },
          { id: 'q2', date: day(0), weight_kg: 90.4 },
        ]),
      });
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      check(!/Up [\d.]+ kg/.test(await body(page)), 'four hundred grams says nothing');
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, {
        ...SEED,
        weight_log: JSON.stringify([
          { id: 'd1', date: day(1), weight_kg: 92 },
          { id: 'd2', date: day(0), weight_kg: 90 },
        ]),
      });
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      check(!/Up [\d.]+ kg/.test(await body(page)), 'and losing two kilos fast gets no card');
      await context.close();
    }
  }

  // ------------------------------------------------------- DAYS LEFT OUT
  section('Days left out of comparisons only');
  {
    // The rule the whole feature stands on: marking days changes what the app
    // compares and never what it measured. Anyone who could exclude days from
    // the measurement could mark their way to a flattering number.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    const { context, page } = await newPage(browser, {
      ...SEED, user_premium: 'true',
      intake_log: JSON.stringify(Array.from({ length: 20 }, (_, i) => ({
        date: day(19 - i), factor: i > 16 ? 1.7 : 1, target_kcal: 2000,
      }))),
      weight_log: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({
        id: `o${i}`, date: day(18 - i * 2.5 | 0), weight_kg: 90 - i * 0.3,
      }))),
    });
    // The reading and the correction now live on two pages, so this walks the
    // path a person walks: read the figure, go and mark the day, come back.
    const measuredOf = async () => {
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1600);
      await page.getByLabel('Your body').click();
      await page.waitForTimeout(700);
      const t = await bodyIn(page, 'Your body');
      return t.match(/(\d{4})\s*kcal a day/)?.[1] ?? null;
    };
    const before = await measuredOf();
    check(before !== null, 'the fixture produces a measured figure', String(before));

    const openCorrections = async () => {
      await page.goto(BASE + '/week/corrections', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1400);
    };

    await openCorrections();
    const cell = page.getByLabel(`Leave out ${day(1)}`);
    check(await cell.count() === 1, 'yesterday can be left out');
    await cell.click();
    await page.waitForTimeout(900);

    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('outlier_days')) ?? '[]');
    check(stored.length === 1 && stored[0] === day(1), 'and the day is recorded', JSON.stringify(stored));
    const afterMark = await measuredOf();
    check(afterMark === before,
      'the measurement does not move — that is the rule', `${before} → ${afterMark}`);

    await openCorrections();
    await page.getByLabel(`Leave out ${day(1)}`).click();
    await page.waitForTimeout(800);
    const after = JSON.parse(await page.evaluate(() => localStorage.getItem('outlier_days')) ?? '[]');
    check(after.length === 0, 'and tapping again puts the day back', JSON.stringify(after));
    await context.close();
  }

  // ---------------------------------------------------------- THE BIG DAY
  section('A big day can be planned before it happens');
  {
    // Everything else on this screen reads backwards. Nobody plans a wedding
    // retrospectively, so this is the one card that answers a question about a
    // day that has not happened.
    const label = (d) => d.toLocaleDateString(undefined, { weekday: 'narrow' });
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowISO = localISO(tomorrow);
    // Sunday has nothing after it, so there is no day to plan against.
    const skip = new Date().getDay() === 0 || new Date().getDay() === 6;

    if (!skip) {
      {
        const { context, page } = await newPage(browser, { ...SEED, user_premium: 'true' });
        await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1800);
        await page.getByLabel('This week').click();
        await page.waitForTimeout(600);

        const t0 = await body(page);
        check(has(t0, 'A big day coming up'), 'the card is there');
        // Nothing is claimed before a day is picked.
        check(!/kcal on the other days/.test(t0), 'and says nothing until a day is chosen');

        await page.getByLabel(`Big day on ${tomorrowISO}`).click();
        await page.waitForTimeout(600);
        const t1 = await body(page);
        check(/\d{3,4} kcal on the other days/.test(t1), 'picking a day produces a figure',
          t1.match(/\d{3,4} kcal on the other days/)?.[0] ?? '');
        const first = Number(t1.match(/(\d{3,4}) kcal on the other days/)?.[1] ?? 0);

        await page.getByLabel('About 2000 kcal over').click();
        await page.waitForTimeout(600);
        const t2 = await body(page);
        const second = Number(t2.match(/(\d{3,4}) kcal on the other days/)?.[1] ?? 0);
        // The whole claim of the card: a bigger evening leaves less, and by a
        // figure that moves rather than a sentence that is always the same.
        check(second === 0 || second < first, 'a bigger day leaves less for the rest',
          `${first} → ${second}`);
        check(!/should|careful|avoid|warning/i.test(t2), 'and never tells anyone off');

        // Tapping the day again puts the card back to saying nothing.
        await page.getByLabel(`Big day on ${tomorrowISO}`).click();
        await page.waitForTimeout(500);
        check(!/kcal on the other days/.test(await body(page)), 'unpicking the day withdraws the claim');
        await context.close();
      }

      {
        const { context, page } = await newPage(browser, SEED);
        await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1800);
        await page.getByLabel('This week').click();
        await page.waitForTimeout(600);
        await page.getByLabel(`Big day on ${tomorrowISO}`).click();
        await page.waitForTimeout(600);
        const t = await body(page);
        check(has(t, 'A big day coming up'), 'free users see the card exists');
        check(!/kcal on the other days/.test(t), 'but never the redistributed figure');
        await context.close();
      }
    } else {
      check(true, 'skipped near the end of the week — there is no day left to plan');
    }
  }

  // ------------------------------------------------------ CORRECTING A WEEK
  section('The intake week can be corrected');
  {
    const { context, page } = await newPage(browser, SEED);
    await page.goto(BASE + '/week/corrections', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    // The strip is the page; there is no tab to select.


    const today = localISO();
    const cell = page.getByLabel(new RegExp(`^${today}: `));
    check(await cell.count() === 1, 'today has a cell in the intake strip', String(await cell.count()));
    check(/not answered/.test(await cell.getAttribute('aria-label') ?? ''),
      'and starts unanswered', await cell.getAttribute('aria-label'));

    // Tomorrow cannot be claimed, the same rule the fast strip follows.
    const tomorrow = localISO(new Date(Date.now() + 86400000));
    check(await page.getByLabel(new RegExp(`^${tomorrow}: `)).count() === 0,
      'and nothing in the future is offered');

    await cell.click();
    await page.waitForTimeout(700);
    let log = JSON.parse(await page.evaluate(() => localStorage.getItem('intake_log')) ?? '[]');
    check(log.length === 1 && log[0].factor === 1, 'one tap records the plan',
      JSON.stringify(log));

    await cell.click();
    await page.waitForTimeout(700);
    log = JSON.parse(await page.evaluate(() => localStorage.getItem('intake_log')) ?? '[]');
    check(log.length === 1 && log[0].factor === 0.75, 'a second replaces it rather than adding',
      JSON.stringify(log));

    // The reason null is part of the cycle: an accidental tap has to be
    // undoable, or the strip could only ever invent answers. The lap is as long
    // as the option list, and hardcoding its length has now been wrong twice —
    // once when the fourth answer arrived and once when the scale opened at
    // both ends. Tap until it comes back instead, bounded so a strip that never
    // clears fails rather than hangs.
    let taps = 0;
    while (taps < 12) {
      log = JSON.parse(await page.evaluate(() => localStorage.getItem('intake_log')) ?? '[]');
      if (log.length === 0) break;
      await cell.click();
      await page.waitForTimeout(700);
      taps++;
    }
    check(log.length === 0, 'and a full lap takes the answer back entirely', JSON.stringify(log));
    await context.close();
  }

  // ------------------------------------------------------- CORRECTING AN ANSWER
  section('The evening answer can be corrected');
  {
    // Everything measured about the metabolism rests on these taps, so a wrong
    // one has to be replaceable — and replacing it must overwrite the day
    // rather than log a second one, which would double-count the day.
    const { context, page } = await newPage(browser, {
      ...SEED, onboarding_profile: closedWindowProfile(),
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);

    await page.getByLabel(/^Ate the plan, about \d+ kcal$/).click();
    await page.waitForTimeout(600);
    const t = await body(page);
    check(/(Today|Yesterday): ate the plan/i.test(t), 'the answer stays on screen',
      t.match(/(Today|Yesterday): ate \w+( \w+)?/i)?.[0] ?? '');
    check(has(t, 'change'), 'and offers to change it');

    await page.getByLabel("Change today's answer").click();
    await page.waitForTimeout(600);
    check(has(await body(page), 'Ate less'), 'tapping it puts the options back');

    await page.getByLabel(/^Ate less, about \d+ kcal$/).click();
    await page.waitForTimeout(800);
    const log = JSON.parse(await page.evaluate(() => localStorage.getItem('intake_log')) ?? '[]');
    check(log.length === 1, 'the correction replaces a day rather than adding one', String(log.length));
    check(log[0]?.factor === 0.75, 'and the new answer is what survives', String(log[0]?.factor));

    // The ends of the scale, which is where the measurement was being lied to.
    // A day at three times the target used to land on the highest option there
    // was, and the mean it feeds is what the paid figure is built from.
    await page.getByLabel("Change today's answer").click();
    await page.waitForTimeout(600);
    const opts = await body(page);
    check(has(opts, 'Well over double'), 'the scale has an answer for a runaway day');
    check(has(opts, 'Barely ate'), 'and one for a day that barely happened');

    await page.getByLabel(/^Well over double, about \d+ kcal$/).click();
    await page.waitForTimeout(800);
    const wide = JSON.parse(await page.evaluate(() => localStorage.getItem('intake_log')) ?? '[]');
    check(wide[0]?.factor === 2.4, 'and the wider answer is what gets recorded', String(wide[0]?.factor));
    await context.close();
  }

  // -------------------------------------------------------- THIS WEEK'S CHANGE
  section('One change a week');
  {
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    // Explicit profile: SEED trains at 19:00 inside an 18:00 window and is set
    // to muscle gain, so it exercises different branches than these blocks want.
    const losingProfile = (windowStart) => JSON.stringify({
      weight_kg: 90, height_cm: 183, age: 34, sex: 'male',
      fitness_level: 'advanced', goal: 'weight_loss',
      omad_window_start: windowStart, omad_window_hours: 2, default_training_time: '19:00',
    });

    // A window that clashes with training is a fixable, concrete thing.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, onboarding_profile: losingProfile('18:00'),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1600);
      const t = await body(page);
      check(has(t, 'This week'), 'the decision card leads the screen');
      check(has(t, 'Move your eating window'), 'a session inside the window is the thing to fix');
      check(has(t, '20:15'), 'with the time to move it to');
    await context.close();
    }

    // Window already fine, nothing logged: ask for the signal that unlocks the rest.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, onboarding_profile: losingProfile('20:30'),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1600);
      const t = await body(page);
      check(has(t, 'Answer the evening question'), 'otherwise it asks for the missing signal');
      // Anchored to the decision card, not to any "more days" on the screen —
      // the measurement card says something similar and made this pass once
      // for the wrong reason.
      check(/Answer the evening question\s*\n?\s*8 more days/.test(t),
        'counting exactly what is needed', t.match(/\d+ more days[^.]*/)?.[0] ?? '');
      await context.close();
    }

    // A long deficit outranks the window, and names what to eat.
    {
      const weights = Array.from({ length: 11 }, (_, i) => ({
        id: `d${i}`, date: day(60 - i * 6), weight_kg: 90 - i * 0.5,
      }));
      const intake = Array.from({ length: 14 }, (_, i) => ({
        date: day(13 - i), factor: 1, target_kcal: 2000,
      }));
      const { context, page } = await newPage(browser, {
        ...SEED, user_premium: 'true', onboarding_profile: losingProfile('18:00'),
        weight_log: JSON.stringify(weights), intake_log: JSON.stringify(intake),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'Take a week at maintenance'), 'a long run outranks the window clash');
      check(/Eat \d{4} kcal for seven days/.test(t), 'with a figure to eat during it',
        t.match(/Eat \d{4} kcal for seven days/)?.[0] ?? '');
      check(has(t, 'by accident'), 'and says why planning it matters');
      // The forecast that bends rather than divides.
      const f = await bodyIn(page, 'Your body');
      check(/About \d+ weeks to [\d.]+ kg/.test(f), 'and the forecast names a horizon',
        f.match(/About \d+ weeks to [\d.]+ kg/)?.[0] ?? '');
      await context.close();
    }
  }

  // ---------------------------------------------------------------- PLATEAU
  section('Plateau');
  {
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
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
      // The stall used to have a card of its own, which could never appear:
      // weeklyDecision ranks a stall above everything, so the decision card was
      // always already saying it. These assert the surviving sentence.
      check(has(t, 'your maintenance has moved'), 'a stall is named rather than left to be guessed at');
      check(has(t, 'not your effort'), 'and it says whose fault it is not');
      check(/\d+ days holding/.test(t), 'with the days it has held',
        t.match(/\d+ days holding/)?.[0] ?? '');
      check(/Eat \d{4} kcal this week/.test(t), 'and a concrete new target',
        t.match(/Eat \d{4}[^.]*/)?.[0] ?? '');
      check(!has(t, 'weight has held'), 'and the duplicate plateau card is gone');
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, seed);
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await body(page);
      check(has(t, 'your maintenance has moved'), 'the stall itself is shown without premium');
      check(/\d+ days holding/.test(t), 'including how long, which is not the paid part');
      check(!/Eat \d{4} kcal this week/.test(t), 'but the new figure is not');
      // Three cards could ask for money at once here before.
      const asks = (t.match(/see (what it measured|where this leads|the new target)/gi) ?? []).length;
      check(asks <= 1, `at most one card asks for money — found ${asks}`);
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
      return localISO(d);
    };
    const intake = Array.from({ length: 14 }, (_, i) => ({
      date: day(13 - i), factor: 1, target_kcal: 1800,
    }));
    const weights = Array.from({ length: 7 }, (_, i) => ({
      id: `w${i}`, date: day(12 - i * 2), weight_kg: 85 - i * (0.5 * 2 / 7),
    }));

    // Without premium: the app says it measured something, not what. Seeded as
    // already previewed, because the first sight of the figure is free by
    // design now — this block is about the gate that follows it.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, intake_log: JSON.stringify(intake), weight_log: JSON.stringify(weights),
        measurement_previewed: 'true',
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await bodyIn(page, 'Your body');
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
      const t = await bodyIn(page, 'Your body');
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
      const t = await bodyIn(page, 'Your body');
      check(has(t, 'Not enough to measure yet'), 'thin data produces a request, not a figure');
      check(!/\d{4}\s*kcal a day/.test(t), 'and no number is shown');
      await context.close();
    }
  }

  // ------------------------------------------------------- MONTH VS MONTH
  section('Month against month');
  {
    // Two full months, same behaviour, different body. The point of the card is
    // that the second month buys less weight loss for the same food — which is
    // arithmetic, not encouragement.
    const monthData = (ym, startKg, perDay, kcal) => ({
      intake: Array.from({ length: 12 }, (_, i) => ({
        date: `${ym}-${String(i + 2).padStart(2, '0')}`, factor: 1, target_kcal: kcal,
      })),
      weights: Array.from({ length: 5 }, (_, i) => ({
        id: `${ym}-${i}`, date: `${ym}-${String(i * 6 + 2).padStart(2, '0')}`,
        weight_kg: Math.round((startKg - i * 6 * perDay) * 10) / 10,
      })),
    });
    const a = monthData('2026-05', 95, 0.07, 2400);
    const b = monthData('2026-07', 84, 0.03, 2100);
    const seed = {
      ...SEED,
      intake_log: JSON.stringify([...a.intake, ...b.intake]),
      weight_log: JSON.stringify([...a.weights, ...b.weights]),
    };

    {
      const { context, page } = await newPage(browser, { ...seed, user_premium: 'true' });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await bodyIn(page, 'Your body');
      check(has(t, 'Month against month'), 'the comparison card is there');
      check(has(t, '2026-05') && has(t, '2026-07'), 'and names both months');
      check(/kg at \d{4} kcal a day/.test(t), 'with the weight change and what was eaten',
        t.match(/[-\d.]+ kg at \d{4} kcal a day/)?.[0] ?? '');
      check(/maintenance is about \d+ kcal lower/.test(t),
        'and explains the falling maintenance rather than asserting it',
        t.match(/maintenance is about \d+ kcal lower/)?.[0] ?? '');
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, seed);
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const t = await bodyIn(page, 'Your body');
      check(has(t, 'Month against month'), 'free users see that the comparison exists');
      check(!/maintenance is about \d+ kcal lower/.test(t), 'but not the figure itself');
    await context.close();
    }

    // One month alone is not a comparison, and must not be dressed up as one.
    {
      const { context, page } = await newPage(browser, {
        ...SEED, user_premium: 'true',
        intake_log: JSON.stringify(a.intake), weight_log: JSON.stringify(a.weights),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      check(!has(await bodyIn(page, 'Your body'), 'Month against month'),
        'a single month produces no card at all');
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

    await page.goto(BASE + '/you/sync', { waitUntil: 'networkidle' });
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
    await page.goto(BASE + '/you/data', { waitUntil: 'networkidle' });
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

    // The page must not sell what the free plan already does. offer.ts asserts
    // this over the data; this asserts it over what a user actually reads,
    // which is the version that would have appeared in a store listing.
    for (const free of ['session-aware', 'reheat', 'unlimited coaching', 'meal-prep instruction']) {
      check(!has(t, free), `the paywall does not sell "${free}", which is free`);
    }
    // And it does lead with the thing that is genuinely gated.
    check(has(t, 'what your body actually costs'), 'the measured maintenance is the offer');

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
      return localISO(d);
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
    check(has(t, 'First week'), 'the adaptation phase is named', t.match(/First (days|week)|Settling|Settled/)?.[0]);
    check(has(t, '4 days logged'), 'and counts the days actually logged');
    check(!/cure|prevent|detox|proven|guarantee/i.test(t), 'progress makes no health claim');

    // A streak you cannot correct stops being true — that is the whole point.
    // Anchored to the fast strip's own labels: a bare [role="checkbox"] also
    // matched the days-to-leave-out strip once that existed, so the count was
    // fourteen and the taps landed on whichever came first.
    // The count is read on Progress and the correction is made on its own
    // page, so this walks between them the way a person does.
    const dayCount = async () => {
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      // Wait for the card rather than for a guess at how long it takes.
      await page.waitForFunction(
        () => /\d+ days? logged/.test(document.body.innerText),
        null,
        { timeout: 12000 }
      );
      return page.evaluate(() =>
        Number((document.body.innerText.match(/(\d+) days? logged/) ?? [])[1] ?? -1));
    };
    const openCorrections = async () => {
      await page.goto(BASE + '/week/corrections', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1400);
    };

    const startDays = await dayCount();
    await openCorrections();

    const cells = page.getByLabel(/^Fast on /);
    const before = await cells.count();
    check(before === 7, 'seven days are offered', String(before));

    // Tick an unlogged day, then untick it again.
    await page.locator('[role="checkbox"][aria-checked="false"]')
      .and(page.getByLabel(/^Fast on /)).first().click();
    await page.waitForTimeout(900);
    const ticked = JSON.parse(await page.evaluate(() => localStorage.getItem('fast_log')) ?? '[]');
    check(ticked.length === 5, 'the tap reaches storage', JSON.stringify(ticked));
    // Once, not twice: dayCount navigates, so calling it again just to build
    // the message doubled a page load for a string.
    const afterTick = await dayCount();
    check(afterTick === startDays + 1, 'adding a missed fast counts it',
      `${startDays} -> ${afterTick}`);

    await openCorrections();
    await page.getByLabel(/^Fast on /)
      .and(page.locator('[aria-checked="true"]')).last().click();
    await page.waitForTimeout(900);
    const afterUntick = await dayCount();
    check(afterUntick === startDays, 'and a mistap can be taken back', `back to ${afterUntick}`);
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
  // ---------------------------------------------------- WHAT THE COACH KNOWS
  section('The coach says what it is not being told');
  {
    // The gate nobody could see. The chat is unlimited on both tiers; what
    // premium buys is what it reasons with. Withholding that silently meant a
    // free user got worse answers and no way to know why — and the paywall
    // never mentioned it either.
    const day = (back) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return localISO(d);
    };
    const measurable = {
      ...SEED,
      intake_log: JSON.stringify(Array.from({ length: 16 }, (_, i) => ({
        date: day(15 - i), factor: 1, target_kcal: 2000,
      }))),
      weight_log: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({
        id: `c${i}`, date: day(14 - i * 2), weight_kg: 90 - i * 0.25,
      }))),
    };

    const bodiesFor = async (seed) => {
      const { context, page } = await newPage(browser, seed);
      const sent = [];
      await context.route('**/functions/v1/chat', (route) => {
        try { sent.push(JSON.parse(route.request().postData() ?? '{}')); } catch { sent.push({}); }
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ response: 'Noted.' }),
        });
      });
      await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const shown = await body(page);
      await page.getByLabel('Message').fill('What should I eat tonight?');
      await page.getByLabel('Send').click();
      await page.waitForTimeout(2500);
      await context.close();
      return { shown, sent };
    };

    {
      const { shown, sent } = await bodiesFor(measurable);
      check(has(shown, 'general ranges'), 'a free user is told the answers are generic');
      check(has(shown, 'Premium'), 'and what would change that');
      // The claim behind the notice: the figures really are withheld.
      const payload = JSON.stringify(sent[0] ?? {});
      check(!/measured_maintenance_kcal["\s:]+\d/.test(payload),
        'and the measured figure is genuinely not sent',
        payload.slice(0, 120));
    }

    {
      const { shown, sent } = await bodiesFor({ ...measurable, user_premium: 'true' });
      check(!has(shown, 'general ranges'), 'a paying user is not told what they already have');
      const payload = JSON.stringify(sent[0] ?? {});
      check(/measured_maintenance_kcal["\s:]+\d/.test(payload),
        'and their own figures do go with the question',
        payload.match(/measured_maintenance_kcal[^,]*/)?.[0] ?? payload.slice(0, 120));
    }
  }

  // ------------------------------------------------------------- LANDING SELLS
  section('The landing page names the differentiator');
  {
    const { context, page } = await newPage(browser, null);
    await page.goto(BASE + '/landing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const t = await body(page);
    // It sold timing, session macros and reheat instructions for months. All
    // true, all free, all things a dozen other apps do.
    check(/measures what you burn/i.test(t), 'the measurement leads the page');
    check(/what your body actually costs/i.test(t), 'and says what that means');
    check(/how many days it still needs/i.test(t),
      'including that it refuses to claim a figure early');
    check(!/\d+\s*%|\d[\d,]{2,}\s*(users|people|members)/i.test(t),
      'and still invents no numbers', t.match(/\d+\s*%/)?.[0] ?? '');
    await context.close();
  }

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
    // Logging and correcting live on their own page now; the week tab keeps
    // the readings.
    await page.goto(BASE + '/week/corrections', { waitUntil: 'networkidle' });
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

  // ---------------------------------------------------------- TARGET WEIGHT
  section('Target weight');
  {
    // The default is BMI 22, which at 183 cm asks for 73.7 kg — a population
    // midpoint nobody chose, and the forecast used to aim at it regardless.
    const profileOf = (extra) => JSON.stringify({
      weight_kg: 85, height_cm: 183, age: 34, sex: 'male',
      fitness_level: 'advanced', goal: 'weight_loss',
      omad_window_start: '18:00', omad_window_hours: 2, default_training_time: '19:00',
      ...extra,
    });

    {
      const { context, page } = await newPage(browser, { ...SEED, onboarding_profile: profileOf({}) });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      check(has(await bodyIn(page, 'History'), 'target 73.7'), 'an unset target still falls back to a healthy BMI');
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, {
        ...SEED, onboarding_profile: profileOf({ target_weight_kg: 79 }),
      });
      await page.goto(BASE + '/progress', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const t = await bodyIn(page, 'History');
      check(has(t, 'target 79.0'), 'a chosen target is what the bar aims at');
      check(!has(t, 'target 73.7'), 'and the formula no longer overrides it');
      await context.close();
    }

    // Settable from the profile screen, or it is not really the user's choice.
    {
      const { context, page } = await newPage(browser, { ...SEED, onboarding_profile: profileOf({}) });
      await page.goto(BASE + '/you/body', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      check(has(await body(page), 'target weight'), 'the profile offers a target weight');
      await page.getByLabel('Edit Target weight').click();
      await page.waitForTimeout(300);
      await page.getByLabel('Target weight').fill('79');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('onboarding_profile')));
      check(saved.target_weight_kg === 79, 'and stores what was typed', String(saved.target_weight_kg));
      await context.close();
    }
  }

  await browser.close();
  return r.finish();
}
