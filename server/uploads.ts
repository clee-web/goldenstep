import { randomUUID } from 'node:crypto';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import multer from 'multer';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { ApiError } from '../shared/schemas.ts';
import { MAX_DOCUMENT_BYTES, MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES, UPLOADS_DIR } from './paths.ts';

/**
 * Only formats a browser can open are accepted.
 *
 * SVG is deliberately excluded: it is a scriptable document, so serving one from
 * the site's own origin would be a stored-XSS vector even with a correct
 * Content-Type.
 *
 * Video is limited to the two codecs every current browser plays natively. There
 * is no transcode step in this project, so accepting more formats here would only
 * produce uploads that render as a black box for someone.
 */
const IMAGES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  /*
   * WebVTT caption tracks. Browsers accept no other subtitle format, so
   * accepting .srt would only produce files the `<track>` element ignores.
   */
  'text/vtt': '.vtt',
};

const VIDEOS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

/**
 * Policy documents.
 *
 * PDF is the only document format accepted, which is a deliberate narrowing
 * rather than a gap: every current browser and phone can open one, and PDF is
 * what these documents are actually published as. The alternative formats that
 * a browser would also open — `.docx`, `.odt` — are not, and a document type the
 * reader cannot open is worse than no document.
 */
const DOCUMENTS: Record<string, string> = {
  'application/pdf': '.pdf',
};

const ALLOWED: Record<string, string> = { ...IMAGES, ...VIDEOS, ...DOCUMENTS };

export const allowedUploadTypes = Object.keys(ALLOWED);
export const allowedVideoTypes = Object.keys(VIDEOS);

export const isVideoMime = (mimetype: string): boolean => mimetype in VIDEOS;

export const isDocumentMime = (mimetype: string): boolean => mimetype in DOCUMENTS;

/** The element or handler the uploaded file becomes, for the client. */
export type UploadKind = 'image' | 'video' | 'document';

export const uploadKindFor = (mimetype: string | undefined): UploadKind => {
  if (mimetype && isVideoMime(mimetype)) return 'video';
  if (mimetype && isDocumentMime(mimetype)) return 'document';
  return 'image';
};

/**
 * Videos need the most room, policy documents next, images least. Split per kind
 * so an image upload cannot use the video allowance to push 100MB of padding
 * through the form.
 */
export const byteLimitFor = (mimetype: string | undefined): number => {
  if (mimetype && isVideoMime(mimetype)) return MAX_VIDEO_BYTES;
  if (mimetype && isDocumentMime(mimetype)) return MAX_DOCUMENT_BYTES;
  return MAX_UPLOAD_BYTES;
};

/**
 * Plural noun for the kind of file, so an oversize report tells the operator
 * which limit they actually hit rather than the shared ceiling multer stopped at.
 */
const limitKindLabel = (mimetype: string | undefined): string => {
  if (mimetype && isVideoMime(mimetype)) return 'Videos';
  if (mimetype && isDocumentMime(mimetype)) return 'Documents';
  return 'Images';
};

interface RequestWithUploadMime extends Request {
  /**
   * The validated MIME type, stashed by `fileFilter`.
   *
   * multer only assigns `req.file` once the stream finishes, so when the size
   * limit trips there is no `req.file` to read the type from — and the handler
   * has to report an image limit or a video limit. The filter is the only place
   * that sees the type while it is still known.
   */
  uploadMime?: string;
}

