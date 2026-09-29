import path from 'node:path';

/**
 * Every runtime-writeable location in one place.
 *
 * `DATA_DIR` deliberately defaults to `./data`, which is git-ignored. Nothing
 * the dashboard writes may live inside `public/` or `dist`: `dist` is a build
 * artefact that gets replaced on every deploy, and `public/` is only copied at
 * build time, so files added there after a build would 404 in production.
 */
const root = path.resolve(import.meta.dirname, '..');

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, 'data');

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