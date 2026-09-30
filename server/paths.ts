import path from 'node:path';

import { here } from './here.ts';

/**
 * Every runtime-writeable location in one place.
 *
 * `DATA_DIR` deliberately defaults to `./data`, which is git-ignored. Nothing
 * the dashboard writes may live inside `public/` or `dist`: `dist` is a build
 * artefact that gets replaced on every deploy, and `public/` is only copied at
 * build time, so files added there after a build would 404 in production.
 *
 * `root` is the directory holding `server/`, `shared/` and `db/`. It resolves to
 * the repository root when running from source and to `dist-server/` when
 * running the compiled output, because `scripts/stage.mjs` assembles both into
 * the same layout. That is what lets the same relative lookups work in both
 * places with no environment variable.
 */
const root = path.resolve(here, '..');

/**
 * True when running the compiled output in `dist-server/` rather than source.
 *
 * It changes exactly one thing, and that one thing is the difference between
 * content surviving a deploy and content being replaced by it. The data
 * directory has to sit *outside* the release directory: a host that replaces
 * `dist-server/` wholesale on redeploy would otherwise take `dist-server/data`
 * with it, and the symptom is an empty dashboard with no error.
 */
const isCompiled = path.basename(root) === 'dist-server';

const defaultDataDir = isCompiled
  ? path.resolve(root, '..', 'data')
  : path.join(root, 'data');

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : defaultDataDir;

/**
 * The release directory. Exported so the startup check can warn about a data
 * directory placed inside it, which is survivable only until the next deploy
 * replaces the whole directory.
 */
export const APP_ROOT = root;

export const ENQUIRIES_FILE = path.join(DATA_DIR, 'enquiries.json');
export const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

/**
 * Uploaded media. Served by Express at `/uploads`, never baked into the build.
 */
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES ?? 8 * 1024 * 1024,
);

/**
 * Videos get their own ceiling rather than raising the image limit for everyone.
 * A single cap large enough for a phone video would let an image upload carry
 * 100MB of padding, which is a cheap way to fill the disk.
 */
export const MAX_VIDEO_BYTES = Number(
  process.env.MAX_VIDEO_BYTES ?? 100 * 1024 * 1024,
);

/**
 * Policy documents get their own ceiling, for the same reason videos do: a
 * scanned safeguarding policy with photographs in it is comfortably larger than
 * a photograph, and reusing the video allowance would let a "PDF" push 100MB
 * through the form.
 */
export const MAX_DOCUMENT_BYTES = Number(
  process.env.MAX_DOCUMENT_BYTES ?? 25 * 1024 * 1024,
);