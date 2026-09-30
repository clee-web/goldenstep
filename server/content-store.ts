import { randomUUID } from 'node:crypto';

import { z } from 'zod';

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
import { db, transact } from './sqlite.ts';

/**
 * Managed content, in SQLite.
 *
 * The exported functions are unchanged from the JSON implementation, which is
 * the point: `admin-routes.ts` imports this module and cannot tell which store
 * is behind it. Every function still returns a Promise so the routes did not
 * have to change either — the underlying driver is synchronous, and wrapping it
 * in `async` costs nothing but keeps the calling convention uniform.
 *
 * Read-time re-validation is kept from the JSON version on purpose. Requests
 * are validated before they reach SQL, so these checks should never fire — but
 * rows can also arrive via the one-time JSON import, and dropping one malformed
 * row should cost the operator that one picture, not the whole dashboard.
 */

export const LIMITS = {
  pictures: 200,
  projects: 100,
  activities: 200,
  teamMembers: 50,
  testimonials: 60,
  policies: 60,
} as const;

const now = (): string => new Date().toISOString();

/* --------------------------------- reading -------------------------------- */

/**
 * Rows come back in insertion order (`rowid`), which is what the JSON array
 * order used to be. Callers that care about recency sort explicitly with
 * `sortByDateDesc`, so preserving the order the records were created in keeps
 * the dashboard's galleries and lists behaving exactly as before.
 */
const insertionOrder = 'ORDER BY rowid ASC';

export async function readManagedContent(): Promise<ManagedContent> {
  const handle = db();
  const all = <T>(sql: string): T[] => handle.prepare(sql).all() as T[];

  return {
    pictures: collect<ManagedPicture>(all, 'pictures', pictureInputSchema),
    projects: collect<ManagedProject>(all, 'projects', projectInputSchema),
    activities: collect<ManagedActivity>(all, 'activities', activityInputSchema),
    teamMembers: collect<ManagedTeamMember>(all, 'team_members', teamMemberInputSchema),
    testimonials: collect<ManagedTestimonial>(all, 'testimonials', testimonialInputSchema),
    policies: collect<ManagedPolicy>(all, 'policies', policyInputSchema),
    programmes: readProgrammes(),
    impact: readImpact(),
  };
}

/**
 * Selects every row of one table and keeps the ones that still satisfy their
 * schema, re-attaching the generated `id` and `createdAt` the input schemas do
 * not cover.
 */
function collect<T extends { id: string; createdAt: string }>(
  all: <R>(sql: string) => R[],
  table: string,
  schema: z.ZodType,
): T[] {
  const columns: Record<string, string> = {
    pictures: 'id, src, alt, tag, caption, poster, captions_src AS captionsSrc',
    projects: 'id, title, summary, programme, status, date, location, image, image_alt AS imageAlt',
    activities: 'id, title, description, kind, date, image, image_alt AS imageAlt',
    team_members:
      'id, name, role, bio, image, image_alt AS imageAlt, email, sort_order AS "order"',
    testimonials:
      'id, name, role, testimonial, image, image_alt AS imageAlt, sort_order AS "order"',
    policies: 'id, title, category, summary, file, date, bytes, sort_order AS "order"',
  };

  const columnList = columns[table];
  if (!columnList) throw new Error(`Unknown content table: ${table}`);

  const rows = all<Record<string, unknown>>(
    `SELECT id, ${columnList}, created_at AS createdAt FROM ${table} ${insertionOrder}`,
  );

  const out: T[] = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (!parsed.success || parsed.data === undefined) {
      /*
       * A row that fails validation here has already been accepted by the write
       * path, so dropping it silently makes saved content disappear: the
       * dashboard reports success, the row is in the database, and the public
       * page and every later dashboard load omit it. That is the worst shape a
       * bug can have, because the write and the read disagree and neither says
       * so.
       *
       * The usual cause is a stored default colliding with an input schema — an
       * empty string in a column the schema validates as an email address, for
       * instance. The row and the reason are logged so it is traceable to a
       * specific record rather than looking like the row never existed.
       */
      console.warn(
        `[golden-steps] ${table} row ${String(row.id)} failed validation and was ` +
          `omitted from the response: ${parsed.success ? 'no data' : z.prettifyError(parsed.error)}`,
      );
      continue;
    }
    out.push({ ...(parsed.data as object), id: String(row.id), createdAt: String(row.createdAt) } as T);
  }
  return out;
}

