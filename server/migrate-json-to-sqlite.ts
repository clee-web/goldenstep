/**
 * One-time import of the JSON store into SQLite.
 *
 * Run once, then keep the JSON files as a backup:
 *
 *     npm run migrate:sqlite
 *
 * The script is idempotent in the sense that matters: it refuses to run if the
 * database already holds content, unless `--force` is passed. A silent second
 * run would duplicate every picture, and a duplicated gallery is harder to
 * notice — and to undo — than a script that stops and says so.
 *
 * Both source files are optional. A first-time deployment that has never been
 * edited through the dashboard has nothing to import, and that is not an error.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { SQLInputValue } from 'node:sqlite';

import {
  activityInputSchema,
  impactPatchSchema,
  isProgrammeId,
  pictureInputSchema,
  policyInputSchema,
  programmePatchSchema,
  projectInputSchema,
  teamMemberInputSchema,
  testimonialInputSchema,
} from '../shared/schemas.ts';
import { CONTENT_FILE, ENQUIRIES_FILE } from './paths.ts';
import { closeDb, databaseFile, db, transact } from './sqlite.ts';

const force = process.argv.includes('--force');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function readJson(file: string): unknown {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Could not parse ${file}: ${(error as Error).message}`);
    process.exit(1);
  }
}

const content = (readJson(CONTENT_FILE) ?? {}) as Record<string, unknown>;
const enquiries = readJson(ENQUIRIES_FILE);

/* ------------------------------ sanity checks ----------------------------- */

const handle = db();

const existing = handle
  .prepare(
    `SELECT (SELECT COUNT(*) FROM pictures)     AS pictures,
            (SELECT COUNT(*) FROM projects)     AS projects,
            (SELECT COUNT(*) FROM activities)   AS activities,
            (SELECT COUNT(*) FROM team_members) AS teamMembers,
            (SELECT COUNT(*) FROM testimonials) AS testimonials,
            (SELECT COUNT(*) FROM policies)     AS policies,
            (SELECT COUNT(*) FROM enquiries)    AS enquiries`,
  )
  .get() as Record<string, number>;

const alreadyHasContent = Object.values(existing).some((n) => n > 0);
if (alreadyHasContent && !force) {
  console.error(
    `Refusing to import: ${databaseFile} already contains data ` +
      `(${Object.entries(existing)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ')}).`,
  );
  console.error('Re-run with --force to import anyway, or delete the database first.');
  closeDb();
  process.exit(1);
}

/* --------------------------------- import --------------------------------- */

type Counts = Record<string, number>;
const counts: Counts = {};
let skipped = 0;

/**
 * Inserts only the records that still satisfy their schema.
 *
 * A record that no longer parses is counted and skipped rather than aborting
 * the run: the operator should end up with everything that was valid, and a
 * clear list of what needs re-entering, rather than a half-finished import and
 * a stack trace.
 */
function importRows(
  table: string,
  items: unknown[],
  schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } },
  columns: string[],
  toParams: (data: Record<string, unknown>, id: string, createdAt: string) => unknown[],
): void {
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  let inserted = 0;

  for (const item of items) {
    if (!isRecord(item)) {
      skipped += 1;
      continue;
    }
    const parsed = schema.safeParse(item);
    if (!parsed.success || !parsed.data) {
      skipped += 1;
      continue;
    }
    // Keep the original id and timestamp so links already published in
    // content.json keep resolving, and so sort order is unchanged.
    const id = typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID();
    const createdAt =
      typeof item.createdAt === 'string' && item.createdAt
        ? item.createdAt
        : new Date().toISOString();

    handle.prepare(sql).run(...(toParams(parsed.data as Record<string, unknown>, id, createdAt) as never[]));
    inserted += 1;
  }

  counts[table] = inserted;
}

