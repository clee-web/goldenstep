# Golden Steps — Website

Full-stack website for Golden Steps, a grassroots women-led organization founded in
2023 supporting vulnerable and marginalized groups across Kisumu East Sub County,
Kenya.

Content is sourced from the Golden Steps project overview deck: six thematic
programmes, impact figures, vision/mission, values, geographic footprint and
partnership model. Community photographs come from the deck's own image set.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS 4 |
| Backend | Express 5 (TypeScript, compiled to JavaScript for deployment) |
| Validation | Zod 4, shared between client and server |
| Storage | Atomic JSON file store (swap in Postgres later — see below) |
| Testing | `node:test` against a live Express instance |

## Quick start

```bash
npm install
npm run dev
```

`npm run dev` starts both processes:

- API on **http://localhost:4000**
- Site on **http://localhost:5173** (Vite proxies `/api` to the API)

### Other commands

```bash
npm run build      # typecheck, build the site into dist/, stage dist-server/
npm start          # run the compiled server, serving dist/ when it exists
npm run start:local# as above, plus your local .env file
npm run preview    # serve the built site via Vite
npm test           # API integration tests
npm run lint       # ESLint (flat config, zero warnings tolerated)
npm run typecheck  # tsc project references, client and server
npm run backup     # WAL-safe snapshot of the database and uploads/
```

## Before you launch

1. **Copy the env file and fill in the contact details.**

   ```bash
   cp .env.example .env.local
   ```

   The site builds and runs with these blank. Until `VITE_ORG_EMAIL` is set the
   contact card renders "Email not published yet" instead of a broken `mailto:`
   link, and social links are omitted from the footer rather than rendered dead.

2. **Forward enquiries to an inbox.** Submissions are currently written to
   `data/enquiries.json`. To email them instead, add a mail transport in
   `server/routes.ts` inside the `POST /enquiries` handler after `saveEnquiry`
   succeeds. See the "Where do enquiries go?" section below.

3. **Review the beneficiary figures** in `shared/content.ts`. They are the
   estimates stated in the deck and are labelled as such on the page. They can
   later be corrected from the dashboard without a deploy.

4. **Enable the admin dashboard** by setting `ADMIN_PASSWORD` and
   `ADMIN_SESSION_SECRET`. See "The dashboard" below.

## Project layout

```
shared/          Content + schemas imported by BOTH client and server
  content.ts       All deck content: programmes, impact, vision, copy
                   plus `chapters`, the narrative that drives the rail
  schemas.ts       Zod schemas: enquiry, managed content, API response types
server/          Express API (TypeScript, compiled to dist-server/ for deploy)
  index.ts         App factory, static hosting, error handling, start()
  routes.ts        /api/health, /api/programmes, /api/content, /api/enquiries
  admin-routes.ts  /api/admin/* — session, content CRUD, uploads
  auth.ts          Password check, HMAC session cookie, requireAdmin
  uploads.ts       Multer config, MIME allow-list, error translation
  content-store.ts Managed content: read, create, update, delete, patch
  sqlite.ts        Lazy connection, WAL, schema application, transactions
  persistence.ts   Detects whether DATA_DIR is durable; warns when it is not
  backup.ts        WAL-safe backup and restore (`npm run backup`)
  json-file.ts     Atomic, serialised JSON persistence helper
  paths.ts         Every runtime-writeable path, from DATA_DIR
  here.ts          This file's directory, on Node 18 as well as 20+
  store.ts         Enquiry persistence
  api.test.ts      Enquiry and public API integration tests
  admin.test.ts    Auth, CRUD, upload and content tests
scripts/
  stage.mjs        Assembles the deployable dist-server/ directory
db/
  schema.sql       The single source of truth, applied at startup
app.js             Entry point for cPanel / Passenger
src/
  App.tsx         Section order IS the narrative (see below)
  admin/          Dashboard shell, login and the five managers
  components/
    layout/        TopBar, Header (sticky nav + dropdowns + mobile drawer),
                   BrandMark (logo lockup), Footer, NarrativeRail (story rail)
    sections/      One file per chapter of the story
    ui/            Button, Reveal, Chapter, SectionHeading, Eyebrow
  config/site.ts   Env-driven org details
  hooks/           useInView, useCountUp, useMediaQuery, useActiveSection,
                   useLockBodyScroll, useHeaderScroll, useManagedContent
  lib/api.ts       Typed fetch wrapper for public endpoints
  lib/adminApi.ts  Typed fetch wrapper for the dashboard
  lib/content.ts   Merges admin overrides onto the static content
public/assets/     Deck imagery (Picture1-6, logo, "why work with us")
data/             Git-ignored runtime state: enquiries, content, uploads
```

