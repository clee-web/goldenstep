import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const dataDir = `${process.env.TEMP ?? '.'}\\golden-steps-admin-test-${process.pid}`;

process.env.DATA_DIR = dataDir;
process.env.SERVE_STATIC = 'false';
process.env.ADMIN_PASSWORD = 'correct horse battery staple';
process.env.ADMIN_SESSION_SECRET = 'test-secret-not-used-in-production';
process.env.NODE_ENV = 'test';
// Kept tiny so the oversize test does not have to allocate megabytes. The three
// ceilings are deliberately distinct, so the split between them is testable: a
// payload that is over the image limit but under the document limit must be
// accepted as a PDF and rejected as an image, and one over the document limit
// must be rejected even though the video ceiling is still above it.
process.env.MAX_UPLOAD_BYTES = '2048';
process.env.MAX_DOCUMENT_BYTES = '4096';
process.env.MAX_VIDEO_BYTES = '8192';

const { createApp } = await import('./index.ts');

const app = createApp({ enforceRateLimit: false });
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

interface ErrorBody {
  ok: boolean;
  error: string;
  message: string;
  fields?: Record<string, string>;
}
interface SessionBody {
  ok: boolean;
  authenticated: boolean;
  configured: boolean;
}
interface ContentBody {
  ok: boolean;
  content: {
    pictures: { id: string; src: string; alt: string; tag: string; caption: string }[];
    projects: { id: string; title: string; date: string; programme: string }[];
    activities: { id: string; title: string; date: string }[];
    teamMembers: { id: string; name: string }[];
    testimonials: { id: string; name: string; role: string; testimonial: string }[];
    policies: { id: string; title: string; file: string; category: string; date: string }[];
    programmes: Record<string, {
      name?: string;
      beneficiaries?: number;
      image?: string;
      imageAlt?: string;
    }>;
    impact: { lead?: string };
  };
}

const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

/** Holds the session cookie between requests, standing in for a browser jar. */
let cookie = '';

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(dataDir, { recursive: true, force: true });
});

const login = (password: string): Promise<Response> =>
  fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });

const send = (path: string, method: string, body?: unknown): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('admin authentication', () => {
  it('reports the session as unauthenticated before sign-in', async () => {
    const res = await fetch(`${baseUrl}/api/admin/session`);
    const body = await json<SessionBody>(res);
    assert.equal(res.status, 200);
    assert.equal(body.authenticated, false);
    assert.equal(body.configured, true);
  });

  it('rejects a wrong password', async () => {
    const res = await login('not the password');
    assert.equal(res.status, 401);
    const body = await json<ErrorBody>(res);
    assert.equal(body.error, 'unauthorized');
  });

  it('refuses every write without a session', async () => {
    for (const [path, method] of [
      ['/api/admin/projects', 'POST'],
      ['/api/admin/pictures', 'POST'],
      ['/api/admin/activities', 'POST'],
      ['/api/admin/team', 'POST'],
      ['/api/admin/testimonials', 'POST'],
      ['/api/admin/policies', 'POST'],
      ['/api/admin/impact', 'PATCH'],
    ] as const) {
      const res = await send(path, method, {});
      assert.equal(res.status, 401, `${method} ${path} should require auth`);
    }
  });

  it('accepts the configured password and issues a cookie', async () => {
    const res = await login('correct horse battery staple');
    assert.equal(res.status, 200);

    const setCookie = res.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /gs_admin=/);
    // The cookie must not be readable from JavaScript, or XSS would defeat it.
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);

    cookie = setCookie.split(';')[0] ?? '';

    const session = await json<SessionBody>(
      await fetch(`${baseUrl}/api/admin/session`, { headers: { cookie } }),
    );
    assert.equal(session.authenticated, true);
  });

  it('rejects a tampered cookie', async () => {
    const res = await fetch(`${baseUrl}/api/admin/content`, {
      headers: { cookie: 'gs_admin=9999999999999.abcdef.forged' },
    });
    assert.equal(res.status, 401);
  });
});

