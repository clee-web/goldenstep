import { randomUUID } from 'node:crypto';

import { programmes as staticProgrammes } from '../shared/content.ts';
import {
  activityInputSchema,
  emptyManagedContent,
  impactPatchSchema,
  isProgrammeId,
  pictureInputSchema,
  policyInputSchema,
  programmePatchSchema,
  projectInputSchema,
  teamMemberInputSchema,
  testimonialInputSchema,
  type ActivityInput,
  type ImpactPatch,
  type ManagedActivity,
  type ManagedContent,
  type ManagedPicture,
  type ManagedPolicy,
  type ManagedProject,
  type ManagedTeamMember,
  type ManagedTestimonial,
  type PictureInput,
  type PolicyInput,
  type ProgrammeOverrides,
  type ProjectInput,
  type TeamMemberInput,
  type TestimonialInput,
} from '../shared/schemas.ts';
import { JsonFile } from './json-file.ts';
import { CONTENT_FILE } from './paths.ts';

export const LIMITS = {
  pictures: 200,
  projects: 100,
  activities: 200,
  teamMembers: 50,
  testimonials: 60,
  policies: 60,
} as const;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Rebuilds managed content from whatever is on disk, re-validating every record
 * and silently dropping the ones that no longer parse.
 *
 * This matters because the file is hand-editable and survives deploys. A record
 * that fails validation should cost you that one picture, not the whole
 * dashboard — and it must never be able to smuggle a bad `src` past the
 * validator, since the file bypasses the request-time schemas entirely.
 */
