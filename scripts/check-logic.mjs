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

const MODULES = ['nutrition', 'dates', 'grocery', 'agenda', 'ai', 'review', 'markdown', 'typography', 'legal', 'crypto', 'sync-merge', 'energy', 'offer'];

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
