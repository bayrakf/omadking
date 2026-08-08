/**
 * Shared setup for the browser suites.
 *
 * These check what `npm run check` cannot: that the screens actually render,
 * that state survives a reload, and that the app never quietly grants premium.
 * They live in the repo rather than a scratch directory so they survive the
 * session that wrote them.
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

export const BASE = process.env.E2E_URL ?? 'http://localhost:4599';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function chromePath() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.\n' +
        'Tried:\n  ' + CHROME_CANDIDATES.join('\n  ')
    );
  }
  return found;
}

/** A profile with enough history that every screen has something to show. */
/**
 * A window that is definitely shut right now.
 *
 * Several checks only apply while fasting — the physiology band, the evening
 * question. Seeding a fixed 18:00 meant they were red for the two hours a day
 * the window happened to be open, which is a test that lies about the code
 * twice a day.
 */
export function closedWindowProfile(extra = {}) {
  const opensIn = (new Date().getHours() + 6) % 24;
  return JSON.stringify({
    weight_kg: 82, height_cm: 183, age: 34,
    sex: 'male', fitness_level: 'advanced', goal: 'muscle_gain',
    omad_window_start: `${String(opensIn).padStart(2, '0')}:00`,
    omad_window_hours: 2,
    default_training_time: '19:00',
    ...extra,
  });
}

export const SEED = {
  onboarding_complete: 'true',
  onboarding_profile: JSON.stringify({
    weight_kg: 82, height_cm: 183, age: 34,
    sex: 'male', fitness_level: 'advanced', goal: 'muscle_gain',
    omad_window_start: '18:00', omad_window_hours: 2,
    default_training_time: '19:00',
  }),
  weight_log: JSON.stringify([
    { id: '1', date: '2026-07-28', weight_kg: 83.2 },
    { id: '2', date: '2026-08-01', weight_kg: 82.6 },
    { id: '3', date: '2026-08-04', weight_kg: 82.0 },
  ]),
};

/**
 * Today as the app sees it.
 *
 * Everything the app stores is dated with `todayISO`, which is local. The suite
 * was dating its seeds and its expectations with `toISOString`, which is UTC.
 * The two agree for most of the day and disagree between local midnight and UTC
 * midnight — so the suite passed until it was run in that window, and then
 * failed on assertions that had nothing to do with what was being tested.
 */
export const localISO = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const PLAN = {
  date: localISO(),
  eating_window_start: '18:00',
  eating_window_end: '20:00',
  total_kcal: 3310, protein_g: 164, carbs_g: 452, fat_g: 92,
  pre_training_snack_time: null,
  main_meal_time: '18:30',
  ai_reasoning: 'Test reasoning.',
  timing_warning: null,
  training_burn_kcal: 492,
  timing_pattern: 'post',
  training_start_time: '19:00',
  training_duration_min: 60,
  recipe: {
    title: 'Test Recovery Plate',
    ingredients: ['320g chicken breast', '350g sweet potato', '2 tbsp olive oil', '250g broccoli'],
    instructions: '1. Season the protein. 2. Roast at 200C for 22 mins. 3. Sear 6 mins per side.',
    reheat_instructions: '1. Skillet: 4 mins. 2. Air fryer: 180C for 4 mins.',
    prep_time_min: 30,
    is_meal_prep: true,
  },
};

/** Seed including today's plan, for screens that need one. */
export const SEED_WITH_PLAN = {
  ...SEED,
  last_meal_plan: JSON.stringify(PLAN),
  meal_history: JSON.stringify([PLAN]),
};

export function createReporter(title) {
  let failures = 0;
  let total = 0;
  return {
    section(name) {
      console.log(`\n▶ ${name}`);
    },
    check(ok, msg, extra = '') {
      total++;
      if (!ok) failures++;
      console.log(`   ${ok ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`);
    },
    finish() {
      const ok = failures === 0;
      console.log(
        ok
          ? `\n=== ${title}: ALL ${total} CHECKS PASSED ===`
          : `\n=== ${title}: ${failures} OF ${total} CHECKS FAILED ===`
      );
      return { ok, total, failures };
    },
  };
}

export async function launch() {
  return chromium.launch({ executablePath: chromePath(), headless: true });
}

/** Fresh context so localStorage never leaks between checks. */
export async function newPage(browser, seed = SEED) {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  // Without this a mistyped selector waits forever and the whole suite hangs
  // instead of failing. A wrong test should be loud, not slow.
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  if (seed) {
    await page.addInitScript((d) => {
      for (const [k, v] of Object.entries(d)) window.localStorage.setItem(k, v);
    }, seed);
  }
  return { context, page, errors };
}

export const body = (page) =>
  page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

/**
 * Progress shows five cards at a time behind three segments instead of sixteen
 * at once. A test that asserts on a card therefore has to say which segment it
 * lives in, or it asserts on whatever the default tab happens to hold.
 */
export async function bodyIn(page, segment) {
  await page.getByLabel(segment).click();
  await page.waitForTimeout(500);
  return body(page);
}

/** Case-insensitive contains — Eyebrow uppercases via CSS, so innerText does too. */
export const has = (haystack, needle) =>
  String(haystack).toLowerCase().includes(String(needle).toLowerCase());