describe('managed content CRUD', () => {
  it('starts empty', async () => {
    const body = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.deepEqual(body.content.pictures, []);
    assert.deepEqual(body.content.projects, []);
    assert.deepEqual(body.content.programmes, {});
  });

  it('names the offending fields', async () => {
    const res = await send('/api/admin/projects', 'POST', { title: 'x', summary: 'y' });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.equal(body.error, 'validation_error');
    // Field-level errors let the dashboard highlight the exact inputs rather
    // than showing one opaque banner.
    assert.ok(body.fields?.title, `expected a title error, got ${JSON.stringify(body.fields)}`);
    assert.ok(body.fields?.summary);
  });

  it('requires alt text when an image is set', async () => {
    const res = await send('/api/admin/projects', 'POST', {
      title: 'A project with an undescribed image',
      summary: 'The image has no alt text, which hides it from screen readers.',
      programme: 'gender',
      status: 'Planned',
      date: '2026-02-01',
      image: '/uploads/photo.jpg',
      imageAlt: '',
    });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.ok(body.fields?.imageAlt);
  });

  it('rejects a project image outside the allowed schemes', async () => {
    const res = await send('/api/admin/projects', 'POST', {
      title: 'A project with a hostile image',
      summary: 'This tries to smuggle in a javascript URL through the image field.',
      programme: 'gender',
      status: 'Planned',
      date: '2026-02-01',
      image: 'javascript:alert(1)',
      imageAlt: 'Something descriptive',
    });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.ok(body.fields?.image);
  });

  it('creates, reads, updates and deletes a project', async () => {
    const created = await send('/api/admin/projects', 'POST', {
      title: 'Kisumu East women\'s cooperative',
      summary: 'A savings cooperative supporting forty five women traders.',
      programme: 'economic',
      status: 'In progress',
      date: '2026-04-01',
      location: 'Kisumu East',
    });
    assert.equal(created.status, 201);
    const { project } = await json<{ ok: boolean; project: { id: string } }>(created);

    const listed = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.equal(listed.content.projects.length, 1);
    assert.equal(listed.content.projects[0]?.id, project.id);

    const updated = await send(`/api/admin/projects/${project.id}`, 'PUT', {
      title: 'Kisumu East women\'s cooperative',
      summary: 'A savings cooperative supporting fifty women traders.',
      programme: 'economic',
      status: 'Completed',
      date: '2026-04-01',
      location: 'Kisumu East',
    });
    assert.equal(updated.status, 200);

    const afterUpdate = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.match(afterUpdate.content.projects[0]?.title ?? '', /women/);

    const removed = await send(`/api/admin/projects/${project.id}`, 'DELETE');
    assert.equal(removed.status, 200);

    const afterDelete = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.deepEqual(afterDelete.content.projects, []);
  });

  it('404s when updating something that does not exist', async () => {
    const res = await send('/api/admin/projects/does-not-exist', 'PUT', {
      title: 'Ghost project',
      summary: 'This should not be creatable at all.',
      programme: 'health',
      status: 'Planned',
      date: '2026-01-01',
    });
    assert.equal(res.status, 404);
  });

  it('refuses image sources that are not uploads, assets or https', async () => {
    const res = await send('/api/admin/pictures', 'POST', {
      src: 'javascript:alert(1)',
      alt: 'A picture',
      tag: 'Test',
      caption: 'A caption',
    });
    assert.equal(res.status, 422);
  });

  it('accepts an /uploads image source', async () => {
    const res = await send('/api/admin/pictures', 'POST', {
      src: '/uploads/example.jpg',
      alt: 'Women at a community meeting',
      tag: 'Community',
      caption: 'Listening before acting.',
    });
    assert.equal(res.status, 201);
  });

  it('refuses a video with no captions track', async () => {
    // WCAG 1.2.2. Uncaptioned video is not publishable, so the schema rejects it
    // rather than shipping a player that fails the site's accessibility target.
    const res = await send('/api/admin/pictures', 'POST', {
      src: '/uploads/field-work.mp4',
      alt: 'A group discussion in an open field',
      tag: 'Field work',
      caption: 'The group deciding what to do next.',
    });
    assert.equal(res.status, 422);
    const body = await json<{ fields?: Record<string, string> }>(res);
    assert.ok(body.fields?.captionsSrc, 'the error must name the captions field');
  });

  it('accepts a video once a captions track is supplied', async () => {
    const res = await send('/api/admin/pictures', 'POST', {
      src: '/uploads/field-work.mp4',
      alt: 'A group discussion in an open field',
      tag: 'Field work',
      caption: 'The group deciding what to do next.',
      captionsSrc: '/uploads/field-work.vtt',
      poster: '/uploads/field-work-still.jpg',
    });
    assert.equal(res.status, 201);
    const body = await json<{ picture: { captionsSrc: string; poster: string } }>(res);
    assert.equal(body.picture.captionsSrc, '/uploads/field-work.vtt');
    assert.equal(body.picture.poster, '/uploads/field-work-still.jpg');
  });

  it('refuses a captions track that is not a .vtt file', async () => {
    const res = await send('/api/admin/pictures', 'POST', {
      src: '/uploads/field-work.mp4',
      alt: 'A group discussion in an open field',
      tag: 'Field work',
      caption: 'The group deciding what to do next.',
      captionsSrc: '/uploads/field-work.srt',
    });
    assert.equal(res.status, 422);
  });

  it('ignores a query string when deciding whether a source is a video', async () => {
    // A CDN URL carries both a query string and an extension; the extension is
    // what decides the element, so the rule has to look past the query.
    const res = await send('/api/admin/pictures', 'POST', {
      src: '/uploads/field-work.mp4?v=3',
      alt: 'A group discussion in an open field',
      tag: 'Field work',
      caption: 'The group deciding what to do next.',
    });
    assert.equal(res.status, 422);
  });

  it('creates and deletes an activity', async () => {
    const created = await send('/api/admin/activities', 'POST', {
      title: 'Maternal health workshop',
      description: 'A two day workshop with nineteen health workers.',
      kind: 'Training',
      date: '2026-05-12',
    });
    assert.equal(created.status, 201);
    const { activity } = await json<{ ok: boolean; activity: { id: string } }>(created);

    const removed = await send(`/api/admin/activities/${activity.id}`, 'DELETE');
    assert.equal(removed.status, 200);
  });

  it('creates, reads, updates and deletes a testimonial', async () => {
    const created = await send('/api/admin/testimonials', 'POST', {
      name: 'Achieng Odhiambo',
      role: 'VSLA group leader, Nyalenda A',
      testimonial:
        'I joined the savings group with nothing. Now I can pay my child\'s school fees without borrowing.',
      order: 1,
    });
    assert.equal(created.status, 201);
    const { testimonial } = await json<{ ok: boolean; testimonial: { id: string } }>(created);

    const listed = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.equal(listed.content.testimonials.length, 1);
    assert.equal(listed.content.testimonials[0]?.id, testimonial.id);

    const updated = await send(`/api/admin/testimonials/${testimonial.id}`, 'PUT', {
      name: 'Achieng Odhiambo',
      role: 'VSLA group leader, Nyalenda A',
      testimonial:
        'I joined the savings group with nothing. Now I pay my child\'s school fees without borrowing.',
      order: 0,
    });
    assert.equal(updated.status, 200);

    const afterUpdate = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.match(afterUpdate.content.testimonials[0]?.testimonial ?? '', /savings group/);

    const removed = await send(`/api/admin/testimonials/${testimonial.id}`, 'DELETE');
    assert.equal(removed.status, 200);

    const afterDelete = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.deepEqual(afterDelete.content.testimonials, []);
  });

  it('names the offending fields on a testimonial', async () => {
    const res = await send('/api/admin/testimonials', 'POST', { name: 'x', testimonial: 'y' });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.ok(body.fields?.name);
    assert.ok(body.fields?.role);
    assert.ok(body.fields?.testimonial);
  });

  it('requires alt text when a testimonial image is set', async () => {
    const res = await send('/api/admin/testimonials', 'POST', {
      name: 'A community member',
      role: 'Programme participant',
      testimonial: 'The safe space group gave me people to talk to when I needed them most.',
      image: '/uploads/portrait.jpg',
      imageAlt: '',
    });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.ok(body.fields?.imageAlt);
  });

  it('404s when updating a testimonial that does not exist', async () => {
    const res = await send('/api/admin/testimonials/does-not-exist', 'PUT', {
      name: 'Ghost testimonial',
      role: 'Nobody',
      testimonial: 'This should not be creatable at all.',
    });
    assert.equal(res.status, 404);
  });

  it('creates, reads, updates and deletes a policy document', async () => {
    const created = await send('/api/admin/policies', 'POST', {
      title: 'Safeguarding policy',
      category: 'Safeguarding',
      summary: 'How we identify, respond to and refer a concern about a child.',
      file: '/uploads/safeguarding-policy.pdf',
      date: '2026-01-15',
      bytes: 245_760,
      order: 0,
    });
    assert.equal(created.status, 201);
    const { policy } = await json<{ ok: boolean; policy: { id: string } }>(created);

    const listed = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.equal(listed.content.policies.length, 1);
    assert.equal(listed.content.policies[0]?.file, '/uploads/safeguarding-policy.pdf');

    const updated = await send(`/api/admin/policies/${policy.id}`, 'PUT', {
      title: 'Safeguarding policy (2026 revision)',
      category: 'Safeguarding',
      summary: 'How we identify, respond to and refer a concern about a child.',
      file: '/uploads/safeguarding-policy.pdf',
      date: '2026-08-01',
      bytes: 245_760,
      order: 0,
    });
    assert.equal(updated.status, 200);

    const afterUpdate = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.match(afterUpdate.content.policies[0]?.title ?? '', /2026 revision/);

    const removed = await send(`/api/admin/policies/${policy.id}`, 'DELETE');
    assert.equal(removed.status, 200);

    const afterDelete = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.deepEqual(afterDelete.content.policies, []);
  });

  it('refuses a policy document that is not a PDF', async () => {
    // A `.html` or `.svg` path would open in the browser and, served from the
    // site's own origin, run as same-origin active content. The extension is the
    // rule, not a naming convention.
    for (const file of [
      '/uploads/policy.svg',
      '/uploads/policy.html',
      'javascript:alert(1).pdf',
    ]) {
      const res = await send('/api/admin/policies', 'POST', {
        title: 'A policy that is not a PDF',
        file,
      });
      assert.equal(res.status, 422, `${file} should be rejected`);
      const body = await json<ErrorBody>(res);
      assert.ok(body.fields?.file, `expected a file error for ${file}`);
    }
  });

  it('accepts an https URL to a PDF', async () => {
    const res = await send('/api/admin/policies', 'POST', {
      title: 'External safeguarding policy',
      file: 'https://example.org/policies/safeguarding.pdf',
    });
    assert.equal(res.status, 201);
    const { policy } = await json<{ ok: boolean; policy: { id: string } }>(res);
    assert.equal((await send(`/api/admin/policies/${policy.id}`, 'DELETE')).status, 200);
  });

  it('accepts a policy with no date, category or summary', async () => {
    // A small organisation may genuinely not have recorded an adoption date. A
    // blank means "not published", and must not be read as a required field.
    const res = await send('/api/admin/policies', 'POST', {
      title: 'A policy with no metadata',
      file: '/uploads/bare.pdf',
    });
    assert.equal(res.status, 201);
    const { policy } = await json<{ ok: boolean; policy: { id: string; date: string } }>(res);
    assert.equal(policy.date, '');
    assert.equal((await send(`/api/admin/policies/${policy.id}`, 'DELETE')).status, 200);
  });

  it('rejects a malformed policy date', async () => {
    const res = await send('/api/admin/policies', 'POST', {
      title: 'A policy with a broken date',
      file: '/uploads/dated.pdf',
      date: '15/01/2026',
    });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.ok(body.fields?.date);
  });

  it('404s when updating a policy that does not exist', async () => {
    const res = await send('/api/admin/policies/does-not-exist', 'PUT', {
      title: 'Ghost policy',
      file: '/uploads/ghost.pdf',
    });
    assert.equal(res.status, 404);
  });

  it('patches a programme without clobbering other fields', async () => {
    const res = await send('/api/admin/programmes/health', 'PATCH', {
      beneficiaries: 9_000,
    });
    assert.equal(res.status, 200);
    const body = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.equal(body.content.programmes.health?.beneficiaries, 9_000);
    assert.equal(body.content.programmes.health?.name, undefined);
  });

  it('allows swapping a programme image while keeping the existing alt text', async () => {
    // The seeded programme already has alt text, so replacing only the image is
    // a complete, accessible change. The patch schema cannot see the baseline,
    // which is why this is enforced against the merged programme instead.
    const res = await send('/api/admin/programmes/health', 'PATCH', {
      image: '/uploads/replacement-photo.png',
    });
    assert.equal(res.status, 200);
    const body = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.equal(body.content.programmes.health?.image, '/uploads/replacement-photo.png');
    assert.equal(body.content.programmes.health?.imageAlt, undefined, 'alt text untouched');
  });

  it('rejects a programme image change that would leave no alt text', async () => {
    const res = await send('/api/admin/programmes/economic', 'PATCH', {
      image: '/uploads/second-photo.png',
      imageAlt: '',
    });
    assert.equal(res.status, 422);
    const body = await json<ErrorBody>(res);
    assert.ok(body.fields?.imageAlt, 'the alt text field is named so the form can highlight it');
  });

  it('rejects an empty programme patch', async () => {
    const res = await send('/api/admin/programmes/health', 'PATCH', {});
    assert.equal(res.status, 422);
  });

  it('404s when patching an unknown programme', async () => {
    const res = await send('/api/admin/programmes/nope', 'PATCH', {
      name: 'Not a real programme',
    });
    assert.equal(res.status, 404);
  });

  it('exposes published testimonials on the public endpoint', async () => {
    await send('/api/admin/testimonials', 'POST', {
      name: 'Public visibility check',
      role: 'Community leader',
      testimonial: 'This testimonial must be readable by the public site.',
    });

    const body = await json<ContentBody>(await fetch(`${baseUrl}/api/content`));
    assert.equal(body.content.testimonials.at(-1)?.name, 'Public visibility check');
  });

  it('exposes published policy documents on the public endpoint', async () => {
    await send('/api/admin/policies', 'POST', {
      title: 'Public visibility check',
      file: '/uploads/public-check.pdf',
      date: '2026-05-04',
    });

    const body = await json<ContentBody>(await fetch(`${baseUrl}/api/content`));
    assert.equal(body.content.policies.at(-1)?.title, 'Public visibility check');
  });

  it('patches the impact copy', async () => {
    const res = await send('/api/admin/impact', 'PATCH', {
      totalLabel: 'People reached to date',
    });
    assert.equal(res.status, 200);
    const body = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.equal(body.content.impact.lead, undefined);
  });

  it('resets everything and sweeps uploaded files from disk', async () => {
    // A live upload is needed so the reset has a real generated file to reclaim.
    const form = new FormData();
    form.set(
      'image',
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      }),
      'sweep.png',
    );
    const upload = await fetch(`${baseUrl}/api/admin/uploads`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    assert.equal(upload.status, 201);
    const { src } = await json<{ src: string }>(upload);
    const stored = path.join(dataDir, 'uploads', path.basename(src));
    assert.equal(existsSync(stored), true);

    const res = await send('/api/admin/content/reset', 'POST');
    assert.equal(res.status, 200);
    const body = await json<ContentBody>(await send('/api/admin/content', 'GET'));
    assert.deepEqual(body.content.pictures, []);
    assert.deepEqual(body.content.programmes, {});
    assert.deepEqual(body.content.testimonials, []);
    assert.deepEqual(
      body.content.policies,
      [],
      'a reset must not leave policy documents behind',
    );
    assert.equal(existsSync(stored), false, 'reset must not strand uploads on disk');
  });
});

