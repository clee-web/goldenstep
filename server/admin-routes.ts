import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import {
  activityInputSchema,
  impactPatchSchema,
  pictureInputSchema,
  policyInputSchema,
  programmePatchSchema,
  projectInputSchema,
  teamMemberInputSchema,
  testimonialInputSchema,
  type ApiError,
} from '../shared/schemas.ts';
import { loginHandler, logoutHandler, requireAdmin, sessionHandler } from './auth.ts';
import {
  ContentValidationError,
  LimitError,
  addActivity,
  addPicture,
  addPolicy,
  addProject,
  addTeamMember,
  addTestimonial,
  deleteActivity,
  deletePicture,
  deletePolicy,
  deleteProject,
  deleteTeamMember,
  deleteTestimonial,
  patchImpact,
  patchProgramme,
  readManagedContent,
  resetContent,
  sortByDateDesc,
  updateActivity,
  updatePicture,
  updatePolicy,
  updateProject,
  updateTeamMember,
  updateTestimonial,
} from './content-store.ts';
import {
  enforceMediaLimit,
  publicPathFor,
  removeAllUploads,
  removeUpload,
  uploadErrorHandler,
  uploadImage,
  uploadKindFor,
} from './uploads.ts';

export const admin = Router();

/**
 * Brute-force guard on the password endpoint only. Everything else is gated by
 * the session cookie, so this is the single guessable surface.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: {
    ok: false,
    error: 'rate_limited',
    message: 'Too many sign-in attempts. Please wait and try again.',
  } satisfies ApiError,
});

const fail = (res: Response, status: number, error: ApiError['error'], message: string): void => {
  res.status(status).json({ ok: false, error, message } satisfies ApiError);
};

const invalid = (res: Response, error: { issues: { path: PropertyKey[]; message: string }[] }): void => {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  res.status(422).json({
    ok: false,
    error: 'validation_error',
    message: 'Please correct the highlighted fields.',
    fields,
  } satisfies ApiError);
};

const notFound = (res: Response, what: string): void => {
  fail(res, 404, 'not_found', `${what} not found.`);
};

/** Wraps an async handler so rejections reach the error middleware. */
const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

/* --------------------------------- session -------------------------------- */

admin.get('/session', sessionHandler);
admin.post('/login', loginLimiter, loginHandler);
admin.post('/logout', logoutHandler);

// Everything below this line requires a valid session.
admin.use(requireAdmin);

/* --------------------------------- content -------------------------------- */

admin.get(
  '/content',
  wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, content: await readManagedContent() });
  }),
);

admin.post(
  '/content/reset',
  wrap(async (_req, res) => {
    const content = await resetContent();
    // Drop the images the removed records pointed at, so a reset does not
    // strand uploads on disk with nothing left that can reference them.
    const removed = await removeAllUploads();
    res.json({ ok: true, content, removedUploads: removed });
  }),
);

/* --------------------------------- pictures ------------------------------- */

/**
 * Multipart upload. Returns the stored path; the client then creates the picture.
 *
 * `uploadErrorHandler` is a 4-argument Express error handler placed in the same
 * route stack, so it receives only multer's errors. It cannot be wrapped around
 * the multer call: multer reports failures through `next` asynchronously, long
 * after the middleware has already returned.
 */
admin.post(
  '/uploads',
  uploadImage,
  enforceMediaLimit,
  (req: Request, res: Response) => {
    if (!req.file) {
      fail(res, 400, 'validation_error', 'No image was received.');
      return;
    }
    /*
     * `kind` is returned so the dashboard knows whether the file it just sent is
     * going to be rendered as an <img>, played as a <video>, or offered as a
     * downloadable document, without having to infer it from the extension. The
     * gallery still derives it client-side, so a picture added by any other route
     * is classified the same way.
     *
     * `bytes` is the stored size, reported so a document list can tell the
     * reader how large a download is before they start it.
     */
    res.status(201).json({
      ok: true,
      src: publicPathFor(req.file.filename),
      kind: uploadKindFor(req.file.mimetype),
      bytes: req.file.size,
    });
  },
  uploadErrorHandler,
);

admin.post(
  '/pictures',
  (req, res, next) => {
    const parsed = pictureInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    addPicture(parsed.data)
      .then((picture) => res.status(201).json({ ok: true, picture }))
      .catch(next);
  },
);

admin.put(
  '/pictures/:id',
  (req, res, next) => {
    const parsed = pictureInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    updatePicture(req.params.id ?? '', parsed.data)
      .then((picture) => (picture ? res.json({ ok: true, picture }) : notFound(res, 'Picture')))
      .catch(next);
  },
);

admin.delete(
  '/pictures/:id',
  (req, res, next) => {
    deletePicture(req.params.id ?? '')
      .then(async (removed) => {
        if (!removed) return notFound(res, 'Picture');
        await removeUpload(removed.src);
        res.json({ ok: true, id: removed.id });
      })
      .catch(next);
  },
);

/* --------------------------------- projects ------------------------------- */

admin.post(
  '/projects',
  (req, res, next) => {
    const parsed = projectInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    addProject(parsed.data)
      .then((project) => res.status(201).json({ ok: true, project }))
      .catch(next);
  },
);

admin.put(
  '/projects/:id',
  (req, res, next) => {
    const parsed = projectInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    updateProject(req.params.id ?? '', parsed.data)
      .then((project) => (project ? res.json({ ok: true, project }) : notFound(res, 'Project')))
      .catch(next);
  },
);

