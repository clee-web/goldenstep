# Deploying to cPanel (CloudLinux / Passenger)

This is the setup for Safaricom cPanel and any other CloudLinux host running
Passenger. It is different from the Docker deployment in the README, and the
differences matter — several of the errors seen on these hosts come from
following the Docker instructions instead.

## The three things that cause almost every problem

### 1. The server is compiled JavaScript, not TypeScript

`server/index.ts` is **never run directly in production**. `npm run build`
compiles it to `dist-server/server/index.js`.

This is not a stylistic choice. Node can only execute `.ts` files directly from
**22.18** onward. Shared hosting usually offers Node 18 or 20, where
`node server/index.ts` fails outright with an unknown-file-extension error. The
compiled output runs on Node 18 and later.

So there is no `tsx`, no type stripping, and nothing TypeScript-related at
runtime. If a startup command mentions `tsx` or a `.ts` file, it is wrong.

### 2. `DATA_DIR` must point outside the application directory

The database and every uploaded file live in `DATA_DIR`. If it sits inside the
application directory, **redeploying by replacing that directory deletes all
content** — silently, with no error in any log. This is the most common reason
content "disappears on redeploy" on shared hosting.

Put it somewhere stable in your home directory and never upload over it:

```bash
mkdir -p ~/golden-steps-data/uploads
chmod 700 ~/golden-steps-data
```

Then set `DATA_DIR=/home/CPANELUSER/golden-steps-data` in the environment
variables field.

The application checks this at startup and prints a warning to the error log if
`DATA_DIR` is inside the application directory, or if it is not on persistent
storage. **Read the error log after the first deploy** — those two warnings
explain most "I lost my data" reports.

### 3. The Node.js version decides whether `npm install` works at all

`better-sqlite3` is a native module — compiled C++, not JavaScript. Shared hosts
do not have a C++ compiler, so `npm ci` has to download a **prebuilt binary**
matching both the platform and the exact Node version. With no prebuild and no
compiler, the install fails with a `node-gyp` error ending in `not found: make`.

The pinned version (`~12.9.0`) has prebuilt Linux x64 binaries published for
Node **20**, **22** and **24**. It has none for Node **18**, and the `13.x` line
publishes none at all — which is why this dependency is pinned to `~12.9.0`
rather than tracking latest. `12.9.1` appears to exist as a GitHub release but
was never published to npm, so `~12.9.0` is the highest safe pin.

**Use Node 20 or 22 in cPanel.** Verified on Linux with no compiler present:
Node 22 + `better-sqlite3@12.9.0` installs from a prebuild and runs; Node 22 +
`better-sqlite3@13.0.3` tries to compile and fails.

Note the interaction with the point above: the *compiled server* runs on Node 18+
, but the *dependency install* needs a Node version with a prebuild. Node 20 and
22 satisfy both.

## Step by step

### 1. Create the Node.js application

In cPanel → **Setup Node.js App**:

| Field | Value |
| --- | --- |
| Node.js version | **20 or 22** (see note below — 18 can break dependency installation) |
| Application mode | Production |
| Application root | `nodejs/goldensteps` (or whatever you choose) |
| Application URL | your domain or subdomain |
| Application startup file | `app.js` |

`app.js` is a thin wrapper that starts `dist-server/server/index.js`. It also
fails with a clear message if you have not uploaded a build.

### 2. Environment variables

cPanel → **Setup Node.js App** → your app → **Environment variables**:

| Variable | Value | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables rate limiting and the `Secure` session cookie. |
| `DATA_DIR` | `/home/CPANELUSER/golden-steps-data` | **Must be outside the app directory.** |
| `ADMIN_PASSWORD` | a strong password | Enables `/admin`. Empty disables the dashboard entirely. |
| `ADMIN_SESSION_SECRET` | `openssl rand -hex 32` | Signs the session cookie. Different from the password. |
| `TRUST_PROXY_HOPS` | `1` | Passenger proxies, so rate limiting would otherwise see the proxy's IP. |

Generate the session secret:

```bash
openssl rand -hex 32
```

> **HTTPS is required.** The session cookie is `Secure`, so over plain HTTP the
> browser discards it and sign-in silently fails on every attempt. If the site
> is not yet on HTTPS, `/admin` will not work however correct everything else is.

### 3. Upload and build

There are two viable paths. With the Git-based deploy, skip this upload step and use the `.cpanel.yml` in the repo (see [docs/fresh-start.md](./fresh-start.md)).

For a manual upload: the build must run on a machine with the full toolchain,
then be uploaded. Building on the host requires the same Node version with
prebuilt binaries. Build locally instead:

```bash
npm ci
npm run build
```

That produces `dist-server/`, which contains **everything** the application
needs at runtime:

```
dist-server/
  server/   compiled JavaScript
  shared/   compiled JavaScript
  dist/     the built site
  db/       the schema, read at startup
```

Upload to your application root:

- `dist-server/`
- `app.js`
- `package.json`
- `package-lock.json`

### 4. Install dependencies on the server

Via **Run NPM Install** in cPanel, or in the terminal:

```bash
cd ~/nodejs/goldensteps
npm ci --omit=dev
```

Use `npm ci`, not `npm install`: it installs exactly what the lockfile pins.

#### If you get `Cannot find package 'compression'` or a Zod error

`compression` is a normal runtime dependency, so that error means the install
did not complete. A Zod error like *"`zod/v4/classic/external.js` is not a
public entry point"* has the same cause — a half-installed or mixed-up
`node_modules`. This project's own code imports only `import { z } from 'zod'`,
the correct public entry point, so the project is not the problem.

