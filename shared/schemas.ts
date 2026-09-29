import { z } from 'zod';

export const enquiryTopics = [
  'Partnership',
  'Funding / donor support',
  'Community programme',
  'Volunteering',
  'General enquiry',
] as const;

/**
 * Canonical programme identifiers. Declared here rather than in `content.ts` so
 * the validation schemas can reference them without importing the content
 * module, and `ProgrammeId` derives from this list so the two cannot drift.
 */
export const programmeIds = [
  'gender',
  'health',
  'child',
  'economic',
  'justice',
  'climate',
] as const;

/** Derived so the id type can never drift from the validation list. */
export type ProgrammeId = (typeof programmeIds)[number];

export const enquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name.')
    .max(80, 'Name must be 80 characters or fewer.'),
  email: z.email('Please enter a valid email address.').max(160).toLowerCase(),
  organisation: z.string().trim().max(120).optional().default(''),
  topic: z.enum(enquiryTopics, { error: 'Please choose a topic.' }),
  message: z
    .string()
    .trim()
    .min(10, 'Please tell us a little more (at least 10 characters).')
    .max(2000, 'Message must be 2000 characters or fewer.'),
  /** Honeypot: real users never fill this in. */
  website: z.string().max(0).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

const programmeIdSet = new Set<string>(programmeIds);

/** Type guard for programme ids, safe to use on untrusted strings. */
export const isProgrammeId = (value: string): value is ProgrammeId =>
  programmeIdSet.has(value);

export interface EnquiryRecord extends EnquiryInput {
  id: string;
  receivedAt: string;
}

export interface EnquiryResponse {
  ok: true;
  id: string;
  receivedAt: string;
}

export interface ApiError {
  ok: false;
  error:
    | 'validation_error'
    | 'rate_limited'
    | 'not_found'
    | 'server_error'
    | 'unauthorized'
    | 'payload_too_large'
    | 'unsupported_media_type';
  message: string;
  fields?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* Admin-managed content                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Image sources are restricted to same-origin paths or https URLs. Without this
 * an admin (or anyone who reaches the form) could store `javascript:` in an
 * `img src`, which some browsers will still evaluate.
 */
const imageSrcSchema = z
  .string()
  .trim()
  .min(1, 'Choose an image or paste a URL.')
  .max(500, 'Image path must be 500 characters or fewer.')
  .refine(
    (value) =>
      /^\/(uploads|assets)\//.test(value) || /^https:\/\/[^\s]+$/.test(value),
    'Image must be an uploaded file, a path under /assets, or an https URL.',
  );

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');

/**
 * A date the operator may leave blank.
 *
 * Used where the date is a useful fact rather than a required attribute — a
 * policy's adoption or review date, which a small organisation may genuinely not
 * have recorded. An empty string means "not published", not "the epoch".
 */
const optionalIsoDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Use the format YYYY-MM-DD, or leave it blank.',
  );

/**
 * Optional variant used by projects, activities and programme patches, where an
 * empty string means "no image". Non-empty values get the same treatment as a
 * gallery picture, so an arbitrary URL cannot be smuggled in through a field
 * that only checked the length.
 */
const optionalImageSrcSchema = z
  .string()
  .trim()
  .max(500, 'Image path must be 500 characters or fewer.')
  .refine(
    (value) =>
      value === '' ||
      /^\/(uploads|assets)\//.test(value) ||
      /^https:\/\/[^\s]+$/.test(value),
    'Image must be an uploaded file, a path under /assets, or an https URL.',
  );

const titleField = (label: string) =>
  z.string().trim().min(2, `${label} must be at least 2 characters.`).max(160, `${label} must be 160 characters or fewer.`);

/**
 * An image without alt text is invisible to screen readers, so the two are tied
 * together rather than trusted to the operator. Matches the site's zero-known-
 * violations accessibility target.
 */
const hasAltTextForImage = <T extends { image?: string; imageAlt?: string }>(
  value: T,
  ctx: z.RefinementCtx,
): void => {
  if (value.image && !(value.imageAlt && value.imageAlt.trim().length >= 3)) {
    ctx.addIssue({
      code: 'custom',
      path: ['imageAlt'],
      message: 'Describe the image for screen readers.',
    });
  }
};

/**
 * WebVTT caption tracks.
 *
 * A gallery video with speech and no captions fails WCAG 1.2.2 (Captions,
 * Prerecorded), which is the same 1.2.x requirement that makes the image/alt
 * pairing non-negotiable below. Rather than trusting the operator to remember,
 * `pictureInputSchema` refuses a video that has no captions track.
 */
