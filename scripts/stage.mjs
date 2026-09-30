import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Assembles the deployable application into `dist-server/`.
 *
 * The goal is one self-contained directory that can be uploaded to a host and
 * started with a single command. `tsc` has already emitted the server as
 * JavaScript; what is missing is everything the running process reads from disk
 * at request time, which is not obvious from the import graph:
 *
 *   dist/       the built site, served by Express
 *   db/         the schema, read once at startup
 *
 * Both are copied rather than referenced so that `dist-server/` holds the whole
 * application and the relative lookups in `server/paths.ts` resolve identically
 * whether the code is running from source or from the compiled output.
 *
 * Not copied, deliberately:
 *   public/   Vite has already inlined it into dist/ at build time.
 *   src/      Only the compiler reads it.
 *   data/     The operator's content. It must never be staged, shipped or
 *             overwritten by a deploy — that is how content gets lost.
 */

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-server');

function fail(message) {
  console.error(`[stage] ${message}`);
  process.exit(1);
}

const required = ['dist-server/server/index.js', 'dist', 'db/schema.sql'];
for (const entry of required) {
  if (!existsSync(path.join(root, entry))) fail(`Missing ${entry}. Run the build first.`);
}

// `force` overwrites in place, so a renamed or deleted asset from a previous
// build cannot survive into a release — a stale file in dist/ is a confusing
// failure to chase.
for (const dir of ['dist', 'db']) {
  cpSync(path.join(root, dir), path.join(out, dir), { recursive: true, force: true });
}

/**
 * Guards the one mistake this script exists to make impossible: shipping
 * `data/` inside a release. A deploy that carries a copy of the live database
 * looks harmless until it is deployed somewhere with a different one.
 */
if (existsSync(path.join(out, 'data'))) {
  fail('dist-server/data exists. Content must never be staged into a release.');
}

const entries = readdirSync(out, { withFileTypes: true })
  .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
  .sort();

const bytes = readdirSync(out, { withFileTypes: true }).reduce((sum, e) => {
  const p = path.join(out, e.name);
  return sum + (e.isDirectory() ? dirSize(p) : statSync(p).size);
}, 0);

function dirSize(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? dirSize(p) : statSync(p).size);
  }, 0);
}

console.log(`[stage] deployable ready in dist-server/ (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(`[stage] contains: ${entries.join(', ')}`);
console.log('[stage] start with: node dist-server/server/index.js');