describe('public content endpoint', () => {
  it('exposes managed content without authentication', async () => {
    await send('/api/admin/projects', 'POST', {
      title: 'Public visibility check',
      summary: 'This project must be readable by the public site.',
      programme: 'gender',
      status: 'In progress',
      date: '2026-06-01',
    });

    const res = await fetch(`${baseUrl}/api/content`);
    assert.equal(res.status, 200);
    const body = await json<ContentBody>(res);
    assert.equal(body.content.projects.length, 1);
    assert.equal(body.content.projects[0]?.title, 'Public visibility check');
  });

  it('orders projects newest first', async () => {
    await send('/api/admin/projects', 'POST', {
      title: 'An older project',
      summary: 'Dated earlier so it should sort last.',
      programme: 'climate',
      status: 'Completed',
      date: '2025-01-01',
    });

    const body = await json<ContentBody>(await fetch(`${baseUrl}/api/content`));
    const dates = body.content.projects.map((project) => project.date);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });

  it('never leaks programme ids outside the known set', async () => {
    const body = await json<ContentBody>(await fetch(`${baseUrl}/api/content`));
    for (const project of body.content.projects) {
      assert.ok(
        ['gender', 'health', 'child', 'economic', 'justice', 'climate'].includes(
          project.programme,
        ),
      );
    }
  });
});

