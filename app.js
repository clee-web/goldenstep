/**
 * Entry point for hosts that want a single file at the application root.
 *
 * cPanel's Node.js Selector and Passenger both take a startup file path, and
 * both default to something like `app.js` at the application root. Pointing
 * them at `dist-server/server/index.js` works too, but this keeps the value
 * that has to be typed into a dashboard short and conventional, and gives one
 * obvious place to change if the compiled path ever moves.
 *
 * The import MUST stay static, and there must be no top-level `await` in this
 * file or in anything it statically imports. See the long comment below.
 */
import { start } from './dist-server/server/index.js';

/*
 * Why a static import, and why no top-level await. Passenger does not run this
 * file; it `require()`s it. On Node 22.12+ and 24 that works for ESM, but
 * `require()` cannot load an ESM graph that contains a top-level await — the
 * graph would have to suspend, and there is nowhere to suspend to. Node throws
 *
 *   Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph
 *   with top-level await. Use import() instead.
 *
 * which surfaces to the visitor as a bare 500 ("Web application could not be
 * started by the Phusion Passenger application server") with the real cause
 * only in the application log. It is an easy mistake to reintroduce: the
 * natural way to write this file is a dynamic `await import()` so that a
 * missing `dist-server/` produces a friendly message, and that is precisely the
 * form that Passenger cannot load.
 *
 * So the import is static, and the friendliness is bought back differently: a
 * missing `dist-server/` raises ERR_MODULE_NOT_FOUND naming the exact path it
 * looked for, which is the more useful error of the two, and the build scripts
 * (`scripts/cpanel-deploy.sh`, `npm run build`) and `START-HERE.md` check for
 * the artefact before anything is uploaded.
 *
 * A static import also removes a real startup race. Passenger starts proxying
 * to this process as soon as loading finishes, so with a dynamic import the
 * server may not have bound its port yet and the first request after every
 * restart is refused. Evaluating the entry as part of loading means
 * `start()` — which is synchronous — has bound the port before this file
 * finishes loading.
 *
 * `start()` is called explicitly. The server module only listens by itself when
 * it is the process entry point, which it is not here — this file is.
 */
start();
