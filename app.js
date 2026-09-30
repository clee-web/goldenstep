/**
 * Entry point for hosts that want a single file at the application root.
 *
 * cPanel's Node.js Selector and Passenger both take a startup file path, and
 * both default to something like `app.js` at the application root. Pointing
 * them at `dist-server/server/index.js` works too, but this keeps the value
 * that has to be typed into a dashboard short and conventional, and gives one
 * obvious place to change if the compiled path ever moves.
 *
 * It is a dynamic import rather than a static one so that a missing or
 * unbuilt `dist-server/` produces a clear message here instead of a bare
 * module-resolution error from three frames down.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = path.resolve(import.meta.dirname, 'dist-server', 'server', 'index.js');

if (!existsSync(entry)) {
  console.error(
    'The application has not been built.\n' +
      `Expected ${entry}.\n\n` +
      'Run `npm ci && npm run build` before uploading, then upload the `dist-server/`\n' +
      'directory along with `node_modules`.',
  );
  process.exit(1);
}

/*
 * `pathToFileURL` rather than the bare path. A dynamic import resolves its
 * argument as a URL, so an absolute filesystem path only works on POSIX; on
 * Windows `C:\...` is read as a URL with the unsupported scheme `c:` and the
 * process dies with ERR_UNSUPPORTED_ESM_URL_SCHEME. Converting first is correct
 * on every platform.
 *
 * `start()` is called explicitly. The server module only listens by itself when
 * it is the process entry point, which it is not here — this file is — so an
 * import alone would return immediately with nothing listening.
 */
const { start } = await import(pathToFileURL(entry).href);
start();