`shared/content.ts` is the single source of truth for the *defaults*. The client
imports it directly for instant static rendering; `GET /api/programmes` serves the
same data for external consumers; and `GET /api/content` serves any dashboard
edits layered on top. **Edit defaults in that one file** — nothing else needs
changing to update the site, and the dashboard only ever stores sparse overrides
rather than replacing it.

## Content: static defaults, runtime overrides

The site ships with every word and picture compiled into the bundle, so it is
complete with no server. Dashboard edits are an *overlay*, not a replacement:

- `GET /api/content` returns only what the dashboard has changed.
- `src/lib/content.ts` merges that overlay onto the static content.
- If the request fails, the merge is a no-op and the reader sees the full static
  site. A broken dashboard can never blank the public pages.

Two things are deliberately **not** overridable, because they are structural
rather than editorial: programme ids, order and numbers (they drive chapter
numbering, the rail and the gallery), and the six programme photographs (the
gallery always includes them, and uploads are appended).

## The narrative

Section order is the argument, not a feature list. A reader has to be convinced in
this order, so `App.tsx` renders it in this order:

| # | Chapter | Section | Job |
|---|---------|---------|-----|
| 01 | Who we are | `#about` | the people and the place |
| 02 | Why we exist | `#vision` | the vision and mission |
| 03 | How we work | `#approach` | the method that makes it credible |
| 04 | What we do | `#programs` | the six programme areas |
| 05 | Proof, in people | `#stories` | the photographs |
| 06 | Proof, in scale | `#impact` | the numbers those people add up to |
| 07 | From the field | `#field` | live projects and recent updates |
| 08 | Who we work with | `#partners` | the credibility to scale |
| 09 | Take the step | `#contact` | the ask |

Proof lands *after* the work rather than before it, and the approach is earned
before the programmes depend on it. Chapter definitions live in
`shared/content.ts` under `chapters`; `useActiveSection` tracks which one is in
view and `NarrativeRail` renders it as a fixed staircase. The same chapter
numbers are reused as menu numerals in the header, so the rail, the navigation
and the page itself cannot disagree about where a section sits in the story.

Each chapter ends with a `ChapterBridge` line that names the next movement of the
story ("Every frame is a person. Together, they are a number."), so the
transitions carry meaning instead of just separating sections.

### Navigation

The header owns the scroll position indicator, so it is the only place a
progress bar appears. `useHeaderScroll` condenses the bar, steps it aside for a
reader moving down the page, brings it straight back on any upward travel, and
writes the reading position to a CSS custom property on the progress fill rather
than into React state — a scroll never re-renders the navigation.

The nine section links are grouped into four questions in `shared/content.ts`
under `navGroups`, each with a `description` drawn from the deck. The grouping
lives in the content file because that is where every other editable string
lives; `Header.tsx` only lays it out. The triggers are real links, not buttons:
they navigate on click *and* open a disclosure panel on hover or focus, which is
why the panel uses `aria-expanded` + `aria-controls` and deliberately does not
carry `aria-haspopup` — there is no `menu` widget here to advertise.

`TopBar` renders inside the header's sticky wrapper rather than beside it, so the
two move as one object. That changes the condensed stack to 34 + 60 = 94px, which
is the constraint behind the height: it has to stay under the `scroll-mt-24` the
sections reserve for anchor landings.

### Scroll animation

`Reveal` (`src/components/ui/Reveal.tsx`) animates children in when they enter the
viewport via `useInView`. It is deliberately **not** a mount animation: an earlier
version fired on mount, which made below-the-fold sections animate while off
screen. Variants are `up`, `fill`, `fillX`, `scale`, `left`, `right` and `soft`.

Two layout constraints follow from this:

- The `left`/`right` variants start translated on the X axis. That would widen the
  page, so `main` carries `overflow-x: clip`. This must **not** move to `html` or
  `body` — any non-visible overflow on those turns them into scroll containers and
  stops the viewport scrolling entirely. `clip` never creates a scroll container,
  so the sticky header keeps working.
- Sections carry `scroll-mt-24` for anchor landings. Do not also set
  `scroll-padding-top` on `html`; the two stack and double the gap.

