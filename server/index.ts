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
import { UPLOADS_DIR } from './paths.ts';
import { contentCounts, describeContent, inspectStorage } from './persistence.ts';
import { closeDb } from './sqlite.ts';

const root = path.resolve(import.meta.dirname, '..');
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
    app.get(/.*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use((_req, res) => {
    const body: ApiError = {
      ok: false,
      error: 'not_found',
      message: 'Resource not found.',
    };
    res.status(404).json(body);
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[golden-steps] unhandled error:', error);
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

if (isDirectRun) {
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
    reportStorage();
  });

  /*
   * Close the database on shutdown so SQLite checkpoints the WAL and releases
   * the file lock.
   *
   * A container platform stops the process with SIGTERM, not SIGKILL, and an
   * abrupt exit leaves a `-wal` file next to the database. That is recoverable
   * — SQLite replays it on the next open — but it means the database and its
   * writes live in two files, so a snapshot taken mid-deploy can capture one
   * without the other. Draining the listener first also stops a deploy from
   * cutting off a request that is halfway through a write.
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