function readProgrammes(): ProgrammeOverrides {
  const rows = db()
    .prepare(
      `SELECT id, name, summary, description, icon, highlights,
              beneficiaries, image, image_alt AS imageAlt, caption
         FROM programmes`,
    )
    .all() as Record<string, unknown>[];

  const programmes: ProgrammeOverrides = {};
  for (const row of rows) {
    const id = String(row.id);
    // Checked against the canonical list rather than against what is stored, so
    // a hand-added row cannot inject an unknown key into the rendered page.
    if (!isProgrammeId(id)) continue;

    // A null column means "not overridden" and must stay absent from the patch.
    // Rebuilding the object key by key is what preserves that: spreading the
    // row would carry explicit nulls, and `{...{name: null}}` would blank the
    // static default instead of falling back to it.
    const patch: Record<string, unknown> = {};
    for (const [column, key] of [
      ['name', 'name'],
      ['summary', 'summary'],
      ['description', 'description'],
      ['icon', 'icon'],
      ['beneficiaries', 'beneficiaries'],
      ['image', 'image'],
      ['imageAlt', 'imageAlt'],
      ['caption', 'caption'],
    ] as const) {
      const value = row[column];
      if (value !== null && value !== undefined) patch[key] = value;
    }

    if (row.highlights !== null && row.highlights !== undefined) {
      try {
        const parsed = JSON.parse(String(row.highlights));
        if (Array.isArray(parsed)) patch.highlights = parsed;
      } catch {
        // Unparseable JSON is treated as "not set" rather than fatal.
      }
    }

    const parsed = programmePatchSchema.safeParse(patch);
    if (parsed.success) programmes[id] = parsed.data;
  }
  return programmes;
}

function readImpact(): ImpactPatch {
  const row = db()
    .prepare('SELECT lead, total_label AS totalLabel, total_caption AS totalCaption FROM impact WHERE singleton = 1')
    .get() as Record<string, unknown> | undefined;
  if (!row) return {};

  const patch: Record<string, unknown> = {};
  for (const key of ['lead', 'totalLabel', 'totalCaption'] as const) {
    const value = row[key];
    if (value !== null && value !== undefined) patch[key] = value;
  }

  const parsed = impactPatchSchema.safeParse(patch);
  return parsed.success ? parsed.data : {};
}

/* --------------------------------- writing -------------------------------- */

/**
 * Per-table ceilings, keyed by the SQL table name.
 *
 * Keyed by table rather than reusing `LIMITS` directly because the SQL names are
 * snake_case (`team_members`) while the public constant is camelCase
 * (`teamMembers`). Keeping one map means a call site cannot pass a limit that
 * belongs to a different table, which the two-argument form could not prevent.
 */
const CAPS = {
  pictures: { limit: LIMITS.pictures, label: 'Picture' },
  projects: { limit: LIMITS.projects, label: 'Project' },
  activities: { limit: LIMITS.activities, label: 'Activity' },
  team_members: { limit: LIMITS.teamMembers, label: 'Team member' },
  testimonials: { limit: LIMITS.testimonials, label: 'Testimonial' },
  policies: { limit: LIMITS.policies, label: 'Policy' },
} as const;

type CappedTable = keyof typeof CAPS;

/**
 * Enforces a per-table record ceiling inside the caller's transaction.
 *
 * The count and the insert share a transaction, so two concurrent saves cannot
 * both observe `limit - 1` and both insert, which is exactly the overshoot a
 * JSON store with an in-process lock could not suffer.
 */