Under `prefers-reduced-motion: reduce` every reveal renders at its final state with
`transition: none`, so no content is ever hidden behind an animation.

## API

Base path `/api`. All errors share one shape:

```json
{ "ok": false, "error": "validation_error", "message": "...", "fields": { "email": "..." } }
```

### `GET /api/health`

```json
{ "ok": true, "uptime": 12.34 }
```

### `GET /api/programmes`

Returns all six programmes, the organisation record, and a computed
`totalBeneficiaries` (35,500). Cacheable for 5 minutes.

### `POST /api/enquiries`

Body: `name`, `email`, `topic` (one of the five options in the form), `message`,
optional `organisation`. Optional `website` honeypot — if present, the request is
rejected.

```bash
curl -X POST http://localhost:4000/api/enquiries \
  -H 'content-type: application/json' \
  -d '{"name":"Amina Otieno","email":"amina@example.org","topic":"Partnership","message":"We would like to co-run a safe spaces programme."}'
```

`201` on success with `{ ok, id, receivedAt }`; `422` with per-field messages on
validation failure; `429` when rate limited.

### `GET /api/enquiries?topic=&limit=`

Operational read-back, newest first. `limit` is clamped to 1–200.

### `GET /api/content`

The managed-content overlay. Unauthenticated, because it contains nothing that
is not already published and the public site needs it to render. Cached for 60s.

```json
{ "ok": true, "content": { "pictures": [], "projects": [], "activities": [], "programmes": {}, "impact": {} } }
```

### `GET /api/admin/*`

See "The dashboard" below. Everything except `/session`, `/login` and `/logout`
requires the session cookie and answers `401` without it.

## The dashboard

The dashboard lives at **`/admin`**. It manages pictures, projects, activity
updates, programme details and the impact labels.

### Enabling it

```bash
ADMIN_PASSWORD='a long unique passphrase' \
ADMIN_SESSION_SECRET='a different long random string' \
npm start
```

The dashboard is **disabled entirely while `ADMIN_PASSWORD` is empty**, and every
write endpoint refuses requests in that state. A forgotten variable fails closed
rather than leaving content unprotected, and the sign-in screen says so instead of
silently rejecting writes.

`ADMIN_SESSION_SECRET` signs the session cookie. If it is unset, the password is
reused as the HMAC key and a warning is logged — that makes a stolen cookie and a
stolen password the same secret, so set a separate value before deploying.

### How authentication works

- One shared password, compared in constant time.
- A successful sign-in sets an expiring HMAC-signed `gs_admin` cookie:
  `HttpOnly`, `SameSite=Strict`, `Secure` in production. `HttpOnly` means XSS
  cannot read it; the server checks the signature on every request.
- Sign-in is rate limited to 10 attempts per 15 minutes (production only).
- The password is never stored, logged, or sent to the client.

### Storage

| What | Where | Notes |
| --- | --- | --- |
| Pictures, projects, activities, team, testimonials, policies, programme and impact overrides, enquiries | `data/website.db` | SQLite |
| Uploaded images | `data/uploads/` | Generated filenames |
| Schema | `db/schema.sql` | Applied at startup, committed to the repo |

Nothing the dashboard writes lives in `public/` or `dist/`. `dist` is replaced on
every deploy and `public/` is only copied at build time, so files added there
after a build would 404 in production. **Point `DATA_DIR` at a persistent volume
in production**, or a redeploy discards everything the dashboard has published —
`data/website.db` and `data/uploads/` both live there, so one mount covers the
database and the media.

`db/schema.sql` is the single source of truth for the schema; `server/sqlite.ts`
reads and applies it on first connection, so the schema is never duplicated in
code. To inspect the data:

```bash
sqlite3 data/website.db          # or: npx sqlite3 data/website.db
```

Overrides are stored sparsely, exactly as they were in the JSON file: a row in
`programmes` exists only where the operator has changed something, and a `NULL`
column means "not overridden", so a one-field edit never blanks the static
defaults in `shared/content.ts`.

Uploads are validated by MIME type and capped at `MAX_UPLOAD_BYTES` (default 8
MiB). SVG is rejected: it is a scriptable document, so serving one from the site's
own origin would be a stored-XSS vector. Filenames are generated, never taken from
the client, and `imageAlt` is required whenever an image is set — an undescribed
photo is invisible to screen readers.

### Migrating from the JSON store

