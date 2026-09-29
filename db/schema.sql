-- Golden Steps — SQLite schema
--
-- This is the single source of truth for the database. `server/sqlite.ts` reads
-- and applies this file at startup, so the schema is never duplicated in code.
--
-- Portability notes, because this file is read by a driver rather than a human
-- at a psql prompt:
--
--   * Dates and timestamps are TEXT in ISO-8601 (`2026-09-28` and
--     `2026-09-28T09:20:00.000Z`). SQLite has no date type, and ISO-8601 sorts
--     correctly as text, so `ORDER BY` and `LIMIT` behave exactly as they do
--     with the JSON store this replaces. Storing epoch integers would order
--     correctly too but would lose the original string and force every read
--     through a formatter.
--   * `sort_order` is not called `order`, which is a reserved word and would
--     need quoting in every statement that touched it.
--   * `highlights` is a JSON array held in a TEXT column. It is only ever read
--     and written as a whole value, so a join table would add a transaction and
--     a second source of ordering truth for no query benefit. It is nullable
--     rather than defaulted to `'[]'` so "never overridden" stays distinct from
--     "overridden to an empty list" — the same sparse-patch rule the JSON store
--     relied on, where an absent key must not blank the static default.
--   * CHECK constraints mirror the shapes enforced by the Zod schemas in
--     `shared/schemas.ts`. They are a second line of defence, not the first:
--     requests are validated before they reach SQL, so these only ever fire on
--     a bug or a hand-edited row.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- pictures --
-- Gallery entries. `src` may be an image or a video; the gallery derives the
-- element to render from the extension rather than storing a `kind` flag, so a
-- picture added by any route is classified the same way.
CREATE TABLE IF NOT EXISTS pictures (
  id           TEXT    PRIMARY KEY,
  src          TEXT    NOT NULL,
  alt          TEXT    NOT NULL,
  tag          TEXT    NOT NULL,
  caption      TEXT    NOT NULL,
  poster       TEXT    NOT NULL DEFAULT '',
  captions_src TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL
);

-- ---------------------------------------------------------------- projects --
-- Dated field projects, always tied to one of the six programme areas.
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT    PRIMARY KEY,
  title      TEXT    NOT NULL,
  summary    TEXT    NOT NULL,
  programme  TEXT    NOT NULL
             CHECK (programme IN ('gender', 'health', 'child', 'economic', 'justice', 'climate')),
  status     TEXT    NOT NULL
             CHECK (status IN ('Planned', 'In progress', 'Completed')),
  date       TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  location   TEXT    NOT NULL DEFAULT '',
  image      TEXT    NOT NULL DEFAULT '',
  image_alt  TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL
);

-- -------------------------------------------------------------- activities --
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT    PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  kind        TEXT    NOT NULL
              CHECK (kind IN ('Outreach', 'Training', 'Partnership', 'Milestone')),
  date        TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  image       TEXT    NOT NULL DEFAULT '',
  image_alt   TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);

-- ------------------------------------------------------------ team_members --
CREATE TABLE IF NOT EXISTS team_members (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  role       TEXT    NOT NULL,
  bio        TEXT    NOT NULL,
  image      TEXT    NOT NULL DEFAULT '',
  image_alt  TEXT    NOT NULL DEFAULT '',
  email      TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

-- ----------------------------------------------------------- testimonials --
CREATE TABLE IF NOT EXISTS testimonials (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  role        TEXT    NOT NULL,
  testimonial TEXT    NOT NULL,
  image       TEXT    NOT NULL DEFAULT '',
  image_alt   TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

-- ---------------------------------------------------------------- policies --
-- `file` is always a PDF path. The server serves `/uploads` with
-- `Content-Disposition: attachment` for PDFs so they download instead of
-- rendering same-origin, so this column must never hold an .html or .svg path.
CREATE TABLE IF NOT EXISTS policies (
  id         TEXT    PRIMARY KEY,
  title      TEXT    NOT NULL,
  category   TEXT    NOT NULL DEFAULT '',
  summary    TEXT    NOT NULL DEFAULT '',
  file       TEXT    NOT NULL,
  date       TEXT    NOT NULL DEFAULT '',
  bytes      INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

-- -------------------------------------------------------------- programmes --
-- Sparse overrides on the programmes baked into `shared/content.ts`. A row
-- exists only where the operator has overridden something; an absent row means
-- "render the static default", which is why every nullable column is nullable
-- and no column carries a NOT NULL default. Patching merges into the existing
-- row rather than replacing it, so a one-field edit cannot blank the rest.
CREATE TABLE IF NOT EXISTS programmes (
  id            TEXT    PRIMARY KEY
                CHECK (id IN ('gender', 'health', 'child', 'economic', 'justice', 'climate')),
  name          TEXT,
  summary       TEXT,
  description   TEXT,
  icon          TEXT,
  highlights    TEXT,
  beneficiaries INTEGER,
  image         TEXT,
  image_alt     TEXT,
  caption       TEXT,
  updated_at    TEXT    NOT NULL
);

-- ------------------------------------------------------------------ impact --
-- A single row of copy overrides. Modelled as a table rather than a key/value
-- pair so the three fields stay named and typed. The CHECK on `singleton` is
-- what makes "exactly one row" a database guarantee instead of a convention:
-- it is the same trick SQLite has no partial-index syntax to express.
CREATE TABLE IF NOT EXISTS impact (
  singleton     INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
  lead          TEXT,
  total_label   TEXT,
  total_caption TEXT,
  updated_at    TEXT    NOT NULL
);

-- --------------------------------------------------------------- enquiries --
-- Written by the public contact form. `received_at` is indexed because
-- `listEnquiries` always orders by it and applies a LIMIT.
CREATE TABLE IF NOT EXISTS enquiries (
  id           TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  email        TEXT    NOT NULL,
  organisation TEXT    NOT NULL DEFAULT '',
  topic        TEXT    NOT NULL
               CHECK (topic IN ('Partnership', 'Funding / donor support',
                                'Community programme', 'Volunteering',
                                'General enquiry')),
  message      TEXT    NOT NULL,
  received_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enquiries_received_at ON enquiries (received_at DESC);

-- --------------------------------------------------------------- ordering --
-- The dashboard lists and the public site both read these newest-first, so the
-- sort columns are indexed rather than left to a full scan and a temp b-tree.
CREATE INDEX IF NOT EXISTS idx_projects_date     ON projects (date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_date   ON activities (date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pictures_created  ON pictures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_order        ON team_members (sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_order ON testimonials (sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policies_order    ON policies (sort_order, created_at DESC);
