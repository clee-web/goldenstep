import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { programmes, totalBeneficiaries, organisation } from '../shared/content.ts';
import { enquirySchema } from '../shared/schemas.ts';
import type { ApiError, ContentResponse, EnquiryResponse } from '../shared/schemas.ts';
import { readManagedContent, sortByDateDesc } from './content-store.ts';
import { inspectStorage } from './persistence.ts';
import { databaseFile, db } from './sqlite.ts';
import { countEnquiries, listEnquiries, saveEnquiry } from './store.ts';
import { sendEnquiryEmail } from './email.ts';

export const api = Router();

/** Only mounted outside tests, so the suite can submit freely. */
export const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'rate_limited',
    message: 'Too many enquiries from this connection. Please try again later.',
  } satisfies ApiError,
});

/**
 * Liveness, plus whether the data directory is actually persistent.
 *
 * The `storage` block is what turns "I lost my data again" from a recurring
 * mystery into something a deploy script can assert on. It deliberately does not
 * change the status code: a non-durable volume is a configuration problem, and
 * returning 503 would make Docker's HEALTHCHECK fail, so the platform would kill
 * an otherwise perfectly healthy container and restart it in a loop.
 *
 * Check it with:
 *   curl -s localhost:4000/api/health | grep -q '"durability":"durable"'
 */
api.get('/health', (_req, res) => {
  const storage = inspectStorage();

  /*
   * The database is opened here, not just described.
   *
   * Every other public route reads from SQLite, so "the data directory exists
   * and looks persistent" says nothing about whether the site can actually serve
   * its content. A permissions problem or a corrupt file leaves `/api/health`
   * reporting a clean bill of health while `/api/content` returns a 500, and on
   * shared hosting the log is often the only artefact available — so health
   * carries the failure itself. The `SELECT` is the cheapest statement that
   * still proves the file opened, the schema applied and the tables exist.
   *
   * As with `storage`, the status code stays 200: a restart cannot fix a
   * permissions or corruption problem, and answering 503 would turn a
   * configuration fault into a restart loop.
   */
  let database: { ok: boolean; file: string; error?: string };
  try {
    db().prepare('SELECT count(*) AS rows FROM projects').get();
    database = { ok: true, file: databaseFile };
  } catch (error) {
    database = {
      ok: false,
      file: databaseFile,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  res.json({
    ok: true,
    uptime: process.uptime(),
    database,
    storage: {
      durability: storage.durability,
      dataDir: storage.dataDir,
      detail: storage.detail,
    },
  });
});

api.get('/programmes', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    ok: true,
    organisation,
    totalBeneficiaries,
    count: programmes.length,
    programmes,
  });
});

/**
 * Managed content for the public site. Read-only and unauthenticated on purpose:
 * the page needs it to render, and it contains nothing that is not already
 * published. Admin writes go through `/api/admin`.
 */
api.get('/content', async (_req, res, next) => {
  try {
    const content = await readManagedContent();
    const body: ContentResponse = {
      ok: true,
      content: {
        ...content,
        // Newest first, so the dashboard's ordering matches what readers see.
        projects: [...content.projects].sort(sortByDateDesc),
        activities: [...content.activities].sort(sortByDateDesc),
      },
    };
    // Short shared cache: keeps the site responsive without pinning stale
    // content for long after an admin publishes.
    res.set('Cache-Control', 'public, max-age=60');
    res.json(body);
  } catch (error) {
    next(error);
  }
});

api.get('/enquiries', async (req, res, next) => {
  try {
    const topic = typeof req.query.topic === 'string' ? req.query.topic : undefined;
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200)
      : 50;

    res.json({ ok: true, total: await countEnquiries(), enquiries: await listEnquiries({ topic, limit }) });
  } catch (error) {
    next(error);
  }
});

api.post('/enquiries', async (req, res, next) => {
  try {
    const parsed = enquirySchema.safeParse(req.body);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        fields[key] ??= issue.message;
      }

      const body: ApiError = {
        ok: false,
        error: 'validation_error',
        message: 'Please correct the highlighted fields.',
        fields,
      };
      res.status(422).json(body);
      return;
    }

    const { website: _honeypot, ...input } = parsed.data;
    const record = await saveEnquiry(input);

    // Send email notification (non-blocking, doesn't fail the request if email fails)
    sendEnquiryEmail(input).catch((error) => {
      console.error('Email sending failed (but enquiry was saved):', error);
    });

    const body: EnquiryResponse = {
      ok: true,
      id: record.id,
      receivedAt: record.receivedAt,
    };
    res.status(201).json(body);
  } catch (error) {
    next(error);
  }
});