function revive(raw: unknown): ManagedContent {
  if (!isRecord(raw)) return emptyManagedContent();

  const pictures: ManagedPicture[] = [];
  for (const item of asArray(raw.pictures)) {
    if (!isRecord(item)) continue;
    const parsed = pictureInputSchema.safeParse(item);
    if (!parsed.success) continue;
    pictures.push({
      ...parsed.data,
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }

  const projects: ManagedProject[] = [];
  for (const item of asArray(raw.projects)) {
    if (!isRecord(item)) continue;
    const parsed = projectInputSchema.safeParse(item);
    if (!parsed.success) continue;
    projects.push({
      ...parsed.data,
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }

  const activities: ManagedActivity[] = [];
  for (const item of asArray(raw.activities)) {
    if (!isRecord(item)) continue;
    const parsed = activityInputSchema.safeParse(item);
    if (!parsed.success) continue;
    activities.push({
      ...parsed.data,
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }

  const teamMembers: ManagedTeamMember[] = [];
  for (const item of asArray(raw.teamMembers)) {
    if (!isRecord(item)) continue;
    const parsed = teamMemberInputSchema.safeParse(item);
    if (!parsed.success) continue;
    teamMembers.push({
      ...parsed.data,
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }

  const testimonials: ManagedTestimonial[] = [];
  for (const item of asArray(raw.testimonials)) {
    if (!isRecord(item)) continue;
    const parsed = testimonialInputSchema.safeParse(item);
    if (!parsed.success) continue;
    testimonials.push({
      ...parsed.data,
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }

  const policies: ManagedPolicy[] = [];
  for (const item of asArray(raw.policies)) {
    if (!isRecord(item)) continue;
    const parsed = policyInputSchema.safeParse(item);
    if (!parsed.success) continue;
    policies.push({
      ...parsed.data,
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    });
  }

  const programmes: ProgrammeOverrides = {};
  if (isRecord(raw.programmes)) {
    for (const [key, value] of Object.entries(raw.programmes)) {
      // Only known ids and well-formed patches survive, so a typo in the
      // hand-editable file cannot inject an unknown key into the rendered page.
      if (!isProgrammeId(key)) continue;
      const parsed = programmePatchSchema.safeParse(value);
      if (parsed.success) programmes[key] = parsed.data;
    }
  }

  const impactParsed = impactPatchSchema.safeParse(raw.impact ?? {});
  const impact: ImpactPatch = impactParsed.success ? impactParsed.data : {};

  return {
    pictures,
    projects,
    activities,
    teamMembers,
    testimonials,
    policies,
    programmes,
    impact,
  };
}

const file = new JsonFile<ManagedContent>(
  CONTENT_FILE,
  emptyManagedContent,
  revive,
);

export const readManagedContent = (): Promise<ManagedContent> => file.read();

const byNewest = <T extends { createdAt: string }>(a: T, b: T): number =>
  b.createdAt.localeCompare(a.createdAt);

/* ------------------------------- pictures -------------------------------- */

export function addPicture(input: PictureInput): Promise<ManagedPicture> {
  return file.update((content) => {
    if (content.pictures.length >= LIMITS.pictures) {
      throw new LimitError(`Picture limit of ${LIMITS.pictures} reached.`);
    }
    const picture: ManagedPicture = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.pictures.push(picture);
    return picture;
  });
}

export function updatePicture(
  id: string,
  input: PictureInput,
): Promise<ManagedPicture | null> {
  return file.update((content) => {
    const index = content.pictures.findIndex((picture) => picture.id === id);
    if (index === -1) return null;
    const existing = content.pictures[index];
    if (!existing) return null;
    const updated: ManagedPicture = { ...existing, ...input };
    content.pictures[index] = updated;
    return updated;
  });
}

export function deletePicture(id: string): Promise<ManagedPicture | null> {
  return file.update((content) => {
    const index = content.pictures.findIndex((picture) => picture.id === id);
    // Guard before splicing: `splice(-1, 1)` would silently delete the last
    // record, so a stale id from the dashboard could destroy unrelated data.
    if (index === -1) return null;
    const [removed] = content.pictures.splice(index, 1);
    return removed ?? null;
  });
}

/* -------------------------------- projects ------------------------------- */

export function addProject(input: ProjectInput): Promise<ManagedProject> {
  return file.update((content) => {
    if (content.projects.length >= LIMITS.projects) {
      throw new LimitError(`Project limit of ${LIMITS.projects} reached.`);
    }
    const project: ManagedProject = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.projects.push(project);
    return project;
  });
}

export function updateProject(
  id: string,
  input: ProjectInput,
): Promise<ManagedProject | null> {
  return file.update((content) => {
    const index = content.projects.findIndex((project) => project.id === id);
    if (index === -1) return null;
    const existing = content.projects[index];
    if (!existing) return null;
    const updated: ManagedProject = { ...existing, ...input };
    content.projects[index] = updated;
    return updated;
  });
}

export function deleteProject(id: string): Promise<ManagedProject | null> {
  return file.update((content) => {
    const index = content.projects.findIndex((project) => project.id === id);
    if (index === -1) return null;
    const [removed] = content.projects.splice(index, 1);
    return removed ?? null;
  });
}

/* ------------------------------- activities ------------------------------ */

export function addActivity(input: ActivityInput): Promise<ManagedActivity> {
  return file.update((content) => {
    if (content.activities.length >= LIMITS.activities) {
      throw new LimitError(`Activity limit of ${LIMITS.activities} reached.`);
    }
    const activity: ManagedActivity = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.activities.push(activity);
    return activity;
  });
}

export function updateActivity(
  id: string,
  input: ActivityInput,
): Promise<ManagedActivity | null> {
  return file.update((content) => {
    const index = content.activities.findIndex((activity) => activity.id === id);
    if (index === -1) return null;
    const existing = content.activities[index];
    if (!existing) return null;
    const updated: ManagedActivity = { ...existing, ...input };
    content.activities[index] = updated;
    return updated;
  });
}

export function deleteActivity(id: string): Promise<ManagedActivity | null> {
  return file.update((content) => {
    const index = content.activities.findIndex((activity) => activity.id === id);
    if (index === -1) return null;
    const [removed] = content.activities.splice(index, 1);
    return removed ?? null;
  });
}

/* --------------------------------- team ---------------------------------- */

export function addTeamMember(input: TeamMemberInput): Promise<ManagedTeamMember> {
  return file.update((content) => {
    if (content.teamMembers.length >= LIMITS.teamMembers) {
      throw new LimitError(`Team member limit of ${LIMITS.teamMembers} reached.`);
    }
    const teamMember: ManagedTeamMember = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.teamMembers.push(teamMember);
    return teamMember;
  });
}

export function updateTeamMember(
  id: string,
  input: TeamMemberInput,
): Promise<ManagedTeamMember | null> {
  return file.update((content) => {
    const index = content.teamMembers.findIndex((member) => member.id === id);
    if (index === -1) return null;
    const existing = content.teamMembers[index];
    if (!existing) return null;
    const updated: ManagedTeamMember = { ...existing, ...input };
    content.teamMembers[index] = updated;
    return updated;
  });
}

export function deleteTeamMember(id: string): Promise<ManagedTeamMember | null> {
  return file.update((content) => {
    const index = content.teamMembers.findIndex((member) => member.id === id);
    if (index === -1) return null;
    const [removed] = content.teamMembers.splice(index, 1);
    return removed ?? null;
  });
}

/* ----------------------------- testimonials ------------------------------ */

export function addTestimonial(input: TestimonialInput): Promise<ManagedTestimonial> {
  return file.update((content) => {
    if (content.testimonials.length >= LIMITS.testimonials) {
      throw new LimitError(`Testimonial limit of ${LIMITS.testimonials} reached.`);
    }
    const testimonial: ManagedTestimonial = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.testimonials.push(testimonial);
    return testimonial;
  });
}

export function updateTestimonial(
  id: string,
  input: TestimonialInput,
): Promise<ManagedTestimonial | null> {
  return file.update((content) => {
    const index = content.testimonials.findIndex(
      (testimonial) => testimonial.id === id,
    );
    if (index === -1) return null;
    const existing = content.testimonials[index];
    if (!existing) return null;
    const updated: ManagedTestimonial = { ...existing, ...input };
    content.testimonials[index] = updated;
    return updated;
  });
}

export function deleteTestimonial(id: string): Promise<ManagedTestimonial | null> {
  return file.update((content) => {
    const index = content.testimonials.findIndex(
      (testimonial) => testimonial.id === id,
    );
    if (index === -1) return null;
    const [removed] = content.testimonials.splice(index, 1);
    return removed ?? null;
  });
}

/* -------------------------------- policies -------------------------------- */

export function addPolicy(input: PolicyInput): Promise<ManagedPolicy> {
  return file.update((content) => {
    if (content.policies.length >= LIMITS.policies) {
      throw new LimitError(`Policy limit of ${LIMITS.policies} reached.`);
    }
    const policy: ManagedPolicy = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.policies.push(policy);
    return policy;
  });
}

export function updatePolicy(
  id: string,
  input: PolicyInput,
): Promise<ManagedPolicy | null> {
  return file.update((content) => {
    const index = content.policies.findIndex((policy) => policy.id === id);
    if (index === -1) return null;
    const existing = content.policies[index];
    if (!existing) return null;
    const updated: ManagedPolicy = { ...existing, ...input };
    content.policies[index] = updated;
    return updated;
  });
}

export function deletePolicy(id: string): Promise<ManagedPolicy | null> {
  return file.update((content) => {
    const index = content.policies.findIndex((policy) => policy.id === id);
    if (index === -1) return null;
    const [removed] = content.policies.splice(index, 1);
    return removed ?? null;
  });
}

/* ------------------------- programmes and impact ------------------------- */

export function patchProgramme(
  id: string,
  patch: ProgrammeOverrides[string],
): Promise<ProgrammeOverrides | null> {
  return file.update((content) => {
    // Check the id against the canonical list, not against existing overrides.
    // Overrides start empty, so testing the current map would reject the very
    // first edit to any programme and make the editor look broken.
    if (!isProgrammeId(id)) return null;

    const merged: ProgrammeOverrides[string] = { ...content.programmes[id], ...patch };

    // The image/alt-text pairing is an invariant of the *merged* programme, not
    // of the patch: swapping the image while keeping existing alt text is
    // perfectly valid, and must not be forced into retyping the description.
    const base = staticProgrammes.find((programme) => programme.id === id);
    const image = merged.image ?? base?.image ?? '';
    const imageAlt = merged.imageAlt ?? base?.imageAlt ?? '';
    if (image && imageAlt.trim().length < 3) {
      throw new ContentValidationError('Describe the image for screen readers.', 'imageAlt');
    }

    content.programmes[id] = merged;
    return content.programmes;
  });
}

export function patchImpact(patch: ImpactPatch): Promise<ImpactPatch> {
  return file.update((content) => {
    content.impact = { ...content.impact, ...patch };
    return content.impact;
  });
}

export function resetContent(): Promise<ManagedContent> {
  return file.update((content) => {
    content.pictures = [];
    content.projects = [];
    content.activities = [];
    content.teamMembers = [];
    content.testimonials = [];
    content.policies = [];
    content.programmes = {};
    content.impact = {};
    return content;
  });
}

/* ------------------------------- ordering -------------------------------- */

/** Newest first, with a stable tiebreak so equal timestamps do not shuffle. */
export const sortByDateDesc = <T extends { date: string; createdAt: string }>(
  a: T,
  b: T,
): number => b.date.localeCompare(a.date) || byNewest(a, b);

export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitError';
  }
}

/**
 * A rule that spans the static baseline and the patch, so it cannot be expressed
 * by the patch schema alone. Carries the field name so the dashboard can
 * highlight the input rather than showing a generic banner.
 */
export class ContentValidationError extends Error {
  readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'ContentValidationError';
    this.field = field;
  }
}
