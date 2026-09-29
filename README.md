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
| Backend | Express 5 (TypeScript, run directly by Node 24's type stripping) |
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
npm run build      # typecheck + production bundle into dist/
npm start          # run the API, serving dist/ when it exists
npm run preview    # serve the built site via Vite
npm test           # API integration tests
npm run lint       # ESLint (flat config, zero warnings tolerated)
npm run typecheck  # tsc project references
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
server/          Express API (TypeScript, no build step)
  index.ts         App factory, static hosting, error handling
  routes.ts        /api/health, /api/programmes, /api/content, /api/enquiries
  admin-routes.ts  /api/admin/* — session, content CRUD, uploads
  auth.ts          Password check, HMAC session cookie, requireAdmin
  uploads.ts       Multer config, MIME allow-list, error translation
  content-store.ts Managed content: read, create, update, delete, patch
  json-file.ts     Atomic, serialised JSON persistence helper
  paths.ts         Every runtime-writeable path, from DATA_DIR
  store.ts         Enquiry persistence
  api.test.ts      Enquiry and public API integration tests
  admin.test.ts    Auth, CRUD, upload and content tests
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
| Pictures, projects, updates, overrides | `data/content.json` | Sparse overrides only |
| Uploaded images | `data/uploads/` | Generated filenames |
| Enquiries | `data/enquiries.json` | |

Nothing the dashboard writes lives in `public/` or `dist/`. `dist` is replaced on
every deploy and `public/` is only copied at build time, so files added there
after a build would 404 in production. **Point `DATA_DIR` at a persistent volume
in production**, or a redeploy discards everything the dashboard has published.

Uploads are validated by MIME type and capped at `MAX_UPLOAD_BYTES` (default 8
MiB). SVG is rejected: it is a scriptable document, so serving one from the site's
own origin would be a stored-XSS vector. Filenames are generated, never taken from
the client, and `imageAlt` is required whenever an image is set — an undescribed
photo is invisible to screen readers.

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

`server/json-file.ts` is the single persistence primitive: it appends via
write-then-rename, so a file is never left half-written, and serialises concurrent
writes through a promise queue so two simultaneous requests cannot drop a record.
Both `store.ts` (enquiries, capped at `MAX_ENQUIRY_RECORDS`, default 10,000) and
`content-store.ts` (dashboard content) are built on it.

Managed content is re-validated on every read rather than trusted because the
file is hand-editable and survives deploys. A record that no longer parses costs
you that one picture, not the whole dashboard — and it can never smuggle an
unsafe `src` past the request-time schemas, since the file bypasses them.

That is deliberately the simplest thing that works for a single-instance
deployment. To move to a real database, reimplement the exported functions in
`store.ts` and `content-store.ts` against your driver — nothing else in the
codebase touches storage.

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
  the next read, since the JSON file bypasses request-time schemas.
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

Build once, run the API — it serves `dist/` as static files when present:

```bash
npm ci
npm run build
NODE_ENV=production PORT=4000 npm start
```

The dashboard is a separate lazy chunk, so public visitors never download admin
code. The same process serves `/admin` through the SPA fallback, and the client
selects the dashboard by pathname.

Put nginx/Caddy in front for TLS. Remember `TRUST_PROXY_HOPS=1`.

Before going live:

- Set `ADMIN_PASSWORD` and a separate `ADMIN_SESSION_SECRET`.
- Point `DATA_DIR` at a persistent volume.
- Convert the deck PNGs to WebP/AVIF (see the notes below).

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