Content used to live in `data/content.json` and `data/enquiries.json`. Those files
are no longer read. To import an existing installation:

```bash
npm run migrate:sqlite
```

The script keeps the original record ids and timestamps, so published links and
sort order are unchanged, and it validates every record against the same schemas
the API uses — a record that no longer parses is reported and skipped rather than
aborting the run. It refuses to run against a database that already has content
unless you pass `--force`, so a second run cannot silently duplicate your gallery.

Keep the JSON files as a backup after importing.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/session` | Is the operator signed in? |
| `POST` | `/api/admin/login` | Exchange a password for the cookie |
| `POST` | `/api/admin/logout` | Clear the cookie |
| `GET` | `/api/admin/content` | Full managed content |
| `POST` | `/api/admin/content/reset` | Discard all overrides and delete uploads |
| `POST` | `/api/admin/uploads` | Multipart `image` field → `{ src }` |
| `POST` `PUT` `DELETE` | `/api/admin/pictures[/:id]` | Gallery pictures |
| `POST` `PUT` `DELETE` | `/api/admin/projects[/:id]` | Field projects |
| `POST` `PUT` `DELETE` | `/api/admin/activities[/:id]` | Field updates |
| `PATCH` | `/api/admin/programmes/:id` | Sparse programme override |
| `PATCH` | `/api/admin/impact` | Sparse impact copy override |

## Where does storage live?

Storage is SQLite, through `server/sqlite.ts`. That module owns the connection
(opened lazily on first use, in WAL mode, with foreign keys on) and applies
`db/schema.sql`. Everything above it — `content-store.ts` and `store.ts` — keeps
exactly the interface it had when it was backed by JSON files, so `admin-routes.ts`
and `routes.ts` do not know or care which store is behind them. To move to
PostgreSQL or another driver, reimplement those two modules; nothing else in the
codebase touches storage.

Transactions replace what the JSON primitive used to guarantee. The old
`JsonFile` wrote to a temp file and renamed, so a crash could not leave a
half-written file, and it serialised mutations through a promise queue so two
concurrent requests could not drop a record. SQLite gives both natively: a
multi-row write is atomic, and the count-then-insert that enforces a record
ceiling runs inside the same transaction, so two concurrent saves cannot both slip
under the limit.

Managed content is still re-validated on every read. Requests are validated
before they reach SQL, so these checks should never fire — but rows can also
arrive via the one-time JSON import, and a record that no longer parses should
cost you that one picture, not the whole dashboard.

To email enquiries, add a transport call in the `POST /enquiries` handler after
`saveEnquiry` resolves.

## Security

- **Rate limiting** — 5 enquiries per IP per 15 minutes, plus 10 sign-in attempts
  per IP per 15 minutes. Enforced only when `NODE_ENV=production` so local
  iteration is not throttled.
- **Honeypot** — a hidden `website` field; bots that fill it are rejected.
- **Payload cap** — `express.json({ limit: '64kb' })`, plus an 8 MiB image cap on
  the upload route.
- **Image sources are allow-listed** — `/uploads/...`, `/assets/...` or `https:`.
  Without this a stored `javascript:` in an `img src` would reach the validator on
  the next read, since the import script bypasses request-time schemas.
- **Zod validation** on every field, shared verbatim with the client so the two
  can never disagree.
- **Uploaded files are inert** — `nosniff` and a restrictive
  `Content-Security-Policy: default-src 'none'` on `/uploads`.
- **Security headers** — `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`; `x-powered-by` disabled.
- **No secrets in the repo** — `.env*` is gitignored, `.env.example` documents
  every variable.

Set `TRUST_PROXY_HOPS` to the number of proxies in front of the app when
deploying behind nginx/Fly/Render/Cloudflare, otherwise rate limiting will see
the proxy's IP instead of the client's.

The dashboard fails closed: no `ADMIN_PASSWORD` means no write endpoint accepts a
request, and the session cookie is `HttpOnly` + `SameSite=Strict` so XSS cannot
read or ride it.

## Accessibility

- Semantic landmarks, a skip link, and labelled form fields.
- Programme cards are proper disclosures (`aria-expanded` / `aria-controls`);
  Escape closes an open programme.
- The carousel is a labelled region with arrow-key navigation, swipe, dots with
  `aria-selected`, and a polite live region.
- Errors are tied to inputs with `aria-invalid` + `aria-describedby` and
  announced via a `role="status"` live region.
- `prefers-reduced-motion` disables the counters, carousel autoplay and reveals.
- The dashboard reuses the same conventions: a skip link, real `label`/`id`
  pairs, `aria-invalid` + `aria-describedby` on invalid fields, `role="alert"`
  for errors, `role="status"` for confirmations, and a proper tab pattern.
- Alt text is enforced server-side wherever an image is stored, so an
  accessibility regression cannot be published from the dashboard.

## Deployment

The app is a **single Node process**. Express serves the API *and* the built site
from `dist/`, and hosts `/admin` from the same origin. There is no separate
frontend to deploy and no rewrite rules to keep in sync — which is why the
dashboard keeps working in production instead of 404ing the way a purely
client-side route does on a static host.

### Pick your target

| Target | Guide |
| --- | --- |
| Docker host, VPS, Render, Railway, Fly.io | [Container](#container-recommended) below |
| **cPanel / CloudLinux / Passenger** | **[docs/cpanel.md](docs/cpanel.md)** — read this one, it differs in important ways |

### What `npm run build` produces

```
dist/          the built site, including the separate dist/admin/index.html
dist-server/   the whole deployable server
```

`dist-server/` is self-contained: compiled JavaScript for `server/` and
`shared/`, plus copies of `dist/` and `db/`. It is what gets deployed, and the
one directory to upload when the host is not running Docker.

The server is **compiled, not run as TypeScript.** Node can only execute `.ts`
files directly from 22.18 onward, and shared hosting commonly offers Node 18 or
20, so `node server/index.ts` cannot work there. Nothing TypeScript-related is
needed at runtime — no `tsx`, no type stripping. It runs on Node 18+.

### Container (recommended)

Works as-is on Render, Railway, Fly.io, DigitalOcean, Azure Container Apps, AWS
ECS, or any VPS with Docker.

```bash
docker compose up --build          # local
# or, with real secrets in the environment:
docker build -t golden-steps .
docker run -p 4000:4000 \
  -e ADMIN_PASSWORD=... -e ADMIN_SESSION_SECRET=... \
  -e DATA_DIR=/data -v golden-steps-data:/data \
  golden-steps
