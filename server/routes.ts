import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { programmes, totalBeneficiaries, organisation } from '../shared/content.ts';
import { enquirySchema } from '../shared/schemas.ts';
import type { ApiError, ContentResponse, EnquiryResponse } from '../shared/schemas.ts';
import { readManagedContent, sortByDateDesc } from './content-store.ts';
import { inspectStorage } from './persistence.ts';
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
  res.json({
    ok: true,
    uptime: process.uptime(),
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