function assertUnderLimit(table: CappedTable): void {
  const { limit, label } = CAPS[table];
  const { count } = db()
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .get() as { count: number };
  if (count >= limit) throw new LimitError(`${label} limit of ${limit} reached.`);
}

/* ------------------------------- pictures -------------------------------- */

export async function addPicture(input: PictureInput): Promise<ManagedPicture> {
  return transact(() => {
    assertUnderLimit('pictures');
    const id = randomUUID();
    const createdAt = now();
    db()
      .prepare(
        `INSERT INTO pictures (id, src, alt, tag, caption, poster, captions_src, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.src, input.alt, input.tag, input.caption, input.poster, input.captionsSrc, createdAt);
    return { ...input, id, createdAt };
  });
}

export async function updatePicture(
  id: string,
  input: PictureInput,
): Promise<ManagedPicture | null> {
  return transact(() => {
    const existing = db().prepare('SELECT created_at FROM pictures WHERE id = ?').get(id) as
      | { created_at: string }
      | undefined;
    if (!existing) return null;
    // `id` and `created_at` are deliberately not bound from `input`: the record
    // keeps its identity and its position in the list across an edit, which is
    // what the dashboard's inline editing expects.
    db()
      .prepare(
        `UPDATE pictures SET src = ?, alt = ?, tag = ?, caption = ?, poster = ?, captions_src = ?
          WHERE id = ?`,
      )
      .run(input.src, input.alt, input.tag, input.caption, input.poster, input.captionsSrc, id);
    return { ...input, id, createdAt: existing.created_at };
  });
}

export async function deletePicture(id: string): Promise<ManagedPicture | null> {
  return transact(() => {
    const row = db()
      .prepare(
        `SELECT id, src, alt, tag, caption, poster, captions_src AS captionsSrc, created_at AS createdAt
           FROM pictures WHERE id = ?`,
      )
      .get(id) as ManagedPicture | undefined;
    if (!row) return null;
    db().prepare('DELETE FROM pictures WHERE id = ?').run(id);
    return row;
  });
}

/* -------------------------------- projects ------------------------------- */

export async function addProject(input: ProjectInput): Promise<ManagedProject> {
  return transact(() => {
    assertUnderLimit('projects');
    const id = randomUUID();
    const createdAt = now();
    db()
      .prepare(
        `INSERT INTO projects (id, title, summary, programme, status, date, location, image, image_alt, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, input.title, input.summary, input.programme, input.status,
        input.date, input.location, input.image, input.imageAlt, createdAt,
      );
    return { ...input, id, createdAt };
  });
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<ManagedProject | null> {
  return transact(() => {
    const existing = db().prepare('SELECT created_at FROM projects WHERE id = ?').get(id) as
      | { created_at: string }
      | undefined;
    if (!existing) return null;
    db()
      .prepare(
        `UPDATE projects SET title = ?, summary = ?, programme = ?, status = ?, date = ?,
                             location = ?, image = ?, image_alt = ?
          WHERE id = ?`,
      )
      .run(
        input.title, input.summary, input.programme, input.status,
        input.date, input.location, input.image, input.imageAlt, id,
      );
    return { ...input, id, createdAt: existing.created_at };
  });
}

export async function deleteProject(id: string): Promise<ManagedProject | null> {
  return transact(() => {
    const row = db()
      .prepare(
        `SELECT id, title, summary, programme, status, date, location, image, image_alt AS imageAlt,
                created_at AS createdAt
           FROM projects WHERE id = ?`,
      )
      .get(id) as ManagedProject | undefined;
    if (!row) return null;
    db().prepare('DELETE FROM projects WHERE id = ?').run(id);
    return row;
  });
}

/* ------------------------------ activities ------------------------------ */

export async function addActivity(input: ActivityInput): Promise<ManagedActivity> {
  return transact(() => {
    assertUnderLimit('activities');
    const id = randomUUID();
    const createdAt = now();
    db()
      .prepare(
        `INSERT INTO activities (id, title, description, kind, date, image, image_alt, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, input.title, input.description, input.kind,
        input.date, input.image, input.imageAlt, createdAt,
      );
    return { ...input, id, createdAt };
  });
}

export async function updateActivity(
  id: string,
  input: ActivityInput,
): Promise<ManagedActivity | null> {
  return transact(() => {
    const existing = db().prepare('SELECT created_at FROM activities WHERE id = ?').get(id) as
      | { created_at: string }
      | undefined;
    if (!existing) return null;
    db()
      .prepare(
        `UPDATE activities SET title = ?, description = ?, kind = ?, date = ?, image = ?, image_alt = ?
          WHERE id = ?`,
      )
      .run(
        input.title, input.description, input.kind,
        input.date, input.image, input.imageAlt, id,
      );
    return { ...input, id, createdAt: existing.created_at };
  });
}

export async function deleteActivity(id: string): Promise<ManagedActivity | null> {
  return transact(() => {
    const row = db()
      .prepare(
        `SELECT id, title, description, kind, date, image, image_alt AS imageAlt, created_at AS createdAt
           FROM activities WHERE id = ?`,
      )
      .get(id) as ManagedActivity | undefined;
    if (!row) return null;
    db().prepare('DELETE FROM activities WHERE id = ?').run(id);
    return row;
  });
}

/* --------------------------------- team ---------------------------------- */

export async function addTeamMember(input: TeamMemberInput): Promise<ManagedTeamMember> {
  return transact(() => {
    assertUnderLimit('team_members');
    const id = randomUUID();
    const createdAt = now();
    db()
      .prepare(
        `INSERT INTO team_members (id, name, role, bio, image, image_alt, email, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, input.name, input.role, input.bio, input.image, input.imageAlt,
        // The schema reports an absent address as `undefined` and the column is
        // `NOT NULL DEFAULT ''`, so the two are reconciled here rather than
        // storing a value SQLite would reject.
        input.email ?? '', input.order, createdAt,
      );
    return { ...input, id, createdAt };
  });
}

export async function updateTeamMember(
  id: string,
  input: TeamMemberInput,
): Promise<ManagedTeamMember | null> {
  return transact(() => {
    const existing = db().prepare('SELECT created_at FROM team_members WHERE id = ?').get(id) as
      | { created_at: string }
      | undefined;
    if (!existing) return null;
    db()
      .prepare(
        `UPDATE team_members SET name = ?, role = ?, bio = ?, image = ?, image_alt = ?,
                                email = ?, sort_order = ?
          WHERE id = ?`,
      )
      .run(
        input.name, input.role, input.bio, input.image, input.imageAlt,
        input.order, id,
      );
    return { ...input, id, createdAt: existing.created_at };
  });
}

export async function deleteTeamMember(id: string): Promise<ManagedTeamMember | null> {
  return transact(() => {
    const row = db()
      .prepare(
        `SELECT id, name, role, bio, image, image_alt AS imageAlt, email,
                sort_order AS "order", created_at AS createdAt
           FROM team_members WHERE id = ?`,
      )
      .get(id) as ManagedTeamMember | undefined;
    if (!row) return null;
    db().prepare('DELETE FROM team_members WHERE id = ?').run(id);
    return row;
  });
}

/* ------------------------------ testimonials ----------------------------- */

export async function addTestimonial(input: TestimonialInput): Promise<ManagedTestimonial> {
  return transact(() => {
    assertUnderLimit('testimonials');
    const id = randomUUID();
    const createdAt = now();
    db()
      .prepare(
        `INSERT INTO testimonials (id, name, role, testimonial, image, image_alt, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, input.name, input.role, input.testimonial, input.image, input.imageAlt,
        input.order, createdAt,
      );
    return { ...input, id, createdAt };
  });
}

export async function updateTestimonial(
  id: string,
  input: TestimonialInput,
): Promise<ManagedTestimonial | null> {
  return transact(() => {
    const existing = db().prepare('SELECT created_at FROM testimonials WHERE id = ?').get(id) as
      | { created_at: string }
      | undefined;
    if (!existing) return null;
    db()
      .prepare(
        `UPDATE testimonials SET name = ?, role = ?, testimonial = ?, image = ?, image_alt = ?, sort_order = ?
          WHERE id = ?`,
      )
      .run(
        input.name, input.role, input.testimonial, input.image, input.imageAlt,
        input.order, id,
      );
    return { ...input, id, createdAt: existing.created_at };
  });
}

export async function deleteTestimonial(id: string): Promise<ManagedTestimonial | null> {
  return transact(() => {
    const row = db()
      .prepare(
        `SELECT id, name, role, testimonial, image, image_alt AS imageAlt,
                sort_order AS "order", created_at AS createdAt
           FROM testimonials WHERE id = ?`,
      )
      .get(id) as ManagedTestimonial | undefined;
    if (!row) return null;
    db().prepare('DELETE FROM testimonials WHERE id = ?').run(id);
    return row;
  });
}

/* -------------------------------- policies -------------------------------- */

export async function addPolicy(input: PolicyInput): Promise<ManagedPolicy> {
  return transact(() => {
    assertUnderLimit('policies');
    const id = randomUUID();
    const createdAt = now();
    db()
      .prepare(
        `INSERT INTO policies (id, title, category, summary, file, date, bytes, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, input.title, input.category, input.summary, input.file,
        input.date, input.bytes, input.order, createdAt,
      );
    return { ...input, id, createdAt };
  });
}

export async function updatePolicy(
  id: string,
  input: PolicyInput,
): Promise<ManagedPolicy | null> {
  return transact(() => {
    const existing = db().prepare('SELECT created_at FROM policies WHERE id = ?').get(id) as
      | { created_at: string }
      | undefined;
    if (!existing) return null;
    db()
      .prepare(
        `UPDATE policies SET title = ?, category = ?, summary = ?, file = ?, date = ?, bytes = ?, sort_order = ?
          WHERE id = ?`,
      )
      .run(
        input.title, input.category, input.summary, input.file,
        input.date, input.bytes, input.order, id,
      );
    return { ...input, id, createdAt: existing.created_at };
  });
}

export async function deletePolicy(id: string): Promise<ManagedPolicy | null> {
  return transact(() => {
    const row = db()
      .prepare(
        `SELECT id, title, category, summary, file, date, bytes, sort_order AS "order",
                created_at AS createdAt
           FROM policies WHERE id = ?`,
      )
      .get(id) as ManagedPolicy | undefined;
    if (!row) return null;
    db().prepare('DELETE FROM policies WHERE id = ?').run(id);
    return row;
  });
}

/* ------------------------- programmes and impact ------------------------- */

export async function patchProgramme(
  id: string,
  patch: ProgrammeOverrides[string],
): Promise<ProgrammeOverrides | null> {
  return transact(() => {
    // Checked against the canonical list, not against stored rows. Overrides
    // start empty, so testing what exists would reject the very first edit to
    // any programme and make the editor look broken.
    if (!isProgrammeId(id)) return null;

    const current = readProgrammeRow(id);
    const merged: Record<string, unknown> = { ...current };

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      merged[key] = value;
    }

    /*
     * The image/alt-text pairing is an invariant of the *merged* programme, not
     * of the patch: swapping the image while keeping existing alt text is
     * perfectly valid, and must not be forced into retyping the description.
     */
    const base = staticProgrammes.find((programme) => programme.id === id);
    const image = (merged.image as string | undefined) ?? base?.image ?? '';
    const imageAlt = (merged.imageAlt as string | undefined) ?? base?.imageAlt ?? '';
    if (image && imageAlt.trim().length < 3) {
      throw new ContentValidationError('Describe the image for screen readers.', 'imageAlt');
    }

    db()
      .prepare(
        `INSERT INTO programmes (id, name, summary, description, icon, highlights,
                                 beneficiaries, image, image_alt, caption, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name          = COALESCE(excluded.name, programmes.name),
           summary       = COALESCE(excluded.summary, programmes.summary),
           description   = COALESCE(excluded.description, programmes.description),
           icon          = COALESCE(excluded.icon, programmes.icon),
           highlights    = COALESCE(excluded.highlights, programmes.highlights),
           beneficiaries = COALESCE(excluded.beneficiaries, programmes.beneficiaries),
           image         = COALESCE(excluded.image, programmes.image),
           image_alt     = COALESCE(excluded.image_alt, programmes.image_alt),
           caption       = COALESCE(excluded.caption, programmes.caption),
           updated_at    = excluded.updated_at`,
      )
      .run(
        id,
        (merged.name as string) ?? null,
        (merged.summary as string) ?? null,
        (merged.description as string) ?? null,
        (merged.icon as string) ?? null,
        merged.highlights === undefined ? null : JSON.stringify(merged.highlights),
        (merged.beneficiaries as number) ?? null,
        (merged.image as string) ?? null,
        (merged.imageAlt as string) ?? null,
        (merged.caption as string) ?? null,
        now(),
      );

    return readProgrammes();
  });
}

/** The stored override for one programme, as a sparse patch. Nulls are dropped. */
function readProgrammeRow(id: string): Record<string, unknown> {
  const row = db()
    .prepare(
      `SELECT name, summary, description, icon, highlights, beneficiaries, image,
              image_alt AS imageAlt, caption
         FROM programmes WHERE id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return {};

  const patch: Record<string, unknown> = {};
  for (const [column, key] of [
    ['name', 'name'],
    ['summary', 'summary'],
    ['description', 'description'],
    ['icon', 'icon'],
    ['beneficiaries', 'beneficiaries'],
    ['image', 'image'],
    ['imageAlt', 'imageAlt'],
    ['caption', 'caption'],
  ] as const) {
    const value = row[column];
    if (value !== null && value !== undefined) patch[key] = value;
  }
  if (row.highlights !== null && row.highlights !== undefined) {
    try {
      const parsed = JSON.parse(String(row.highlights));
      if (Array.isArray(parsed)) patch.highlights = parsed;
    } catch {
      /* treat as unset */
    }
  }
  return patch;
}

export async function patchImpact(patch: ImpactPatch): Promise<ImpactPatch> {
  return transact(() => {
    const current = readImpact();
    const merged = { ...current, ...patch };

    db()
      .prepare(
        `INSERT INTO impact (singleton, lead, total_label, total_caption, updated_at)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(singleton) DO UPDATE SET
           lead         = COALESCE(excluded.lead, impact.lead),
           total_label  = COALESCE(excluded.total_label, impact.total_label),
           total_caption= COALESCE(excluded.total_caption, impact.total_caption),
           updated_at   = excluded.updated_at`,
      )
      .run(
        merged.lead ?? null,
        merged.totalLabel ?? null,
        merged.totalCaption ?? null,
        now(),
      );

    return readImpact();
  });
}

export async function resetContent(): Promise<ManagedContent> {
  return transact(() => {
    for (const table of [
      'pictures',
      'projects',
      'activities',
      'team_members',
      'testimonials',
      'policies',
      'programmes',
      'impact',
    ]) {
      db().prepare(`DELETE FROM ${table}`).run();
    }
    return emptyManagedContent();
  });
}

/* ------------------------------- ordering -------------------------------- */

/** Newest first, with a stable tiebreak so equal timestamps do not shuffle. */
export const sortByDateDesc = <T extends { date: string; createdAt: string }>(
  a: T,
  b: T,
): number => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

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