transact(() => {
  importRows(
    'pictures',
    asArray(content.pictures),
    pictureInputSchema,
    ['id', 'src', 'alt', 'tag', 'caption', 'poster', 'captions_src', 'created_at'],
    (d, id, createdAt) => [
      id, d.src, d.alt, d.tag, d.caption, d.poster ?? '', d.captionsSrc ?? '', createdAt,
    ],
  );

  importRows(
    'projects',
    asArray(content.projects),
    projectInputSchema,
    ['id', 'title', 'summary', 'programme', 'status', 'date', 'location', 'image', 'image_alt', 'created_at'],
    (d, id, createdAt) => [
      id, d.title, d.summary, d.programme, d.status, d.date,
      d.location ?? '', d.image ?? '', d.imageAlt ?? '', createdAt,
    ],
  );

  importRows(
    'activities',
    asArray(content.activities),
    activityInputSchema,
    ['id', 'title', 'description', 'kind', 'date', 'image', 'image_alt', 'created_at'],
    (d, id, createdAt) => [
      id, d.title, d.description, d.kind, d.date, d.image ?? '', d.imageAlt ?? '', createdAt,
    ],
  );

  importRows(
    'team_members',
    asArray(content.teamMembers),
    teamMemberInputSchema,
    ['id', 'name', 'role', 'bio', 'image', 'image_alt', 'email', 'sort_order', 'created_at'],
    (d, id, createdAt) => [
      id, d.name, d.role, d.bio, d.image ?? '', d.imageAlt ?? '', d.email ?? '',
      d.order ?? 0, createdAt,
    ],
  );

  importRows(
    'testimonials',
    asArray(content.testimonials),
    testimonialInputSchema,
    ['id', 'name', 'role', 'testimonial', 'image', 'image_alt', 'sort_order', 'created_at'],
    (d, id, createdAt) => [
      id, d.name, d.role, d.testimonial, d.image ?? '', d.imageAlt ?? '', d.order ?? 0, createdAt,
    ],
  );

  importRows(
    'policies',
    asArray(content.policies),
    policyInputSchema,
    ['id', 'title', 'category', 'summary', 'file', 'date', 'bytes', 'sort_order', 'created_at'],
    (d, id, createdAt) => [
      id, d.title, d.category ?? '', d.summary ?? '', d.file, d.date ?? '',
      d.bytes ?? 0, d.order ?? 0, createdAt,
    ],
  );

  // Programme overrides and impact are singleton-shaped rather than lists, so
  // they are written directly instead of through `importRows`.
  if (isRecord(content.programmes)) {
    let count = 0;
    for (const [id, patch] of Object.entries(content.programmes)) {
      if (!isProgrammeId(id)) {
        skipped += 1;
        continue;
      }
      const parsed = programmePatchSchema.safeParse(patch);
      if (!parsed.success || !parsed.data) {
        skipped += 1;
        continue;
      }
      const d = parsed.data as Record<string, unknown>;
      handle
        .prepare(
          `INSERT INTO programmes (id, name, summary, description, icon, highlights,
                                   beneficiaries, image, image_alt, caption, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        // Values come from parsed JSON, so they are `unknown` until SQLite
        // accepts only null/number/bigint/string/Uint8Array. The migration is
        // reading a file this project wrote, and the schemas above have already
        // validated every field, so the cast is a restatement of that.
        .run(...([
          id, d.name ?? null, d.summary ?? null, d.description ?? null, d.icon ?? null,
          d.highlights === undefined ? null : JSON.stringify(d.highlights),
          d.beneficiaries ?? null, d.image ?? null, d.imageAlt ?? null, d.caption ?? null,
          new Date().toISOString(),
        ] as SQLInputValue[]));
      count += 1;
    }
    counts.programmes = count;
  }

  if (isRecord(content.impact)) {
    const parsed = impactPatchSchema.safeParse(content.impact);
    if (parsed.success && parsed.data && Object.keys(parsed.data).length > 0) {
      const d = parsed.data;
      handle
        .prepare(
          `INSERT INTO impact (singleton, lead, total_label, total_caption, updated_at)
           VALUES (1, ?, ?, ?, ?)`,
        )
        .run(
          d.lead ?? null, d.totalLabel ?? null, d.totalCaption ?? null, new Date().toISOString(),
        );
      counts.impact = 1;
    } else {
      counts.impact = 0;
    }
  }

  // Enquiries are imported as-is. The honeypot field is not stored at all: a
  // filled `website` never reached the JSON store either, and persisting it
  // would only give a future reader something to be misled by.
  if (Array.isArray(enquiries)) {
    let count = 0;
    for (const item of enquiries) {
      if (!isRecord(item)) {
        skipped += 1;
        continue;
      }
      const id = typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID();
      const receivedAt =
        typeof item.receivedAt === 'string' && item.receivedAt
          ? item.receivedAt
          : new Date().toISOString();
      handle
        .prepare(
          `INSERT INTO enquiries (id, name, email, organisation, topic, message, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id, String(item.name ?? ''), String(item.email ?? ''), String(item.organisation ?? ''),
          String(item.topic ?? 'General enquiry'), String(item.message ?? ''), receivedAt,
        );
      count += 1;
    }
    counts.enquiries = count;
  }
});

/* --------------------------------- report --------------------------------- */

console.log(`\nImported into ${databaseFile}\n`);
for (const [table, n] of Object.entries(counts)) {
  console.log(`  ${String(n).padStart(4)}  ${table}`);
}
if (skipped > 0) {
  console.log(`\n  ${skipped} record(s) skipped because they no longer validate.`);
  console.log('  They were not imported — re-enter those in the dashboard.');
}
if (!existsSync(CONTENT_FILE) && !existsSync(ENQUIRIES_FILE)) {
  console.log('\n  No JSON files found; started with an empty database.');
}

console.log(
  '\nDone. Keep content.json and enquiries.json as a backup — they are no longer read.\n',
);

closeDb();