**Never upload `node_modules` from your own machine.** A local install contains
platform-specific binaries — `better-sqlite3` is compiled for your operating
system and will not load on the server. Delete and reinstall on the server:

```bash
cd ~/nodejs/goldensteps
rm -rf node_modules
npm ci --omit=dev
```

If a lockfile problem is suspected, deleting the lockfile and reinstalling will
resolve it, but then commit the regenerated `package-lock.json` locally so the
two stay in step.

### 5. Check better-sqlite3 loads

`better-sqlite3` is a native module and needs to be compiled for the host. If the
install succeeded, that already happened, but confirm it explicitly:

```bash
cd ~/nodejs/goldensteps
node -e "const D=require('better-sqlite3');const d=new D('/tmp/t.db');d.exec('CREATE TABLE x(a)');console.log('better-sqlite3 OK');d.close()"
```

If that prints an error about a missing shared library, the host cannot build
native modules. Ask Safaricom support to enable it, or deploy somewhere that
allows it (Docker on a VPS, Render, Railway, Fly.io). The dashboard cannot run
without this module.

### 6. Start it and verify

Hit **Restart** in cPanel, then:

```bash
curl -s https://yourdomain/api/health
```

A working install reports:

```json
{
  "ok": true,
  "uptime": 12.3,
  "storage": {
    "durability": "durable",
    "dataDir": "/home/youruser/golden-steps-data",
    "detail": "... is on its own mount at ..., so it survives a redeploy."
  }
}
```

**Check `storage.durability` is `durable`.** If it says `ephemeral`, content
will be lost on redeploy. Also confirm `/admin` loads and you can sign in.

## Redeploying without losing content

1. Build locally: `npm run build`
2. Upload `dist-server/`, `app.js`, `package.json`, `package-lock.json`
3. `npm ci --omit=dev` if dependencies changed
4. Restart

Never delete the application root, and never put `DATA_DIR` inside it.

## Backing up

```bash
cd ~/nodejs/goldensteps
npm run backup -- --out /home/youruser/backups
```

Run this over SSH, **not** through cPanel's **Run NPM Script** button. The backup
finishes on its own so it will not normally wedge anything, but it is one long
`npm` invocation in the same directory the Selector locks, and SSH is the safer
place for it. See "Can't acquire lock for app" below for what happens if it does.

To restore:

```bash
npm run restore -- /home/youruser/backups/2026-09-30T12-00-00
```

**Do not copy `website.db` by hand.** The database runs in WAL mode, so recent
commits sit in a separate `website.db-wal` file until a checkpoint. Copying the
`.db` on its own can produce a file that opens cleanly but has silently lost
recent writes, or is missing whole tables. The backup script uses SQLite's own
consistent-snapshot mechanism, so it is always correct. Copying `uploads/` is
safe but still required — the policy PDFs are not in the database.

## "Can't acquire lock for app: %(app)s"

This one is worth separating out, because it looks like an application error and
is not. It comes from CloudLinux's Node.js Selector, and it means **the app never
started** — nothing in this project ran, and no amount of changing the code will
clear it.

`Setup Node.js App` writes a `.lock` file into the application root every time it
acts on the app — start, stop, restart, or **Run NPM Install**. The lock guarantees
only one operation touches the app at a time. The usual cause is a script started
through **Run JS Script / Run NPM Script**: unlike start and stop, that has no Stop
button, so the process keeps running in the background holding the lock forever.
Every subsequent action fails with this message.

### Fix

Remove the stale lock file in the application root:

```bash
cd ~/nodejs/goldensteps
ls -la | grep lock
rm -f .lock
```

Then press **Restart** in cPanel.

If the error returns immediately, something is relaunching the process. Check for
a cron job or script that starts the app outside cPanel:

```bash
crontab -l
```

If a process is genuinely still running and holding the lock, and you have SSH
access, find and stop it:

```bash
lsof -u "$(whoami)" | grep lock
kill -9 <pid>
```

On shared hosting without root, that last step is not available to you — open a
ticket with Safaricom and ask them to clear the locked process for your
application. They can do it in seconds.

### Do not run long-lived scripts through the Node.js Selector UI

This is what causes the lock in the first place, and it applies directly to the
`npm run backup` command above. It exits on its own, so it is usually fine, but a
script that *never exits* started through **Run NPM Script** will wedge the app
permanently and you will not be able to restart it from cPanel.

- **Short-lived, exits by itself** (backup, migrate) — acceptable, but prefer SSH.
- **Anything long-lived** — do not use the Selector UI. Shared hosting has no
  process manager, and this app does not need one: it is a single Express process
  that the Selector already supervises.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Can't acquire lock for app` | Stale `.lock` from a script started via Run NPM Script. See above. Nothing in the app ran. |
| Blank site, or 404 on `/admin` | Not built, or `app.js` missing from the application root. |
| `/admin` 404 but the site works | The build is stale. Re-run `npm run build` and upload `dist-server/`. |
| Cannot sign in | Not on HTTPS, so the `Secure` cookie is dropped. |
| `Cannot find package 'compression'` | Install did not finish. See step 4. |
| Zod `not a public entry point` | Mixed or partial `node_modules`. See step 4. |
| `tsx/dist/cli.mjs` not found | The startup file is wrong. Use `app.js`. |
| Dashboard empty after redeploy | `DATA_DIR` is inside the application directory. |
| `EACCES` or `SQLITE_CANTOPEN` | Wrong owner or permissions on `DATA_DIR`. It must be writable by the cPanel user running the app. |
| Content saved but not shown publicly | The browser is caching. Hard-reload. |
| Everything blank and no log output | Wrong Node version, or a build that did not complete. Check the cPanel error log. |
