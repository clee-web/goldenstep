import {
  gallery,
  impact as staticImpact,
  programmes as staticProgrammes,
  type Programme,
} from '@shared/content';
import {
  isProgrammeId,
  programmeIds,
  type ImpactPatch,
  type ManagedActivity,
  type ManagedContent,
  type ManagedPicture,
  type ManagedPolicy,
  type ManagedProject,
  type ManagedTeamMember,
  type ManagedTestimonial,
  type ProgrammeOverrides,
} from '@shared/schemas';

export interface GallerySlide {
  id: string;
  image: string;
  alt: string;
  tag: string;
  caption: string;
  /** Stills render as `<img>`; video slides render a native player. */
  kind: 'image' | 'video';
  /** Still frame shown before a video plays. Empty for image slides. */
  poster: string;
  /**
   * WebVTT track. Required by the schema for video entries (WCAG 1.2.2), so a
   * populated `kind: 'video'` slide is guaranteed to have one.
   */
  captionsSrc: string;
}

/**
 * Classifies a gallery entry by its file extension.
 *
 * Derived rather than stored, so a picture created in the dashboard, seeded in
 * `content.json` or posted straight to the API is always rendered the same way,
 * and there is no flag that can disagree with the file it points at. Query
 * strings and fragments are stripped first, since a CDN URL commonly carries
 * both.
 */
const VIDEO_EXTENSION = /\.(mp4|webm|m4v)$/i;

export const mediaKindOf = (src: string): 'image' | 'video' => {
  const path = src.split(/[?#]/)[0];
  return VIDEO_EXTENSION.test(path) ? 'video' : 'image';
};

export interface FieldProject extends ManagedProject {
  /** Resolved display name for `programme`, never a raw id. */
  programmeName: string;
}

export interface ImpactMetrics {
  id: string;
  label: string;
  value: number;
}

/**
 * Applies admin overrides to the static programme list.
 *
 * Overrides are sparse by design, so each field falls back to the static value.
 * Programme order, ids and numbers are never overridable: they are structural
 * and drive the chapter numbering, the rail and the gallery.
 */
export function mergeProgrammes(overrides: ProgrammeOverrides = {}): Programme[] {
  return staticProgrammes.map((programme) => {
    const patch = overrides[programme.id];
    if (!patch) return programme;
    return {
      ...programme,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.highlights !== undefined ? { highlights: patch.highlights } : {}),
      ...(patch.beneficiaries !== undefined ? { beneficiaries: patch.beneficiaries } : {}),
      ...(patch.image !== undefined ? { image: patch.image } : {}),
      ...(patch.imageAlt !== undefined ? { imageAlt: patch.imageAlt } : {}),
      ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
    };
  });
}

/**
 * The gallery always includes the six programme photographs, because those are
 * what the story is built on. Admin uploads are added on top, so a new photo
 * extends the deck rather than replacing the narrative defaults.
 */
export function mergeGallerySlides(
  programmes: Programme[],
  pictures: ManagedPicture[] = [],
): GallerySlide[] {
  const programmeSlides: GallerySlide[] = programmes.map((programme) => ({
    id: `programme-${programme.id}`,
    image: programme.image,
    alt: programme.imageAlt,
    tag: programme.name,
    caption: programme.caption,
    kind: mediaKindOf(programme.image),
    poster: '',
    captionsSrc: '',
  }));

  const managedSlides: GallerySlide[] = pictures.map((picture) => ({
    id: picture.id,
    image: picture.src,
    alt: picture.alt,
    tag: picture.tag,
    caption: picture.caption,
    kind: mediaKindOf(picture.src),
    poster: picture.poster ?? '',
    captionsSrc: picture.captionsSrc ?? '',
  }));

  return [...programmeSlides, ...managedSlides];
}

const programmeNames = new Map<string, string>(
  staticProgrammes.map((programme) => [programme.id, programme.name]),
);

/** Falls back to a readable label rather than leaking a raw id to readers. */
const resolveProgrammeName = (id: string): string =>
  programmeNames.get(id) ?? 'Community programme';

export function resolveFieldProjects(projects: ManagedProject[] = []): FieldProject[] {
  return projects.map((project) => ({
    ...project,
    programmeName: resolveProgrammeName(project.programme),
  }));
}

export interface ImpactCopy {
  /** Static-only: the headline wording is part of the narrative design. */
  eyebrow: string;
  title: string;
  titleAccent: string;
  titleAccentLine2: string;
  lead: string;
  totalLabel: string;
  totalCaption: string;
  metrics: ImpactMetrics[];
}

export function mergeImpact(
  programmes: Programme[],
  patch: ImpactPatch = {},
): ImpactCopy {
  return {
    eyebrow: staticImpact.eyebrow,
    title: staticImpact.title,
    titleAccent: staticImpact.titleAccent,
    titleAccentLine2: staticImpact.titleAccentLine2,
    lead: patch.lead ?? staticImpact.lead,
    totalLabel: patch.totalLabel ?? staticImpact.totalLabel,
    totalCaption: patch.totalCaption ?? staticImpact.totalCaption,
    metrics: programmes.map((programme) => ({
      id: programme.id,
      label: programme.name === 'Gender & GBV Prevention' ? 'Gender' : programme.name,
      value: programme.beneficiaries,
    })),
  };
}

/** Sum of the merged per-programme figures, so the headline can never drift. */
export const totalBeneficiariesFrom = (programmes: Programme[]): number =>
  programmes.reduce((total, programme) => total + programme.beneficiaries, 0);

export interface ResolvedSiteContent {
  programmes: Programme[];
  gallerySlides: GallerySlide[];
  projects: FieldProject[];
  activities: ManagedActivity[];
  teamMembers: ManagedTeamMember[];
  testimonials: ManagedTestimonial[];
  policies: ManagedPolicy[];
  impact: ImpactCopy;
  totalBeneficiaries: number;
  /** True once the overlay has loaded, whatever the outcome. */
  ready: boolean;
  /** True when the overlay request failed and static content is being shown. */
  offline: boolean;
}

export function resolveSiteContent(
  content: ManagedContent,
  { ready = true, offline = false }: { ready?: boolean; offline?: boolean } = {},
): ResolvedSiteContent {
  const programmes = mergeProgrammes(content.programmes);

  return {
    programmes,
    gallerySlides: mergeGallerySlides(programmes, content.pictures),
    // Newest first, matching the order the API returns.
    projects: resolveFieldProjects(
      [...content.projects].sort((a, b) => b.date.localeCompare(a.date)),
    ),
    activities: [...content.activities].sort((a, b) => b.date.localeCompare(a.date)),
    // Sort by order field, then by creation date
    teamMembers: [...content.teamMembers].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt.localeCompare(b.createdAt);
    }),
    // Sort by order field, then by creation date
    testimonials: [...content.testimonials].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt.localeCompare(b.createdAt);
    }),
    // A policy set has a deliberate reading order rather than a date order, so it
    // sorts by the operator's `order` and falls back to upload time.
    policies: [...content.policies].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt.localeCompare(b.createdAt);
    }),
    impact: mergeImpact(programmes, content.impact),
    totalBeneficiaries: totalBeneficiariesFrom(programmes),
    ready,
    offline,
  };
}

/** Exposed for the dashboard, which needs the canonical order. */
export const canonicalProgrammeIds = programmeIds;

/** Re-exported so components need not import from two places. */
export { gallery, isProgrammeId };