admin.delete(
  '/projects/:id',
  (req, res, next) => {
    deleteProject(req.params.id ?? '')
      .then((removed) =>
        removed ? res.json({ ok: true, id: removed.id }) : notFound(res, 'Project'),
      )
      .catch(next);
  },
);

/* -------------------------------- activities ------------------------------ */

admin.post(
  '/activities',
  (req, res, next) => {
    const parsed = activityInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    addActivity(parsed.data)
      .then((activity) => res.status(201).json({ ok: true, activity }))
      .catch(next);
  },
);

admin.put(
  '/activities/:id',
  (req, res, next) => {
    const parsed = activityInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    updateActivity(req.params.id ?? '', parsed.data)
      .then((activity) =>
        activity ? res.json({ ok: true, activity }) : notFound(res, 'Activity'),
      )
      .catch(next);
  },
);

admin.delete(
  '/activities/:id',
  (req, res, next) => {
    deleteActivity(req.params.id ?? '')
      .then((removed) =>
        removed ? res.json({ ok: true, id: removed.id }) : notFound(res, 'Activity'),
      )
      .catch(next);
  },
);

/* --------------------------------- team ---------------------------------- */

admin.post(
  '/team',
  (req, res, next) => {
    const parsed = teamMemberInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    addTeamMember(parsed.data)
      .then((teamMember) => res.status(201).json({ ok: true, teamMember }))
      .catch(next);
  },
);

admin.put(
  '/team/:id',
  (req, res, next) => {
    const parsed = teamMemberInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    updateTeamMember(req.params.id ?? '', parsed.data)
      .then((teamMember) =>
        teamMember ? res.json({ ok: true, teamMember }) : notFound(res, 'Team member'),
      )
      .catch(next);
  },
);

admin.delete(
  '/team/:id',
  (req, res, next) => {
    deleteTeamMember(req.params.id ?? '')
      .then((removed) =>
        removed ? res.json({ ok: true, id: removed.id }) : notFound(res, 'Team member'),
      )
      .catch(next);
  },
);

/* ------------------------------ testimonials ----------------------------- */

admin.post(
  '/testimonials',
  (req, res, next) => {
    const parsed = testimonialInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    addTestimonial(parsed.data)
      .then((testimonial) => res.status(201).json({ ok: true, testimonial }))
      .catch(next);
  },
);

admin.put(
  '/testimonials/:id',
  (req, res, next) => {
    const parsed = testimonialInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    updateTestimonial(req.params.id ?? '', parsed.data)
      .then((testimonial) =>
        testimonial
          ? res.json({ ok: true, testimonial })
          : notFound(res, 'Testimonial'),
      )
      .catch(next);
  },
);

admin.delete(
  '/testimonials/:id',
  (req, res, next) => {
    deleteTestimonial(req.params.id ?? '')
      .then((removed) =>
        removed ? res.json({ ok: true, id: removed.id }) : notFound(res, 'Testimonial'),
      )
      .catch(next);
  },
);

/* -------------------------------- policies -------------------------------- */

admin.post(
  '/policies',
  (req, res, next) => {
    const parsed = policyInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    addPolicy(parsed.data)
      .then((policy) => res.status(201).json({ ok: true, policy }))
      .catch(next);
  },
);

admin.put(
  '/policies/:id',
  (req, res, next) => {
    const parsed = policyInputSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    updatePolicy(req.params.id ?? '', parsed.data)
      .then((policy) =>
        policy ? res.json({ ok: true, policy }) : notFound(res, 'Policy'),
      )
      .catch(next);
  },
);

admin.delete(
  '/policies/:id',
  (req, res, next) => {
    deletePolicy(req.params.id ?? '')
      .then(async (removed) => {
        if (!removed) return notFound(res, 'Policy');
        // The PDF is only reclaimed when it is one of ours. A policy that points
        // at a deck file under /assets is still referenced by the static content
        // module, so `removeUpload` ignores anything outside /uploads.
        await removeUpload(removed.file);
        res.json({ ok: true, id: removed.id });
      })
      .catch(next);
  },
);

/* -------------------------- programmes and impact ------------------------- */

admin.patch(
  '/programmes/:id',
  (req, res, next) => {
    const parsed = programmePatchSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    patchProgramme(req.params.id ?? '', parsed.data)
      .then((programmes) =>
        programmes ? res.json({ ok: true, programmes }) : notFound(res, 'Programme'),
      )
      .catch(next);
  },
);

admin.patch(
  '/impact',
  (req, res, next) => {
    const parsed = impactPatchSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    patchImpact(parsed.data)
      .then((impact) => res.json({ ok: true, impact }))
      .catch(next);
  },
);

/* ---------------------------------- errors -------------------------------- */

admin.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof LimitError) {
    fail(res, 409, 'validation_error', error.message);
    return;
  }
  if (error instanceof ContentValidationError) {
    // 422, not 409: nothing is in conflict, the request simply cannot be applied
    // as sent. The field name lets the dashboard point at the right input.
    res.status(422).json({
      ok: false,
      error: 'validation_error',
      message: error.message,
      fields: { [error.field]: error.message },
    } satisfies ApiError);
    return;
  }
  next(error);
});

export { sortByDateDesc };