/** The MIME type accepted for this request, if the filter has already run. */
const mimeFor = (req: Request): string | undefined =>
  (req as RequestWithUploadMime).uploadMime ?? req.file?.mimetype;

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    mkdir(UPLOADS_DIR, { recursive: true })
      .then(() => callback(null, UPLOADS_DIR))
      .catch((error: Error) => callback(error, UPLOADS_DIR));
  },
  filename(_req, file, callback) {
    // The client-supplied name is never used for the path: it is attacker
    // controlled and could contain separators or a traversal sequence. The
    // extension is derived from the validated MIME type instead.
    const extension = ALLOWED[file.mimetype] ?? '';
    callback(null, `${Date.now().toString(36)}-${randomUUID()}${extension}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: {
    /*
     * The ceiling, not the image allowance. multer takes one size limit and the
     * MIME type is only known after `fileFilter` runs, so the per-kind check has
     * to happen afterwards — see `enforceMediaLimit`.
     */
    fileSize: MAX_VIDEO_BYTES,
    files: 1,
    fields: 20,
  },
  fileFilter(req, file, callback) {
    if (file.mimetype in ALLOWED) {
      (req as RequestWithUploadMime).uploadMime = file.mimetype;
      callback(null, true);
      return;
    }
    const error = new Error(
      `Unsupported media type. Allowed: ${allowedUploadTypes.join(', ')}.`,
    ) as Error & { code?: string };
    error.code = 'UNSUPPORTED_MEDIA_TYPE';
    callback(error);
  },
}).single('image');

/**
 * Enforces the per-kind ceiling that multer's single `fileSize` limit cannot.
 *
 * Runs after the upload has landed, so it also removes the file it rejects —
 * otherwise an oversized upload would stay on disk with no record pointing at
 * it, which is exactly the state `removeAllUploads` exists to sweep up.
 */
export const enforceMediaLimit: RequestHandler = (req, res, next) => {
  const file = req.file;
  if (!file) {
    next();
    return;
  }

  const limit = byteLimitFor(file.mimetype);
  if (file.size <= limit) {
    next();
    return;
  }

  void unlink(file.path).catch(() => undefined);
  const kind = limitKindLabel(file.mimetype);
  const body: ApiError = {
    ok: false,
    error: 'payload_too_large',
    message: `${kind} must be ${Math.round(limit / (1024 * 1024))}MB or smaller.`,
  };
  res.status(413).json(body);
};

/** Public path for a stored upload, derived from the generated filename. */
export const publicPathFor = (filename: string): string => `/uploads/${path.basename(filename)}`;

/**
 * Removes the file behind a managed record — a gallery picture or a policy
 * document — if we own it. Seeded deck images live in /assets and are still
 * referenced by the static content module, so only generated uploads are ever
 * deleted.
 */
export async function removeUpload(src: string): Promise<void> {
  if (!src.startsWith('/uploads/')) return;
  await unlink(path.join(UPLOADS_DIR, path.basename(src))).catch(() => undefined);
}

/**
 * Deletes every file in the uploads directory. Used when managed content is
 * reset: the records disappear, so leaving the files behind would strand disk
 * that nothing can reference or reclaim.
 */
export async function removeAllUploads(): Promise<number> {
  const entries = await readdir(UPLOADS_DIR).catch(() => [] as string[]);
  let removed = 0;
  for (const entry of entries) {
    try {
      await unlink(path.join(UPLOADS_DIR, entry));
      removed += 1;
    } catch {
      // A file we cannot delete is not a reason to fail the reset; the record
      // is gone either way and the directory is swept on the next reset.
    }
  }
  return removed;
}

/**
 * Translates multer's errors into the shared API error shape. Without this a
 * too-large upload surfaces as an opaque 500.
 *
 * Registered as the final handler in the `/uploads` route, so Express gives it
 * only the errors that route produces.
 */
export function uploadErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!(error instanceof Error)) {
    next(error);
    return;
  }

  const code = (error as Error & { code?: string }).code;
  if (code === 'LIMIT_FILE_SIZE') {
    /*
     * multer stopped the stream at the shared ceiling, so only part of the file
     * is on disk and nothing will ever reference it. Report the limit for that
     * file's kind rather than the ceiling that actually tripped, or an image
     * uploader is told videos are capped at 100MB.
     *
     * Unlinked by disk path, not via `removeUpload`, which takes the public
     * `/uploads/...` form rather than the filename on disk.
     */
    const partial = req.file?.path;
    if (partial) void unlink(partial).catch(() => undefined);
    const mime = mimeFor(req);
    const limit = byteLimitFor(mime);
    const kind = limitKindLabel(mime);
    const body: ApiError = {
      ok: false,
      error: 'payload_too_large',
      message: `${kind} must be ${Math.round(limit / (1024 * 1024))}MB or smaller.`,
    };
    res.status(413).json(body);
    return;
  }

  if (code === 'UNSUPPORTED_MEDIA_TYPE' || code === 'LIMIT_UNEXPECTED_FILE') {
    const body: ApiError = {
      ok: false,
      error: 'unsupported_media_type',
      message: error.message,
    };
    res.status(415).json(body);
    return;
  }

  next(error);
}