describe('image uploads', () => {
  /** A real 1x1 PNG, so the upload path is exercised with genuine image bytes. */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  const upload = (body: FormData): Promise<Response> =>
    fetch(`${baseUrl}/api/admin/uploads`, {
      method: 'POST',
      headers: { cookie },
      body,
    });

  const withFile = (bytes: Buffer, name: string, type: string): FormData => {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type }), name);
    return form;
  };

  it('rejects an upload without a session', async () => {
    const res = await fetch(`${baseUrl}/api/admin/uploads`, {
      method: 'POST',
      body: withFile(PNG, 'pixel.png', 'image/png'),
    });
    assert.equal(res.status, 401);
  });

  it('rejects an upload with no file part', async () => {
    const res = await upload(new FormData());
    assert.equal(res.status, 400);
  });

  it('rejects a non-image type', async () => {
    const res = await upload(withFile(Buffer.from('#!/bin/sh\nrm -rf /'), 'evil.sh', 'application/x-sh'));
    assert.equal(res.status, 415);
    const body = await json<ErrorBody>(res);
    assert.equal(body.error, 'unsupported_media_type');
  });

  it('rejects an SVG, which is a scriptable document', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await upload(withFile(svg, 'vector.svg', 'image/svg+xml'));
    assert.equal(res.status, 415);
  });

  it('rejects a file over the size limit', async () => {
    const res = await upload(withFile(Buffer.alloc(4096, 7), 'big.png', 'image/png'));
    assert.equal(res.status, 413);
    const body = await json<ErrorBody>(res);
    assert.equal(body.error, 'payload_too_large');
  });

  it('rejects an image over the image limit even though videos may be larger', async () => {
    // 4096 bytes is over MAX_UPLOAD_BYTES (2048) and under MAX_VIDEO_BYTES
    // (8192). Because multer only takes one ceiling, this is the check that stops
    // an image from using the video allowance to push 8KB of padding through.
    const res = await upload(withFile(Buffer.alloc(4096, 7), 'big.png', 'image/png'));
    assert.equal(res.status, 413);
    const body = await json<ErrorBody>(res);
    assert.match(body.message, /^Images must be 0MB or smaller\./);
  });

  it('accepts a video over the image limit and reports it as a video', async () => {
    const res = await upload(withFile(Buffer.alloc(4096, 7), 'field.mp4', 'video/mp4'));
    assert.equal(res.status, 201);
    const body = await json<{ src: string; kind: string }>(res);
    assert.equal(body.kind, 'video');
    assert.match(body.src, /^\/uploads\/[a-z0-9-]+\.mp4$/);
  });

  it('rejects a video over the video limit', async () => {
    const res = await upload(withFile(Buffer.alloc(16384, 7), 'long.mp4', 'video/mp4'));
    assert.equal(res.status, 413);
    const body = await json<ErrorBody>(res);
    assert.match(body.message, /^Videos must be 0MB or smaller\./);
  });

  it('accepts a WebVTT captions track', async () => {
    const vtt = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello.\n');
    const res = await upload(withFile(vtt, 'captions.vtt', 'text/vtt'));
    assert.equal(res.status, 201);
    const { src } = await json<{ src: string; kind: string }>(res);
    assert.equal(src.endsWith('.vtt'), true);
    assert.equal((await fetch(`${baseUrl}${src}`)).status, 200);
  });

  it('rejects an SRT, which no browser will load in a track element', async () => {
    const res = await upload(withFile(Buffer.from('1\n00:00:00,000 --> 00:00:02,000\nHi\n'), 'c.srt', 'application/x-subrip'));
    assert.equal(res.status, 415);
  });

  it('stores an accepted image and serves it back from /uploads', async () => {
    const res = await upload(withFile(PNG, 'my holiday snap.png', 'image/png'));
    assert.equal(res.status, 201);
    const { src } = await json<{ ok: boolean; src: string }>(res);

    // The generated name must not leak the client-supplied filename, which is
    // attacker-controlled and could otherwise escape the uploads directory.
    assert.match(src, /^\/uploads\/[a-z0-9-]+\.png$/);
    assert.ok(!src.includes('holiday'));

    const fetched = await fetch(`${baseUrl}${src}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-type'), 'image/png');
    // Defence in depth: an uploaded file must never be treated as a document.
    assert.equal(fetched.headers.get('x-content-type-options'), 'nosniff');
    const bytes = Buffer.from(await fetched.arrayBuffer());
    assert.ok(bytes.equals(PNG), 'stored bytes should match what was uploaded');
  });

  it('gives two uploads of the same name distinct paths', async () => {
    const first = await upload(withFile(PNG, 'same.png', 'image/png'));
    const second = await upload(withFile(PNG, 'same.png', 'image/png'));
    const a = await json<{ src: string }>(first);
    const b = await json<{ src: string }>(second);
    assert.notEqual(a.src, b.src);
  });

  it('accepts a PDF and reports it as a document with its size', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const res = await upload(withFile(pdf, 'safeguarding policy.pdf', 'application/pdf'));
    assert.equal(res.status, 201);
    const body = await json<{ src: string; kind: string; bytes: number }>(res);
    assert.equal(body.kind, 'document');
    assert.equal(body.bytes, pdf.length);
    // The client-supplied name is never used for the path, exactly as for images.
    assert.match(body.src, /^\/uploads\/[a-z0-9-]+\.pdf$/);
    assert.ok(!body.src.includes('safeguarding'));
  });

  it('serves a PDF as a download rather than rendering it same-origin', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const { src } = await json<{ src: string }>(
      await upload(withFile(pdf, 'download-me.pdf', 'application/pdf')),
    );

    const fetched = await fetch(`${baseUrl}${src}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-type'), 'application/pdf');
    /*
     * A PDF can carry embedded script, and a scripted viewer can reach the page
     * that embedded it. `attachment` is what makes the response a download, so an
     * uploaded policy can never become same-origin active content.
     */
    assert.equal(fetched.headers.get('content-disposition'), 'attachment');
  });

  it('does not force a download on non-PDF uploads', async () => {
    const { src } = await json<{ src: string }>(
      await upload(withFile(PNG, 'inline.png', 'image/png')),
    );
    const fetched = await fetch(`${baseUrl}${src}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-disposition'), null);
  });

  it('accepts a PDF over the image limit but rejects it over the document limit', async () => {
    // 3072 bytes is over MAX_UPLOAD_BYTES (2048) and under MAX_DOCUMENT_BYTES
    // (4096), so this is the check that a policy document does not inherit the
    // image ceiling — a scanned policy with photographs in it is routinely
    // larger than a photograph.
    const accepted = await upload(
      withFile(Buffer.alloc(3072, 7), 'policy.pdf', 'application/pdf'),
    );
    assert.equal(accepted.status, 201);
    assert.equal((await json<{ kind: string }>(accepted)).kind, 'document');

    // 12288 bytes clears the video ceiling too, so a rejected PDF cannot be
    // blamed on the wrong limit: it must stop at the document one.
    const rejected = await upload(
      withFile(Buffer.alloc(12288, 7), 'huge-policy.pdf', 'application/pdf'),
    );
    assert.equal(rejected.status, 413);
    const body = await json<ErrorBody>(rejected);
    assert.match(body.message, /^Documents must be 0MB or smaller\./);
  });

  it('deletes the PDF from disk when its policy is removed', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const { src } = await json<{ src: string }>(
      await upload(withFile(pdf, 'doomed-policy.pdf', 'application/pdf')),
    );
    const created = await send('/api/admin/policies', 'POST', {
      title: 'A policy whose file should be reclaimed',
      file: src,
    });
    const { policy } = await json<{ policy: { id: string } }>(created);

    assert.equal((await fetch(`${baseUrl}${src}`)).status, 200);
    assert.equal((await send(`/api/admin/policies/${policy.id}`, 'DELETE')).status, 200);
    // The record is gone and the file with it, rather than leaking forever.
    assert.equal((await fetch(`${baseUrl}${src}`)).status, 404);
  });

  it('deletes the file from disk when its picture is removed', async () => {
    const { src } = await json<{ src: string }>(
      await upload(withFile(PNG, 'doomed.png', 'image/png')),
    );
    const created = await send('/api/admin/pictures', 'POST', {
      src,
      alt: 'A one pixel test image',
      tag: 'Test',
      caption: 'Only a pixel, but it round-trips.',
    });
    const { picture } = await json<{ picture: { id: string } }>(created);

    assert.equal((await fetch(`${baseUrl}${src}`)).status, 200);

    assert.equal((await send(`/api/admin/pictures/${picture.id}`, 'DELETE')).status, 200);

    // The record is gone and the file with it, rather than leaking forever.
    assert.equal((await fetch(`${baseUrl}${src}`)).status, 404);
  });
});

describe('sign out', () => {
  it('invalidates the session', async () => {
    const res = await fetch(`${baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { cookie },
    });
    assert.equal(res.status, 200);
    // Emulate the browser dropping the cookie the server just expired. Without
    // this the test would keep replaying a cookie the client no longer holds.
    cookie = '';
    assert.equal((await send('/api/admin/content', 'GET')).status, 401);
  });
});