const captionsSrcSchema = z
  .string()
  .trim()
  .max(500, 'Captions path must be 500 characters or fewer.')
  .refine(
    (value) =>
      value === '' ||
      /^\/(uploads|assets)\/\S+\.vtt$/i.test(value) ||
      /^https:\/\/\S+\.vtt(\?\S*)?$/i.test(value),
    'Captions must be an uploaded .vtt file, a path under /assets, or an https URL.',
  );

/** Mirrors the client's `mediaKindOf`, so the two cannot disagree about a file. */
const isVideoSource = (src: string): boolean =>
  /\.(mp4|webm|m4v)$/i.test(src.split(/[?#]/)[0]);

/**
 * A gallery entry. `src` points at `/uploads/...` or `/assets/...`.
 *
 * `src` may be a video (`/uploads/x.mp4`); the gallery derives the element to
 * render from the extension rather than storing a `kind` flag, so a picture
 * added through any route — dashboard, seed file or API — is classified the
 * same way and the two cannot disagree.
 *
 * `poster` is the still shown before a video plays. Without one the browser
 * paints a black rectangle and a reduced-motion visitor, who will not get
 * autoplay, has nothing to look at.
 */
export const pictureInputSchema = z
  .object({
    src: imageSrcSchema,
    alt: z
      .string()
      .trim()
      .min(3, 'Describe the image for screen readers.')
      .max(200, 'Alt text must be 200 characters or fewer.'),
    tag: z.string().trim().min(2, 'Give the picture a short label.').max(60),
    caption: z.string().trim().min(3).max(240),
    poster: optionalImageSrcSchema.optional().default(''),
    captionsSrc: captionsSrcSchema.optional().default(''),
  })
  .superRefine((value, ctx) => {
    if (!isVideoSource(value.src)) return;
    if (value.captionsSrc) return;
    ctx.addIssue({
      code: 'custom',
      path: ['captionsSrc'],
      message:
        'A video needs a captions track. Upload a .vtt file and reference it here.',
    });
  });

export const projectInputSchema = z
  .object({
    title: titleField('Title'),
    summary: z
      .string()
      .trim()
      .min(10, 'Summary must be at least 10 characters.')
      .max(400, 'Summary must be 400 characters or fewer.'),
    programme: z.enum(programmeIds, { error: 'Choose a programme area.' }),
    status: z.enum(['Planned', 'In progress', 'Completed'], {
      error: 'Choose a status.',
    }),
    date: isoDateSchema,
    location: z.string().trim().max(120).optional().default(''),
    image: optionalImageSrcSchema.optional().default(''),
    imageAlt: z.string().trim().max(200).optional().default(''),
  })
  .superRefine(hasAltTextForImage);

export const activityInputSchema = z
  .object({
    title: titleField('Title'),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters.')
      .max(400, 'Description must be 400 characters or fewer.'),
    kind: z.enum(['Outreach', 'Training', 'Partnership', 'Milestone'], {
      error: 'Choose an activity type.',
    }),
    date: isoDateSchema,
    image: optionalImageSrcSchema.optional().default(''),
    imageAlt: z.string().trim().max(200).optional().default(''),
  })
  .superRefine(hasAltTextForImage);

export const teamMemberInputSchema = z
  .object({
    name: titleField('Name'),
    role: z
      .string()
      .trim()
      .min(2, 'Role must be at least 2 characters.')
      .max(120, 'Role must be 120 characters or fewer.'),
    bio: z
      .string()
      .trim()
      .min(10, 'Bio must be at least 10 characters.')
      .max(500, 'Bio must be 500 characters or fewer.'),
    image: optionalImageSrcSchema.optional().default(''),
    imageAlt: z.string().trim().max(200).optional().default(''),
    email: z.string().trim().email('Please enter a valid email address.').max(160).optional().default(''),
    order: z.number().int().min(0).max(100).optional().default(0),
  })
  .superRefine(hasAltTextForImage);

export const testimonialInputSchema = z
  .object({
    name: titleField('Name'),
    role: z
      .string()
      .trim()
      .min(2, 'Role must be at least 2 characters.')
      .max(120, 'Role must be 120 characters or fewer.'),
    testimonial: z
      .string()
      .trim()
      .min(10, 'Testimonial must be at least 10 characters.')
      .max(800, 'Testimonial must be 800 characters or fewer.'),
    image: optionalImageSrcSchema.optional().default(''),
    imageAlt: z.string().trim().max(200).optional().default(''),
    order: z.number().int().min(0).max(100).optional().default(0),
  })
  .superRefine(hasAltTextForImage);

/**
 * A downloadable policy document. PDF only, and the extension is part of the
 * rule rather than a naming convention.
 *
 * The server serves `/uploads` with `Content-Disposition: attachment` for PDFs
 * so they download instead of rendering inside the site's own origin, where a
 * PDF's embedded script would run same-origin. That contract only holds if the
 * file really is a PDF, which is why a `.html` or `.svg` path cannot be stored
 * here even though both would open without complaint in a browser.
 */
const pdfSrcSchema = z
  .string()
  .trim()
  .min(1, 'Upload the policy document as a PDF.')
  .max(500, 'File path must be 500 characters or fewer.')
  .refine(
    (value) =>
      /^\/(uploads|assets)\/\S+\.pdf$/i.test(value) ||
      /^https:\/\/\S+\.pdf(\?\S*)?$/i.test(value),
    'Policy documents must be a PDF: an /uploads or /assets path ending in .pdf, or an https URL to one.',
  );

export const policyInputSchema = z.object({
  title: titleField('Title'),
  /**
   * One line on what the document commits to. Free text rather than a fixed
   * category list: a grassroots organisation's policy set is its own, and a
   * closed list would make the common case — a document that fits none of the
   * offered labels — unpublishable.
   */
  category: z
    .string()
    .trim()
    .max(60, 'Category must be 60 characters or fewer.')
    .optional()
    .default(''),
  summary: z
    .string()
    .trim()
    .max(300, 'Summary must be 300 characters or fewer.')
    .optional()
    .default(''),
  file: pdfSrcSchema,
  /** Adoption or last-review date. Blank when it has not been recorded. */
  date: optionalIsoDateSchema.optional().default(''),
  /**
   * Byte size, shown next to the download link so a reader knows what they are
   * committing to before they click. Purely cosmetic and supplied by the client
   * from the upload response, so it is display data only and never trusted for
   * anything.
   */
  bytes: z.number().int().min(0).optional().default(0),
  order: z.number().int().min(0).max(100).optional().default(0),
});

/**
 * Programme edits are sparse on purpose: a form that submits every field would
 * blank out anything it did not load, and the dashboard must stay safe to edit
 * one field at a time.
 */
export const programmePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    summary: z.string().trim().min(2).max(300).optional(),
    description: z.string().trim().min(2).max(1200).optional(),
    icon: z.string().trim().min(1).max(8).optional(),
    highlights: z.array(z.string().trim().min(2).max(160)).max(6).optional(),
    beneficiaries: z.number().int().min(0).max(100_000_000).optional(),
    image: optionalImageSrcSchema.optional(),
    imageAlt: z.string().trim().max(200).optional(),
    caption: z.string().trim().max(240).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update.',
  });
  // NOTE: the image/alt-text pairing is deliberately NOT checked here. This is a
  // sparse patch, so it cannot see the alt text the programme already carries.
  // Enforcing it on the patch would reject a legitimate image swap. The
  // invariant is enforced against the *merged* programme in `patchProgramme`.

export const impactPatchSchema = z
  .object({
    lead: z.string().trim().min(10).max(400).optional(),
    totalLabel: z.string().trim().min(2).max(120).optional(),
    totalCaption: z.string().trim().min(2).max(120).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update.',
  });

export const loginSchema = z.object({
  password: z.string().min(1, 'Enter the admin password.').max(200),
});

export type PictureInput = z.infer<typeof pictureInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberInputSchema>;
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;
export type PolicyInput = z.infer<typeof policyInputSchema>;
export type ProgrammePatch = z.infer<typeof programmePatchSchema>;
export type ImpactPatch = z.infer<typeof impactPatchSchema>;

export interface ManagedPicture extends PictureInput {
  id: string;
  createdAt: string;
}

export interface ManagedProject extends ProjectInput {
  id: string;
  createdAt: string;
}

export interface ManagedActivity extends ActivityInput {
  id: string;
  createdAt: string;
}

export interface ManagedTeamMember extends TeamMemberInput {
  id: string;
  createdAt: string;
}

export interface ManagedTestimonial extends TestimonialInput {
  id: string;
  createdAt: string;
}

export interface ManagedPolicy extends PolicyInput {
  id: string;
  createdAt: string;
}

export type ProgrammeOverrides = Record<string, ProgrammePatch>;

/** Everything the dashboard owns. Absent keys simply mean "use the deck value". */
export interface ManagedContent {
  pictures: ManagedPicture[];
  projects: ManagedProject[];
  activities: ManagedActivity[];
  teamMembers: ManagedTeamMember[];
  testimonials: ManagedTestimonial[];
  policies: ManagedPolicy[];
  programmes: ProgrammeOverrides;
  impact: ImpactPatch;
}

export const emptyManagedContent = (): ManagedContent => ({
  pictures: [],
  projects: [],
  activities: [],
  teamMembers: [],
  testimonials: [],
  policies: [],
  programmes: {},
  impact: {},
});

export interface ContentResponse {
  ok: true;
  content: ManagedContent;
}
