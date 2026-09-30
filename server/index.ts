import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import type { ApiError } from '../shared/schemas.ts';
import { admin } from './admin-routes.ts';
import { authConfigured } from './auth.ts';
import { api, enquiryLimiter } from './routes.ts';
import { APP_ROOT, UPLOADS_DIR } from './paths.ts';
import { contentCounts, describeContent, inspectStorage } from './persistence.ts';
import { closeDb } from './sqlite.ts';
import { here } from './here.ts';

const root = path.resolve(here, '..');
const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const SERVE_STATIC = process.env.SERVE_STATIC !== 'false';
const DIST_DIR = path.join(root, 'dist');
const RATE_LIMIT_ENFORCED = process.env.NODE_ENV === 'production';

export function createApp({ enforceRateLimit = RATE_LIMIT_ENFORCED } = {}) {
  const app = express();

  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.disable('x-powered-by');

  app.use(compression());

  // Multipart bodies are parsed by multer per-route, so the JSON parser must
  // not try to consume them. Its limit stays small: admin writes are small
  // JSON documents, and images go through the upload endpoint.
  app.use(express.json({ limit: '64kb' }));

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  /*
   * The enquiry limiter is attached to the enquiry route itself, not to the
   * `/api` prefix.
   *
   * Mounting it on the prefix would put every request in the app behind it —
   * including `/api/admin/*`, which the dashboard polls and writes through
   * constantly. One operator reloading the dashboard would exhaust the
   * enquiry budget and get "Too many enquiries" from the content endpoints,
   * which is both wrong and very hard to diagnose from the symptom. The
   * limiter exists to slow down form spam, so that is the only thing it
   * should ever cover.
   *
   * It is registered on `app` *before* the `/api` router, not on the router
   * itself. Adding a handler to `api` here would append it after the route
   * `routes.ts` already registered, and Express stops at the first handler
   * that responds — so the limiter would never run at all.
   */
  if (enforceRateLimit) app.post('/api/enquiries', enquiryLimiter);

  app.use('/api', api);

  // Admin API. Mounted before the static handlers so it can never be shadowed
  // by the SPA catch-all, and never served from `dist`.
  app.use('/api/admin', admin);

  // Uploaded media is served from DATA_DIR, not from the build output, so
  // it survives a redeploy. `nosniff` plus an explicit image-only policy keeps
  // an uploaded file from being treated as anything executable.
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      maxAge: '7d',
      index: false,
      dotfiles: 'deny',
      setHeaders(res, filePath) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
        /*
         * A PDF is the one accepted upload a browser will happily *execute*
         * rather than display: its embedded JavaScript runs in the viewer's
         * context, and viewers that script against `parent` can reach the
         * hosting page. `attachment` makes the response a download instead of a
         * document to render, so an uploaded policy file never becomes
         * same-origin active content no matter which link the reader follows.
         *
         * The `download` attribute on the public link is only a hint and is
         * ignored for cross-origin URLs, so this header is the actual guarantee.
         */
        if (filePath.toLowerCase().endsWith('.pdf')) {
          res.setHeader('Content-Disposition', 'attachment');
        }
      },
    }),
  );

  if (SERVE_STATIC && existsSync(DIST_DIR)) {
    app.use(
      express.static(DIST_DIR, {
        maxAge: '1y',
        index: false,
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    const indexHtml = path.join(DIST_DIR, 'index.html');
    const adminIndexHtml = path.join(DIST_DIR, 'admin', 'index.html');

    /*
     * The dashboard lives in its own HTML document with its own bundle, and it
     * is a separate entry point — not a client-side route of the public site.
     *
     * It has to be named explicitly, because `express.static` above runs with
     * `index: false` so that a directory never resolves to some unexpected
     * file. The side effect is that `/admin/` finds no index to serve, falls
     * through to the SPA fallback below, and is answered with the *public*
     * `index.html`. The visitor then lands on the marketing site while the
     * address bar says `/admin/`, and that page goes on to request
     * `/api/admin/session`, which needs a session the visitor does not have.
     *
     * The failure looks like a broken API — a 404 in the console for a request
     * nobody made — while the actual fault is one missing branch here.
     */
    if (existsSync(adminIndexHtml)) {
      const serveAdmin = (_req: Request, res: Response) => {
        res.set('Cache-Control', 'no-cache');
        res.sendFile(adminIndexHtml);
      };
      app.get('/admin', serveAdmin);
      app.get('/admin/', serveAdmin);
    }

    /*
     * The SPA fallback must never answer an API or upload path.
     *
     * This is not a theoretical tidy-up. A deployment whose API routes are
     * missing — a process started from a stale build, a half-extracted
     * release, a `dist-server` left over from an older layout — answers every
     * unmatched GET with `index.html` and a **200**. A client asking for JSON
     * gets HTML, the parse fails, and the failure surfaces two steps away from
     * its cause as `Cannot read properties of null (reading 'authenticated')`
     * in the dashboard. The one thing that would have identified it, a JSON 404
     * on the API path, was unreachable because the fallback was registered
     * first and swallowed it.
     *
     * So the fallback declines API and upload paths and lets the JSON 404 below
     * answer them. An API that is genuinely missing now says so.
     */
    const mustBeJson = /^\/(api|uploads)(\/|$)/;
    app.get(/.*/, (req, res, next) => {
      if (mustBeJson.test(req.path)) {
        next();
        return;
      }
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  /*
   * An unmatched request is logged rather than answered silently.
   *
   * Everything registered has been tried by the time control reaches here, so
   * the path and method are the whole diagnosis: if they show a request that
   * should have matched a registered route, the deployment's route table is not
   * the one this code mounted, and no amount of reading the browser's network
   * panel will reveal that. It also records `baseUrl`, which is where a
   * reverse proxy that silently rewrites the prefix shows up.
   */
  app.use((req, res) => {
    /*
     * A request for an API path that ends in `index.html` did not arrive as the
     * caller wrote it: a web server in front of the app rewrote it. The usual
     * source is a single-page-app fallback that rewrites every unmatched path to
     * `index.html`, which belongs in front of a static site and must be kept
     * from touching the API. It is called out separately because the symptom is
     * otherwise inexplicable from the browser: the dashboard loads, the public
     * site loads, and every API call 404s for a path that is provably
     * registered.
     */
    const rewritten = /^\/(api|uploads)\/.*index\.html$/.test(req.originalUrl);
    if (rewritten) {
      console.warn(
        `[golden-steps] ${req.method} ${req.originalUrl} looks rewritten — ` +
          'a rewrite rule in front of the app is sending API requests to ' +
          'index.html. Exclude /api from that rule.',
      );
    } else {
      console.warn(`[golden-steps] no route for ${req.method} ${req.originalUrl}`);
    }
    const body: ApiError = {
      ok: false,
      error: 'not_found',
      message: 'Resource not found.',
    };
    res.status(404).json(body);
  });

  /*
   * Last-resort handler. The request is named in the log because the error alone
   * is rarely enough to locate it: a stack trace points at the line that threw,
   * not at the endpoint a user was actually using, and on shared hosting this
   * log is often the only artefact available to debug a deploy. `error.stack` is
   * preferred over `error` because Node prints a bare `URIError` as
   * `URIError: URI malformed` with no frames.
   */
  app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error(
      `[golden-steps] unhandled error on ${req.method} ${req.originalUrl}\n${
        error.stack ?? error.message ?? String(error)
      }`,
    );
    if (res.headersSent) return;

    const body: ApiError = {
      ok: false,
      error: 'server_error',
      message: 'Something went wrong on our side. Please try again.',
    };
    res.status(500).json(body);
  });

  return app;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/**
 * Warns, loudly, when the data directory is not persistent.
 *
 * This is the single most expensive mistake available in this deployment, and
 * it is invisible without being called out: the app starts, serves a working
 * site, and shows an empty dashboard. The operator reasonably concludes the
 * dashboard is broken rather than that the storage is disposable, adds content,
 * and loses it on the next deploy. Saying so once at startup turns a mystery
 * into a log line.
 *
 * Deliberately not fatal. An ephemeral data directory is a legitimate choice for
 * a preview build, and refusing to boot would be a worse failure than the one
 * being prevented.
 */
function reportStorage(): void {
  const storage = inspectStorage();

  /*
   * A data directory inside the release directory survives a deploy that
   * overwrites files and dies on one that replaces the directory. Warned about
   * separately from the mount check because it is a different mistake with a
   * different fix: move the directory out, rather than attach a volume.
   */
  const insideRelease =
    storage.dataDir === APP_ROOT || storage.dataDir.startsWith(APP_ROOT + path.sep);
  if (insideRelease) {
    console.warn(
      [
        '',
        '='.repeat(72),
        '  THE DATA DIRECTORY IS INSIDE THE APPLICATION DIRECTORY',
        '='.repeat(72),
        `  ${storage.dataDir}`,
        '',
        '  This works only while a deploy overwrites files in place. A deploy that',
        '  replaces the whole application directory — which is the normal way to',
        '  deploy — will delete your content with no warning and no error.',
        '',
        '  Move it out and point DATA_DIR at it, for example:',
        '    DATA_DIR=/home/USER/golden-steps-data',
        '='.repeat(72),
        '',
      ].join('\n'),
    );
  }

  if (storage.durability !== 'ephemeral') {
    console.log(`[golden-steps] storage: ${storage.detail}`);
    return;
  }

  const counts = contentCounts();
  const atRisk = Object.values(counts).reduce((sum, n) => sum + n, 0);

  console.warn(
    [
      '',
      '='.repeat(72),
      '  DATA IS NOT PERSISTENT — EVERY REDEPLOY WILL DISCARD IT',
      '='.repeat(72),
      `  ${storage.detail}`,
      '',
      `  Currently holding: ${describeContent(counts)}`,
      '',
      '  Attach a persistent volume at /data, then set its owner to UID 1000:',
      '    docker compose up --build          (uses the app-data volume)',
      '    docker run -v golden-data:/data …  (named volume)',
      '',
      '  On a PaaS, add a disk or volume in the platform dashboard. That',
      '  setting lives in the platform, not in this repository, so it is',
      '  easy to miss and looks correct until a deploy replaces the container.',
      '='.repeat(72),
      '',
    ].join('\n'),
  );

  if (atRisk > 0) {
    console.warn(
      `[golden-steps] WARNING: ${atRisk} records are stored on ephemeral storage right now.`,
    );
  }
}

/**
 * How many routes a Router actually ended up with.
 *
 * A Router is built by calling `.get()` and `.post()` on it at module scope, so
 * a module that fails to finish evaluating — or a stale copy of it left in a
 * release directory next to a current one — yields a Router with no routes at
 * all. Nothing throws. `app.use('/api', emptyRouter)` mounts cleanly, matches
 * nothing, and every request under `/api` falls through to the SPA fallback.
 *
 * That failure is invisible from outside, which is the problem: the site looks
 * fine, the status codes look fine, and the only symptom is a dashboard that
 * cannot read its own data. Printing the counts at startup turns "the API is
 * mysteriously missing" into one line in the log.
 *
 * Layers created by `router.get(path, …)` carry a `route`; layers created by
 * `router.use(…)` do not. Counting the former counts the endpoints.
 */
function countRoutes(router: unknown): number {
  const stack = (router as { stack?: unknown }).stack;
  if (!Array.isArray(stack)) return -1;
  return stack.filter((layer) => (layer as { route?: unknown }).route).length;
}

/**
 * The paths a Router actually registered, as strings.
 *
 * `countRoutes` answers "how many", which is enough to notice that a router is
 * empty and not enough to explain why a router that is *not* empty still fails
 * to match. A release directory holding a current `index.js` beside a stale
 * `routes.js` produces a router with a healthy-looking count and the wrong
 * paths, and only the paths distinguish that. On shared hosting this log is
 * frequently the only artefact available, so the diagnosis has to live here.
 */
function routePaths(router: unknown): string[] {
  const stack = (router as { stack?: unknown }).stack;
  if (!Array.isArray(stack)) return [];
  return stack
    .map((layer) => (layer as { route?: { path?: unknown } }).route)
    .filter((route): route is { path?: unknown } => Boolean(route))
    .map((route) => String(route.path));
}

function reportRoutes(): void {
  const counts = { api: countRoutes(api), admin: countRoutes(admin) };

  console.log(
    `[golden-steps] routes: ${counts.api} public, ${counts.admin} admin ` +
      `(entry ${here}/index.js, site ${DIST_DIR})`,
  );
  console.log(`[golden-steps] public paths: ${routePaths(api).join(' ') || '(none)'}`);
  console.log(`[golden-steps] admin paths: ${routePaths(admin).join(' ') || '(none)'}`);

  /*
   * A mounted-but-unmatched API is the hardest failure to diagnose from a
   * browser, because every symptom is indirect: the homepage renders, the
   * dashboard renders, and the only evidence is a 404 on a request the operator
   * never made. Logging the paths and the runtime makes one restart enough to
   * tell "the routes are not registered" apart from "the routes are registered
   * but not reachable", which are otherwise indistinguishable without a shell.
   */
  console.log(
    `[golden-steps] runtime: node ${process.version} pid ${process.pid} ` +
      `cwd ${process.cwd()} PORT ${process.env.PORT ?? '(unset)'} ` +
      `NODE_ENV ${process.env.NODE_ENV ?? '(unset)'} ` +
      `SERVE_STATIC ${String(SERVE_STATIC)}`,
  );

  if (counts.api === 0 || counts.admin === 0) {
    console.warn(
      [
        '',
        '='.repeat(72),
        '  AN API ROUTER HAS NO ROUTES',
        '='.repeat(72),
        `  public: ${counts.api}   admin: ${counts.admin}`,
        '',
        '  Every /api request will fall through to the web page, so the site will',
        '  look normal while the dashboard cannot load or save anything.',
        '',
        '  This means the release directory holds a mix of builds: a current',
        '  index.js beside an older or half-extracted routes.js / admin-routes.js.',
        '  Delete everything in the application root, upload the release again,',
        '  and extract it so that app.js sits directly in that root.',
        '='.repeat(72),
        '',
      ].join('\n'),
    );
  }
}

/**
 * Starts the HTTP listener and installs shutdown handling.
 *
 * Exported, not just called under `isDirectRun`, because `app.js` is the entry
 * point on cPanel and Passenger. That file imports this module and calls
 * `start()` itself, so `process.argv[1]` is `app.js` rather than this file and
 * the `isDirectRun` test is false. Without an exported entry point the process
 * would import this module, start nothing, and exit 0 — the application would
 * look deployed and answer no requests at all.
 */
export function start(): void {
  const server = createApp().listen(PORT, HOST, () => {
    console.log(`[golden-steps] API listening on http://localhost:${PORT}`);
    if (authConfigured) {
      console.log('[golden-steps] admin dashboard enabled at /admin');
    } else {
      console.log(
        '[golden-steps] admin dashboard disabled — set ADMIN_PASSWORD to enable it',
      );
    }
    if (SERVE_STATIC && existsSync(DIST_DIR)) {
      console.log(`[golden-steps] serving built site from ${DIST_DIR}`);
    } else {
      console.log('[golden-steps] no build found — run the Vite dev server for the site');
    }
    reportRoutes();
    reportStorage();
  });

  /*
   * Close the database on shutdown so SQLite checkpoints the WAL and releases
   * the file lock.
   *
   * A container platform or Passenger stops the process with SIGTERM, not
   * SIGKILL, and an abrupt exit leaves a `-wal` file next to the database. That
   * is recoverable — SQLite replays it on the next open — but it means the
   * database and its writes live in two files, so a snapshot taken mid-deploy
   * can capture one without the other. Draining the listener first also stops a
   * deploy from cutting off a request that is halfway through a write.
   */
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(() => {
        closeDb();
        process.exit(0);
      });
      // Do not let a hung connection keep the process alive past the grace
      // period a platform gives before it escalates to SIGKILL.
      setTimeout(() => {
        closeDb();
        process.exit(1);
      }, 10_000).unref();
    });
  }
}

if (isDirectRun) start();
