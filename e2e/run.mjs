/**
 * Runs both browser suites.
 *
 *   npm run e2e                        build if needed, serve dist, run
 *   npm run e2e -- --build             force a fresh export first
 *   E2E_URL=https://... npm run e2e    run against a deployed site instead
 *
 * The static server is ~40 lines of node rather than a dependency, and it
 * mirrors how Vercel serves the export: `cleanUrls`, so /planner resolves to
 * planner.html. Serving everything from index.html would hide broken routing.
 */

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

function resolveFile(urlPath) {
  // Strip query/hash and any traversal before touching the filesystem.
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0].split('#')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates =
    clean === '/' || clean === '' ? ['index.html'] : [clean.slice(1), `${clean.slice(1)}.html`];

  for (const rel of candidates) {
    const abs = join(DIST, rel);
    if (!abs.startsWith(DIST)) continue;
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

function serve(port) {
  const server = createServer((req, res) => {
    const file = resolveFile(req.url ?? '/');
    if (!file) {
      const notFound = join(DIST, '+not-found.html');
      if (existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] });
        return res.end(readFileSync(notFound));
      }
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function freePort() {
  const { createServer: net } = await import('node:net');
  return new Promise((resolve) => {
    const s = net();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** Newest mtime under a directory tree, ignoring what never affects the build. */
function newestMtime(dir, skip = new Set(['node_modules', '.git', 'dist', '.expo'])) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    const t = entry.isDirectory() ? newestMtime(abs, skip) : statSync(abs).mtimeMs;
    if (t > newest) newest = t;
  }
  return newest;
}

/**
 * A stale bundle is worse than no bundle: it makes a red change look green,
 * which is exactly what this suite exists to prevent. So rebuild whenever any
 * source or config file is newer than the export.
 */
function needsBuild() {
  const index = join(DIST, 'index.html');
  if (!existsSync(index)) return 'no dist/ yet';
  const built = statSync(index).mtimeMs;
  const sources = Math.max(
    newestMtime(join(ROOT, 'src')),
    ...['app.json', 'package.json', 'vercel.json']
      .map((f) => join(ROOT, f))
      .filter(existsSync)
      .map((f) => statSync(f).mtimeMs)
  );
  return sources > built ? 'sources changed since the last export' : null;
}

const external = !!process.env.E2E_URL;
let server = null;

try {
  if (!external) {
    const force = process.argv.includes('--build');
    const reason = force ? 'forced' : needsBuild();
    if (reason) {
      console.log(`Building (${reason})…`);
      execFileSync('npx', ['expo', 'export', '--platform', 'web'], { cwd: ROOT, stdio: 'inherit' });
    }
    const port = await freePort();
    server = await serve(port);
    process.env.E2E_URL = `http://localhost:${port}`;
    console.log(`Serving dist/ on ${process.env.E2E_URL}`);
  } else {
    console.log(`Testing against ${process.env.E2E_URL}`);
  }

  // Imported after E2E_URL is set — harness reads it at module load.
  const { default: smoke } = await import('./smoke.mjs');
  const { default: interact } = await import('./interact.mjs');

  const results = [await smoke(), await interact()];
  const total = results.reduce((n, x) => n + x.total, 0);
  const failures = results.reduce((n, x) => n + x.failures, 0);

  console.log(
    failures === 0
      ? `\n=== E2E GREEN — ${total} checks ===`
      : `\n=== E2E RED — ${failures} of ${total} checks failed ===`
  );
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  console.error('\nE2E run failed:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  server?.close();
}
