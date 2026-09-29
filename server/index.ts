import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Router } from 'express';
import compression from 'compression';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import type { ApiError } from '../shared/schemas.ts';
import { admin } from './admin-routes.ts';
import { authConfigured } from './auth.ts';
import { api, enquiryLimiter } from './routes.ts';
import { UPLOADS_DIR } from './paths.ts';

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

  // Rate limiting is skipped in dev by default so local iteration is frictionless.
  const apiRouter = Router();
  if (enforceRateLimit) apiRouter.use(enquiryLimiter);
  apiRouter.use(api);
  app.use('/api', apiRouter);

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

if (isDirectRun) {
  createApp().listen(PORT, HOST, () => {
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
  });
}
