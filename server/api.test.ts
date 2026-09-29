import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.DATA_DIR = `${process.env.TEMP ?? '.'}\\golden-steps-test-${process.pid}`;
process.env.SERVE_STATIC = 'false';

const { createApp } = await import('./index.ts');
const { listEnquiries } = await import('./store.ts');

const app = createApp({ enforceRateLimit: false });
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

interface ProgrammesBody {
  ok: boolean;
  count: number;
  totalBeneficiaries: number;
  programmes: { id: string; name: string; beneficiaries: number }[];
}
interface HealthBody {
  ok: boolean;
}
interface EnquiryBody {
  ok: boolean;
  id: string;
  receivedAt: string;
}
interface EnquiryListBody {
  ok: boolean;
  total: number;
  enquiries: { id: string; email: string; topic: string }[];
}
interface ErrorBody {
  ok: boolean;
  error: string;
  message: string;
  fields?: Record<string, string>;
}

const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

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
});

const post = (body: unknown) =>
  fetch(`${baseUrl}/api/enquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const validPayload = {
  name: 'Amina Otieno',
  email: 'Amina.Otieno@Example.org',
  organisation: 'Kisumu Youth Network',
  topic: 'Partnership',
  message: 'We would like to co-run a safe spaces programme in Kolwa Central.',
};

describe('GET /api/programmes', () => {
  it('returns all six programmes and a beneficiary total', async () => {
    const res = await fetch(`${baseUrl}/api/programmes`);
    assert.equal(res.status, 200);

    const body = await json<ProgrammesBody>(res);
    assert.equal(body.ok, true);
    assert.equal(body.count, 6);
    assert.equal(body.programmes.length, 6);

    const summed = body.programmes.reduce(
      (total, programme) => total + programme.beneficiaries,
      0,
    );
    assert.equal(summed, body.totalBeneficiaries);
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await json<HealthBody>(res)).ok, true);
  });
});

describe('POST /api/enquiries', () => {
  it('accepts a valid enquiry and normalises the email', async () => {
    const res = await post(validPayload);
    assert.equal(res.status, 201);

    const body = await json<EnquiryBody>(res);
    assert.equal(body.ok, true);
    assert.match(body.id, /^[0-9a-f-]{36}$/);
    assert.ok(!Number.isNaN(Date.parse(body.receivedAt)));

    const stored = await listEnquiries();
    const record = stored.find((entry) => entry.id === body.id);
    assert.ok(record, 'enquiry should be persisted');
    assert.equal(record.email, 'amina.otieno@example.org');
    assert.equal(record.topic, 'Partnership');
  });

  it('rejects an unknown topic with field-level errors', async () => {
    const res = await post({ ...validPayload, topic: 'Free money' });
    assert.equal(res.status, 422);

    const body = await json<ErrorBody>(res);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'validation_error');
    assert.ok(body.fields?.topic);
  });

  it('rejects a short message', async () => {
    const res = await post({ ...validPayload, message: 'hi' });
    assert.equal(res.status, 422);
    assert.ok((await json<ErrorBody>(res)).fields?.message);
  });

  it('rejects a malformed email', async () => {
    const res = await post({ ...validPayload, email: 'not-an-email' });
    assert.equal(res.status, 422);
    assert.ok((await json<ErrorBody>(res)).fields?.email);
  });

  it('rejects a filled honeypot', async () => {
    const res = await post({ ...validPayload, website: 'http://spam.example' });
    assert.equal(res.status, 422);
  });
});

describe('GET /api/enquiries', () => {
  it('returns the most recent enquiries first', async () => {
    const res = await fetch(`${baseUrl}/api/enquiries?limit=5`);
    assert.equal(res.status, 200);

    const body = await json<EnquiryListBody>(res);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.enquiries));
    assert.ok(body.enquiries.length <= 5);
  });

  it('filters by topic', async () => {
    const res = await fetch(`${baseUrl}/api/enquiries?topic=NoSuchTopic`);
    const body = await json<EnquiryListBody>(res);
    assert.equal(body.enquiries.length, 0);
  });

  it('clamps an out-of-range limit', async () => {
    const res = await fetch(`${baseUrl}/api/enquiries?limit=99999`);
    const body = await json<EnquiryListBody>(res);
    assert.ok(body.enquiries.length <= 200);
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    assert.equal(res.status, 404);
    assert.equal((await json<ErrorBody>(res)).error, 'not_found');
  });
});
