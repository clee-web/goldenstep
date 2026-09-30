# Starting the cPanel deploy from scratch

This is a clean-slate walkthrough, for a cPanel account with no Golden Steps
application on it yet. It assumes the repository is on GitHub and that cPanel
pulls from it.

Every claim in here that could be checked has been checked. Where something
depends on the host and could not be checked, it says so.

---

## 0. Before anything else: back up your content

Your content is **not in Git**. `data/` is git-ignored on purpose — that is what
stops a deploy from overwriting it. The consequence is that the only copy of
your projects, policies, pictures, enquiries and uploaded PDFs is the copy on
your own machine.

If that machine is lost, so is the site. Do this before touching cPanel:

```
npm run backup
```

That writes to `backups/`. Copy that folder somewhere that is not this laptop —
cloud storage, a USB stick, an email to yourself. A backup that lives on the
same disk as the thing it protects is not a backup.

`npm run backup` deliberately uses SQLite's `VACUUM INTO` rather than copying
`website.db`. Copying the file directly in WAL mode has been observed to produce
a backup missing an entire table while the live database still had rows in it.
Use the command, not `cp`.

---

## 1. Create the content directory, outside the application

Do this **before** creating the application, and do it once.

cPanel replaces the application's root directory on every deploy. Anything stored
inside it is destroyed on the next deploy. That is the whole reason content kept
disappearing: the content was living in the application directory.

In cPanel → **File Manager**, create a folder called `golden-steps-data`
alongside `public_html`, so the full path is:

```
/home/USERNAME/golden-steps-data
```

The application root will be `/home/USERNAME/nodejsapp`. The content directory
is a **sibling** of it, not a child. `data/` inside `nodejsapp/` would be wiped
on the next deploy.

You do not have to create it here — the app creates it if it is missing — but
creating it yourself means the permissions are right from the start.

---

## 2. Create the Node.js application

cPanel → **Setup Node.js App** → **Create Application**.

| Field | Value | Why |
|---|---|---|
| Node.js version | **20 or 22** | See the warning below — this one matters. |
| Application mode | `Production` | |
| Application root | `nodejsapp` | The conventional default. If you change it, change `DEPLOYPATH` in `.cpanel.yml` to match. |
| Application URL | your domain, or a subdomain | |
| Application startup file | `app.js` | Not `dist-server/server/index.js` — `app.js` is the cPanel entry point. |

### The Node.js version is not a detail

SQLite comes from `node:sqlite`, which is compiled into the Node binary, so
there is no native module to build and no compiler to need. `npm ci` is a pure
JavaScript install on any platform.

The one requirement is that **`node:sqlite` exists at all**: it landed in Node
22.5. So:

- Node **24** — what this project is developed and released against.
- Node **22.5+** — fine.
- Node **20 or older** — `node:sqlite` is missing and the app cannot read its
  own content. `package.json` states the floor in `engines`, so an unsuitable
  version is refused at install rather than failing later on every request.

If you must use an older version, the fix is to change the version in cPanel
rather than to work around it.

---

## 3. Set the environment variables

In the same **Setup Node.js App** screen, under Environment Variables:

| Variable | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | Yes |
| `DATA_DIR` | `/home/USERNAME/golden-steps-data` | **Yes — see below** |
| `ADMIN_PASSWORD` | your admin password | Yes |
| `ADMIN_SESSION_SECRET` | a long random string | Yes |
| `TRUST_PROXY_HOPS` | `1` | Yes, if there is a proxy in front (cPanel usually is) |

`DATA_DIR` is the one that decides whether your content survives. It must point
**outside** `nodejsapp`. Generate the session secret with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Leaving `ADMIN_PASSWORD` empty does not open the site up — it disables `/admin`
entirely and makes every write fail. If sign-in is not working, check this
variable is actually set.

---

## 4. Deploy from GitHub

The repository contains a `.cpanel.yml` that installs dependencies, builds, and
verifies the result before restarting. Because `dist-server/` is git-ignored, the
build has to happen on the host — that is what the file is for.

cPanel → **Application Manager** → find the application → **Deploy** → connect
the GitHub repository. Or, if your cPanel only offers **Git™ Version Control**,
clone the repository there and use **Deploy HEAD Commit** to run the tasks.

**cPanel does not set `DEPLOYPATH`.** Its own documentation has you export it as
the first task, which is what `.cpanel.yml` does. If you changed the application
root away from `nodejsapp`, edit the first line of `.cpanel.yml` to match.

`scripts/cpanel-deploy.sh` handles both cPanel layouts on its own. Application
Manager clones the repository straight into the application root, so there is
nothing to copy; Git™ Version Control clones it elsewhere, so the script copies
the source across. Either way the build ends up in the right place.

The deploy log ends with the content directory it is using. Read that line. If it
says `NOT SET - content will be lost on redeploy`, stop and set `DATA_DIR`.

### What the deploy does, in order

1. Copies the source into the application root.
2. Checks Node is 18.20 or newer.
3. `npm ci` — installs **devDependencies too**, because the build needs them.
   This is why the install is large.
4. `npm run build`.
5. Checks `dist-server/server/index.js`, `db/schema.sql`, `dist/index.html` and
   `dist/admin/index.html` all exist.
6. Writes a marker file, then restarts.

If any step fails, the deploy stops **before** the restart, so the previous
version keeps serving. A deploy that fails loudly is recoverable; one that
succeeds onto a half-built directory is not.

---

## 5. Check it actually worked

```
curl -s https://YOUR-DOMAIN/api/health
```

You want `"ok":true`, and inside `storage` you want:

- `"durability":"durable"`
- `"dataDir":"/home/USERNAME/golden-steps-data"` — your directory, not `nodejsapp`

If `durability` says `ephemeral`, the content is on temporary storage and will
be lost when the account is suspended or the host reboots. Fix `DATA_DIR`.

Then open the site and check `/admin/` loads and you can sign in.

**Sign-in needs HTTPS.** The session cookie is set with the `Secure` flag, so
over plain `http://` the browser silently discards it and you will be told your
password is wrong when it was correct. If the site has no SSL certificate,
install one first (cPanel → **SSL/TLS Status** → **Run AutoSSL**) — it is free
and automatic.

---

## 6. Put your content back

Now restore the backup from step 0. Sign in to `/admin/` and use the restore
option, or copy the backup's database into the content directory.

Check the counts afterwards — `/api/health` and the dashboard should show your
projects and policies. If you see an empty dashboard after a deploy, this is the
first thing to check, and it is nearly always `DATA_DIR` pointing inside the
application root.

---

## If something goes wrong

| Symptom | Cause |
|---|---|
| Deploy says OK, site is empty | `DATA_DIR` inside the application root, or inside the repository |
| `node-gyp` / `make: not found` during deploy | A native module crept back into the dependencies. There should be none; check `package.json`. |
| `GLIBC_x.yy not found` for a `.node` file | A native module built on a newer glibc than the host. The fix is `node:sqlite`, not a rebuild. |
| `Can't acquire lock for app` | A script started via **Run NPM Script** is still running; it has no Stop button and holds the lock forever. Restart the application. |
| Sign-in always fails, password is right | No HTTPS. Install AutoSSL. |
| `npm: command not found` in the deploy log | `scripts/cpanel-deploy.sh` could not find Node. It looks in the Node.js Selector paths; tell me and I will extend the search. |
| Deploy fails at the build step | The build output is in the log above the error. The app is still serving the old version. |
| Content vanished after a deploy | `DATA_DIR` was inside the application root. Restore from backup. |
