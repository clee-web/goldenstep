import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

process.env.DATA_DIR = `${process.env.TEMP ?? '.'}\\golden-steps-spa-${process.pid}`;

/*
 * The other suites set SERVE_STATIC=false, which is why the SPA fallback was
 * never exercised. This file deliberately leaves it on, because the bug being
 * guarded here only exists when the fallback is registered.
 */
const { createApp } = await import('./index.ts');
const { here } = await import('./here.ts');

const DIST_DIR = path.resolve(here, '..', 'dist');
const hasBuild = existsSync(path.join(DIST_DIR, 'index.html'));

const app = createApp({ enforceRateLimit: false });
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

const publicHtml = () => readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');

interface ErrorBody {
  ok: boolean;
  error: string;
  message: string;
}

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('an unmatched API path is never answered with the web page', () => {
  /*
   * The failure this prevents is silent and misattributed. A deployment whose
   * API routes are missing replies 200 with index.html to every unmatched GET;
   * the dashboard's JSON parse then fails and reports
   * "Cannot read properties of null", which points at the dashboard rather than
   * at the missing routes. The status code looks fine throughout, so nothing
   * distinguishes it from a healthy install.
   */
  for (const target of [
    '/api/does-not-exist',
    '/api/admin/does-not-exist',
    '/uploads/does-not-exist.png',
  ]) {
    it(`answers ${target} with JSON, not HTML`, async () => {
      const res = await fetch(`${baseUrl}${target}`);

      /*
       * 401 for the admin paths is correct and expected: that router requires a
       * session before it will consider a route, so an unknown one under it is
       * refused before the 404 handler is reached. What must never happen is a
       * 200 carrying the web page, which is indistinguishable from success to
       * anything that only checks the status.
       */
      assert.notEqual(res.status, 200, `${target} must not be answered with a 200`);
      assert.ok(
        res.status === 404 || res.status === 401,
        `${target} must be 404 or 401, got ${res.status}`,
      );
      assert.match(
        res.headers.get('content-type') ?? '',
        /application\/json/,
        `${target} must not be answered with the SPA`,
      );

      const body = (await res.json()) as ErrorBody;
      assert.equal(body.ok, false);
    });
  }

  it('still serves the web page for a client-side route', async (t) => {
    if (!hasBuild) {
      t.skip('no build output present');
      return;
    }
    const res = await fetch(`${baseUrl}/some/deep/spa/route`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  });

  it('still serves real API routes as JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  });

  /*
   * The dashboard is a separate document with its own bundle, and the address
   * an operator actually types is /admin/ — not /admin/index.html. Because the
   * static handler runs with `index: false`, /admin/ used to resolve to no file
   * and fall through to the SPA fallback, which answered it with the *public*
   * index.html. The operator landed on the marketing site with /admin/ in the
   * address bar, and the page then requested /api/admin/session, producing a 404
   * for a request they never made. Asserting on the document itself, rather
   * than the status code, is what makes the difference visible.
   */
  for (const target of ['/admin', '/admin/']) {
    it(`serves the dashboard document at ${target}`, async (t) => {
      if (!hasBuild) {
        t.skip('no build output present');
        return;
      }
      // `/admin` without the trailing slash is redirected by express.static before
      // the explicit handler runs, which is the correct outcome; following it
      // must still reach the dashboard.
      const res = await fetch(`${baseUrl}${target}`, { redirect: 'follow' });
      assert.equal(res.status, 200);
      assert.equal(new URL(res.url).pathname, '/admin/');

      const dashboard = await res.text();
      const publicSite = publicHtml();
      assert.notEqual(
        dashboard,
        publicSite,
        `${target} served the public site; the dashboard is a different document`,
      );
      assert.match(dashboard, /Dashboard/);
    });
  }

  it('sets the security headers on a 404', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  });
});
