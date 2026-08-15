/**
 * Runs the self-checks in the pure logic modules.
 *
 *   npm run check
 *
 * These modules deliberately avoid React and AsyncStorage imports so they can
 * be compiled and executed in plain node — no test framework needed.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MODULES = ['nutrition', 'onboarding', 'dates', 'grocery', 'agenda', 'ai', 'review', 'markdown', 'typography', 'legal', 'crypto', 'sync-merge', 'energy', 'offer'];

// Inside the project, not the system temp dir: the compiled modules import
// real packages now (@noble/ciphers), and node resolves those by walking up
// from the importing file. From /tmp there is nothing to walk up to.
const cacheRoot = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cacheRoot, { recursive: true });
const outDir = mkdtempSync(join(cacheRoot, 'omadcoach-check-'));

try {
  execFileSync(
    'npx',
    [
      'tsc',
      ...MODULES.map((m) => `src/lib/${m}.ts`),
      '--ignoreConfig',
      '--outDir',
      outDir,
      '--module',
      'commonjs',
      '--target',
      'es2020',
      '--skipLibCheck',
      // ai.ts reads process.env at module scope; without node types tsc rejects
      // it even though the checked functions are pure.
      '--types',
      'node',
    ],
    { stdio: 'inherit' }
  );

  let failed = false;
  for (const name of MODULES) {
    const mod = await import(join(outDir, `${name}.js`));
    try {
      console.log('✅', (mod.default ?? mod).demo());
    } catch (err) {
      failed = true;
      console.error('❌', name, '—', err.message);
    }
  }

  // --- browser globals in cross-platform code ------------------------------
  //
  // sync.ts used globalThis.btoa. React Native does not provide it and Expo
  // does not polyfill it, but TypeScript accepts it because the DOM library is
  // on and the e2e suite runs in Chrome — so it passed every gate and would
  // have thrown on a phone. A screen may branch on Platform.OS; a lib module
  // has no business knowing what a browser is.
  // A property access, not a full stop: "the eating window. What you feel" is
  // prose, `window.location` is a dependency.
  const BROWSER_ONLY = /\b(btoa|atob|localStorage|sessionStorage|indexedDB)\s*\(|\b(localStorage|sessionStorage|indexedDB)\.|\b(window|document|navigator)\.[A-Za-z_$]/;

  for (const file of readdirSync('src/lib')) {
    if (!file.endsWith('.ts') || file.includes('.web.')) continue;
    const source = readFileSync(join('src/lib', file), 'utf8')
      // Comments talk about eating windows and document pickers.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const hit = source.match(BROWSER_ONLY);
    if (hit) {
      failed = true;
      console.error('❌', file, '— uses a browser-only global:', hit[0].trim(),
        '\n   Cross-platform lib code cannot rely on it. Put it behind a .web.ts split.');
    }
  }
  if (!failed) console.log('✅ no browser-only globals in cross-platform lib code');

  // --- a paywalled card that the offer never names -------------------------
  //
  // Three cards were put behind isPremium() without a claim on the paywall, so
  // people paid for functions nobody had told them about. offer.ts can check
  // its own claims but cannot see the screens; this reads the screens and
  // compares. The direction that matters is screen → offer: a card that sells
  // must be a card that was offered.
  const offer = await import(join(outDir, 'offer.js'));
  const sold = new Set();
  for (const dir of ['src/app', 'src/app/(tabs)']) {
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.tsx')) continue;
      const source = readFileSync(join(dir, file.name), 'utf8');
      for (const m of source.matchAll(/sell\s*===\s*'([a-z]+)'/g)) sold.add(m[1]);
    }
  }
  const offered = new Set(offer.gatesUsed());
  for (const card of sold) {
    const gate = offer.SELL_GATE[card];
    if (!gate) {
      failed = true;
      console.error('❌ offer — a screen sells', `'${card}'`,
        'but SELL_GATE does not say what it unlocks.');
    } else if (!offered.has(gate)) {
      failed = true;
      console.error('❌ offer — the paywall never mentions', gate,
        `\n   but a screen asks money for the '${card}' card. Add a claim to PREMIUM_CLAIMS.`);
    }
  }
  // Gates that never sell still have to be enforced somewhere. chat_context is
  // the reason this exists: the chat withholds the user's own figures without
  // premium and says nothing about it, so nothing in the sell path could see
  // it. A gate whose enforcement site has lost its entitlement read is either
  // a feature given away or a claim being made for nothing.
  for (const [gate, site] of Object.entries(offer.GATE_SITES)) {
    let source;
    try {
      source = readFileSync(site, 'utf8');
    } catch {
      failed = true;
      console.error('❌ offer —', gate, 'names', site, 'as its enforcement site, but that file is gone.');
      continue;
    }
    if (!/isPremium|premium/.test(source)) {
      failed = true;
      console.error('❌ offer —', site, 'no longer reads the entitlement,',
        `\n   but ${gate} is still claimed on the paywall.`);
    }
  }

  // --- the marketing page sells only what is free --------------------------
  //
  // The landing page shipped for months advertising timing, session-aware
  // macros and reheat instructions. Every word of it true, every one of them
  // free, and every one of them something a dozen other apps do — so the page
  // described a commodity and never mentioned the measurement, which is the
  // only thing no competitor can offer and the only reason to pay.
  {
    const landing = readFileSync('src/app/landing.tsx', 'utf8');
    const value = landing.slice(landing.indexOf('const VALUE'), landing.indexOf('export default'));
    const freeHits = offer.FREE_CAPABILITIES.filter((f) => value.toLowerCase().includes(f.toLowerCase()));
    if (!/measur/i.test(value)) {
      failed = true;
      console.error('❌ landing — the page names', freeHits.length, 'free capabilities and never the',
        'measurement.\n   That is the differentiator and the reason to pay; a page without it sells a commodity.');
    } else {
      console.log('✅ the landing page names the measurement, not only the free tier');
    }
  }

  // --- an edge function nobody was told to deploy ---------------------------
  //
  // The functions are deployed by hand, and the README's command was the only
  // record of which ones. `delete_account` was added later and never made it
  // into that line, so anyone following the README shipped an app whose
  // account-deletion path — the one Art. 17 GDPR requires — was not running.
  // Prose drifting from the code, caught the same way as everywhere else here.
  {
    const readme = readFileSync('README.md', 'utf8');
    const line = readme.match(/supabase functions deploy[^\n]*/);
    if (!line) {
      failed = true;
      console.error('❌ deploy — the README no longer contains a functions deploy command,',
        '\n   so nothing says which functions have to be uploaded.');
    } else {
      const missing = readdirSync('supabase/functions', { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((name) => !line[0].includes(name));
      if (missing.length > 0) {
        failed = true;
        console.error('❌ deploy — these edge functions exist but the README never says to deploy them:',
          missing.join(', '),
          '\n   They run on the server; nothing in the web build ships them.');
      } else {
        console.log('✅ every edge function is named in the deploy command');
      }
    }
  }

  // --- deleting everything must not leave the way back in ------------------
  //
  // `eraseEverything` enumerates KEYS, and neither the encryption key nor the
  // Supabase session lives there. Erasing without deleting the account left a
  // device that could still open the server copy, so the next "Sync now"
  // unioned the whole deleted history back over the empty state. The order is
  // the fix and the order is what can silently come undone in a refactor.
  {
    // Found rather than named. Pinning the filename meant that moving the
    // handler to its own screen did not break the rule, it broke the check —
    // which then reported a missing `eraseAll` as an ordering failure and said
    // nothing about the file it could not find it in.
    const screens = ['src/app/you/data.tsx', 'src/app/(tabs)/profile.tsx'];
    const home = screens.find((f) => {
      try {
        return readFileSync(f, 'utf8').includes('const eraseAll');
      } catch {
        return false;
      }
    });
    if (!home) {
      failed = true;
      console.error('❌ erase — no screen defines `eraseAll`; looked in:', screens.join(', '),
        '\n   Either deletion was removed, or it moved somewhere this check does not know about.');
    } else {
      const src = readFileSync(home, 'utf8');
      const eraseAll = src.slice(src.indexOf('const eraseAll'));
      // The call sites, not the names: the comment above them explains the order
      // and mentions both, which is exactly the trap a looser match falls into.
      const account = eraseAll.indexOf('deleteAccount(');
      const erase = eraseAll.indexOf('eraseEverything(');
      if (account === -1 || erase === -1 || account > erase) {
        failed = true;
        console.error('❌ erase — "Delete all data" must delete the account before erasing the device.',
          `\n   In ${home}. The key and the session are not in KEYS, so a later sync restores`,
          '\n   everything it just deleted.');
      } else {
        console.log('✅ deleting everything deletes the account first');
      }
    }
  }

  // --- an announcement that cannot be sent must not be marked as sent -------
  //
  // Reminders are off until someone turns them on, so marking first consumed
  // the measurement announcement for every user in the default configuration:
  // the flag said "told them", nothing was sent, and the early return made sure
  // nothing ever would be.
  {
    const notify = readFileSync('src/lib/notify.ts', 'utf8');
    const fn = notify.slice(notify.indexOf('export async function announceMeasurement'));
    const enabled = fn.indexOf('isEnabled()');
    const mark = fn.indexOf('markMeasurementAnnounced');
    if (enabled === -1 || mark === -1 || enabled > mark) {
      failed = true;
      console.error('❌ announce — announceMeasurement marks the flag before checking it can send.',
        '\n   Reminders default to off, so that burns the announcement for everyone who has not opted in.');
    } else {
      console.log('✅ the measurement announcement checks it can send before marking it sent');
    }
  }

  // --- the lapse message needs a setter on every platform ------------------
  //
  // measurementAnnounced doubles as "a measurement existed here before", which
  // is the only thing that tells a lapse apart from never having had one. Only
  // the reminder set it, and reminders do not exist on web, so a lapsed web
  // user was told they had never measured anything.
  {
    const progress = readFileSync('src/app/(tabs)/progress.tsx', 'utf8');
    if (!progress.includes('markMeasurementAnnounced')) {
      failed = true;
      console.error('❌ announce — Progress no longer marks the measurement as having existed.',
        '\n   Only notify.ts would set it, and notify.ts does nothing on web: a lapse there reads as "never measured".');
    } else {
      console.log('✅ the measurement is recorded as having existed on every platform');
    }
  }

  // --- the counter and the bar tell the same story ----------------------
  //
  // The target step is skipped for anyone not losing weight. Both the number
  // and the bar have to be computed from the path this person actually walks,
  // and the fix once landed on only one of them: the counter read 01/05 while
  // the bar underneath filled in fifths of six. Half-honest is its own bug, and
  // a search-and-replace that silently matches nothing is how it happens.
  {
    const onboarding = readFileSync('src/app/onboarding.tsx', 'utf8');
    const wrong = onboarding.match(/\(\s*\(?step \+ 1\)?\s*\/\s*STEPS\s*\)/);
    if (wrong) {
      failed = true;
      console.error('❌ onboarding — the progress indicator divides by the fixed total:', wrong[0],
        '\n   Skipped steps make that overstate the length. Use stepPosition(step, goal).');
    } else if (!/here\.position/.test(onboarding) || !/here\.total/.test(onboarding)) {
      failed = true;
      console.error('❌ onboarding — the progress indicator no longer reads the walked path.',
        '\n   Both the counter and the bar come from stepPosition; neither may compute its own.');
    } else {
      console.log('✅ the onboarding counter and its bar measure the same path');
    }
  }

  if (sold.size === 0) {
    failed = true;
    console.error('❌ offer — no screen reads cards.sell at all;',
      'either the rule was removed or this check stopped matching.');
  }
  if (!failed) console.log(`✅ every paywalled card on screen is offered on the paywall (${sold.size})`);

  if (failed) process.exit(1);
  console.log('\nAll logic checks passed.');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