```

Two things in the image are load-bearing rather than cosmetic:

- **`tini` as PID 1.** Without an init, PID 1 does not receive `SIGTERM`, so the
  graceful shutdown in `server/index.ts` never runs and SQLite is left with a
  stale `-wal` file on every deploy. Recoverable, but it means the database and
  its writes live in two files.
- **A persistent volume at `/data`.** It holds both `website.db` and
  `uploads/`. Without one, every redeploy discards the dashboard's content.

`better-sqlite3` is a native module, so the build stage installs `python3`,
`make` and `g++` and the runtime stage copies the compiled result across. Both
stages use the same base image and architecture, so the binary matches and does
not need rebuilding. `db/` ships in the image because the schema is read at
startup.

### Any host with a Node runtime (no Docker)

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

Set `NODE_ENV=production` — it enables rate limiting and the `Secure` flag on
the session cookie. Behind a proxy, set `TRUST_PROXY_HOPS` to the number of hops,
or rate limiting sees the proxy's IP instead of the client's.

> `npm start` runs `node dist-server/server/index.js` — compiled JavaScript, so
> it works on Node 18 and up. For cPanel and Passenger, point the startup file at
> `app.js` instead; see [docs/cpanel.md](docs/cpanel.md). To run with your local
> `.env` file, use `npm run start:local`.

### Required environment

Set these on the platform; do not ship a `.env` file in the image.

| Variable | Why |
| --- | --- |
| `ADMIN_PASSWORD` | Enables `/admin`. Empty disables the dashboard entirely. |
| `ADMIN_SESSION_SECRET` | Signs the session cookie. **Separate from the password** — a stolen cookie should not be the same secret as a stolen password. |
| `DATA_DIR` | Persistent storage path. Point it at a container filesystem without a volume, or inside the application directory, and content is lost on redeploy. |
| `NODE_ENV` | `production`. |
| `TRUST_PROXY_HOPS` | Proxy hop count, when behind nginx/Caddy/a platform proxy. |

### Not losing data on redeploy

This is the single most expensive mistake available in this deployment, and it
fails silently: without a persistent `DATA_DIR` the app starts normally, creates
an empty database, and serves a perfectly working site with no content in it.
The operator adds content, the next deploy replaces the container, and it is
gone with no message at any point.

So the app checks, and says so:

- **At startup**, a full-width warning on the error log if `DATA_DIR` is not
  persistent, or if it sits inside the application directory.
- **On `/api/health`**, a `storage` block you can assert on:

  ```bash
  curl -s localhost:4000/api/health | grep -q '"durability":"durable"' \
    && echo persistent || echo AT RISK
  ```

Backing up:

```bash
npm run backup                       # writes ./backups/<timestamp>/
npm run restore -- ./backups/<timestamp>
```

The backup covers both halves of the data — `website.db` **and** `uploads/` —
because restoring the database without the policy PDFs leaves every policy row
pointing at a missing file.

> **Never copy `website.db` by hand.** It runs in WAL mode, so recent commits sit
> in a separate `website.db-wal` file until a checkpoint. Copying the `.db` alone
> can yield a file that opens cleanly but has lost recent writes, or is missing
> whole tables. `npm run backup` uses SQLite's own consistent-snapshot mechanism.

### The two HTML entries

The build emits **two** entries:

| Entry | Output | Purpose |
| --- | --- | --- |
| `index.html` | `dist/index.html` | The public site |
| `admin/index.html` | `dist/admin/index.html` | The dashboard |

Public visitors never download admin code. On the Express server `/admin`
resolves through the SPA fallback, and the client selects the dashboard by
pathname — the separate entry is a second, equivalent route to the same
`AdminApp`, not a different one.

The second entry exists for **static hosting**. A client-side `/admin` route
depends on a server catch-all that rewrites unknown paths to `index.html`;
static hosts have no such fallback and return 404 for a path with no file
behind it, while the public site keeps working because `/index.html` does
exist. Shipping a real `dist/admin/index.html` means `/admin` resolves on
Vercel, Netlify, Cloudflare Pages and GitHub Pages with no host-specific
rewrite rules.

> **A static host alone cannot run the dashboard.** It serves the built files
> but has no API and no writable disk, so sign-in, saving and uploads all fail.
> The dashboard needs the Node process for `/api/admin/*`, `/uploads` and the
> database. If you must host the frontend separately, set `VITE_API_BASE_URL` at
> **build time** to a running API — but note the session cookie is same-origin
> and `SameSite=Strict`, so a cross-origin API needs matching CORS and cookie
> attributes, which is far more work than just running one container.

### Before going live

- [ ] `ADMIN_PASSWORD` set to a long, unique passphrase.
- [ ] `ADMIN_SESSION_SECRET` set, and **different** from the password.
- [ ] `DATA_DIR` on a persistent volume.
- [ ] **The volume is writable by UID 1000.** The container runs as `node`, and
      a mounted volume takes the host's ownership rather than the image's. If it
      is root-owned, every save and upload fails with a permissions error while
      reads keep working — which looks like an application bug rather than a
      mount problem. Bind mounts need `sudo chown -R 1000:1000 /path/to/data`
      on the host; on a PaaS, set the volume's user to UID 1000.
- [ ] `NODE_ENV=production` and HTTPS. The session cookie is `Secure` in
      production, so a plain-HTTP deploy fails sign-in even though everything
      else works — check this first if the password is accepted but the session
      never sticks.
- [ ] `TRUST_PROXY_HOPS` set if behind a proxy.
- [ ] Uploaded media backups: the volume holds `website.db` **and** the policy
      PDFs. A database backup alone leaves the published documents unreachable.
- [ ] Convert the deck PNGs to WebP/AVIF (see the notes below).

## Notes on the assets

Images were moved from the original `assets/` folder to `public/assets/` so Vite
serves them (and so they can be swapped for a CDN or an image pipeline later).
Paths in `shared/content.ts` are absolute (`/assets/Picture1.png`).

The hero and gallery images are 340 KB–1.1 MB PNGs straight from the deck. They
are lazy-loaded and served with correct dimensions to avoid layout shift, but for
a production launch you should convert them to WebP/AVIF and drop in responsive
`srcset` variants. The six photographs are credited as Golden Steps' own
community documentation.

Images uploaded through the dashboard are served from `/uploads` with a
`7d` cache and must **not** be added to `public/assets/` — anything placed there
is copied at build time and would be lost on the next deploy.

**Reset content is destructive to files.** It clears the managed records *and*
empties `data/uploads/`, so an image that was uploaded but never saved as a
picture record is also reclaimed. Deleting a single picture removes only that
picture's file. Seeded photographs in `public/assets/` are never touched.
