/**
 * Runs the self-checks in the pure logic modules.
 *
 *   npm run check
 *
 * These modules deliberately avoid React and AsyncStorage imports so they can
 * be compiled and executed in plain node — no test framework needed.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MODULES = ['nutrition', 'dates', 'grocery', 'agenda', 'ai', 'review', 'markdown', 'typography'];

const outDir = mkdtempSync(join(tmpdir(), 'omadcoach-check-'));

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
