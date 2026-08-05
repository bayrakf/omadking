/**
 * Runs the self-checks in the pure logic modules.
 *
 *   npm run check
 *
 * These modules deliberately avoid React and AsyncStorage imports so they can
 * be compiled and executed in plain node — no test framework needed.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MODULES = ['nutrition', 'dates', 'grocery', 'agenda', 'ai', 'review', 'markdown', 'typography', 'legal', 'crypto', 'sync-merge', 'energy'];

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

  if (failed) process.exit(1);
  console.log('\nAll logic checks passed.');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
