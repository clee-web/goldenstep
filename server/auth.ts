import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import type { ApiError } from '../shared/schemas.ts';

const COOKIE_NAME = 'gs_admin';
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS ?? 8 * 60 * 60 * 1000);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? '';
const SECRET = process.env.ADMIN_SESSION_SECRET?.trim() ?? '';

export const authConfigured = ADMIN_PASSWORD.length > 0;

let warnedAboutSecret = false;

/**
 * The signing secret falls back to the admin password so a minimal setup works
 * out of the box, but reusing the password as an HMAC key means a leaked cookie
 * signature and a leaked password are the same secret. That is worth a warning
 * rather than a hard failure, because refusing to boot would be worse for
 * someone trying the dashboard for the first time.
 */
function secret(): string {
  if (SECRET.length > 0) return SECRET;
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      '[golden-steps] ADMIN_SESSION_SECRET is not set — falling back to ADMIN_PASSWORD. Set a separate secret before deploying.',
    );
  }
  return ADMIN_PASSWORD;
}

const sign = (value: string): string =>
  createHmac('sha256', secret()).update(value).digest('base64url');

/** Constant-time compare that tolerates unequal lengths. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still burn a comparison so length alone does not become a timing signal.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function checkPassword(candidate: string): boolean {
  if (!authConfigured) return false;
  return safeEqual(candidate, ADMIN_PASSWORD);
}

function createToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}.${randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!safeEqual(signature, sign(payload))) return false;

  const expiresAt = Number(payload.split('.')[0]);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000,
    )}${secure}`,
  );
}

function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`);
}

const unauthorized = (res: Response, message: string): void => {
  const body: ApiError = { ok: false, error: 'unauthorized', message };
  res.status(401).json(body);
};

/**
 * Minimal cookie reader. Avoids pulling in cookie-parser for the one cookie
 * this app sets, and is deliberately narrow: it does not try to be a general
 * purpose parser, only to find our own session cookie.
 */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/** Rejects everything when no password is configured, so a misconfigured deploy is closed, not open. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!authConfigured) {
    unauthorized(res, 'Admin access is not configured on this server.');
    return;
  }
  if (!verifyToken(readCookie(req, COOKIE_NAME))) {
    unauthorized(res, 'Sign in to continue.');
    return;
  }
  next();
}

export function loginHandler(req: Request, res: Response): void {
  if (!authConfigured) {
    unauthorized(res, 'Admin access is not configured on this server.');
    return;
  }

  const { password } = req.body as { password?: unknown };
  if (typeof password !== 'string' || !checkPassword(password)) {
    unauthorized(res, 'Incorrect password.');
    return;
  }

  setSessionCookie(res, createToken());
  res.json({ ok: true });
}

export function logoutHandler(_req: Request, res: Response): void {
  clearSessionCookie(res);
  res.json({ ok: true });
}

/** Lets the dashboard decide between the login form and the app on load. */
export function sessionHandler(req: Request, res: Response): void {
  const ok = authConfigured && verifyToken(readCookie(req, COOKIE_NAME));
  res.json({ ok: true, authenticated: ok, configured: authConfigured });
}
