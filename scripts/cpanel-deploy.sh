#!/bin/bash
#
# Build script invoked by .cpanel.yml. Kept as a real file rather than inlined
# into the YAML for three reasons:
#
#   1. It can be run and tested on its own. The deploy path is the part of this
#      project that cannot be exercised until a real host exists, so it is
#      written to be runnable by hand: `./scripts/cpanel-deploy.sh`.
#   2. Finding `node` and `npm` needs several lines of fallback logic. Inline in
#      YAML that becomes unreadable and unquotable.
#   3. It is the only place that knows the build has to happen inside the app
#      root, not in the repository clone. cPanel clones the repository somewhere
#      of its own choosing and the tasks copy files out into the app root, so the
#      clone directory and the app root are not the same place. Building in the
#      clone produces a `dist-server/` that the app never reads.

set -u
set -o pipefail

# cPanel does not set DEPLOYPATH; the official documentation has the user export
# it as the first task in .cpanel.yml. Fall back to the conventional location so
# this script also works when run by hand.
DEPLOYPATH="${DEPLOYPATH:-$HOME/nodejsapp}"

log()  { echo "[deploy] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Find node and npm.
#
# The deployment shell is non-interactive, so it does not load the shell
# profile. On most cPanel accounts `node` and `npm` are therefore NOT on PATH
# here even though the account has a perfectly good Node.js install selected in
# cPanel. Aborting with a clear message beats a "npm: command not found" that
# leaves a half-deployed directory behind.
# ---------------------------------------------------------------------------
find_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  local candidate
  # Node.js Selector / Application Manager virtual environments.
  for candidate in "$HOME"/nodevenv/*/bin; do
    if [ -x "$candidate/node" ]; then
      PATH="$candidate:$PATH"
      export PATH
      return 0
    fi
  done

  # CloudLinux Node.js Selector and plain system installs.
  for candidate in /opt/cpanel/engines/node/*/bin /usr/local/bin /usr/bin; do
    if [ -x "$candidate/node" ]; then
      PATH="$candidate:$PATH"
      export PATH
      return 0
    fi
  done

  # nvm, if the account has it. NVM_DIR is not set in a non-interactive shell.
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
    command -v node >/dev/null 2>&1 && return 0
  fi

  return 1
}

find_node || fail "could not find node. Install a Node.js version in cPanel (Setup Node.js App, or CloudLinux Node.js Selector) and try again."

NODE_VERSION="$(node --version)"
NPM_VERSION="$(npm --version 2>/dev/null || echo unknown)"
log "node $NODE_VERSION, npm $NPM_VERSION"
log "app root: $DEPLOYPATH"

# A release must run on Node 18.20 or newer. See package.json "engines".
#
# Note the destructuring offset: process.versions.node is "22.18.0", so
# split(".") is ["22","18","0"] and the major version is the SECOND element.
# Writing `[,,maj,min]` here reads maj as 0 and rejects every version
# whatsoever, which looks exactly like a cPanel misconfiguration.
node -e '
const [maj, min] = process.versions.node.split(".").map(Number);
const ok = maj > 18 || (maj === 18 && min >= 20);
if (!ok) {
  console.error("node " + process.versions.node + " is older than the required 18.20");
  process.exit(1);
}
' || fail "this Node.js version is too old. The compiled server needs 18.20 or newer. Change the version in cPanel (Setup Node.js App) and deploy again."

# ---------------------------------------------------------------------------
# Copy the source into the app root.
#
# node_modules is deliberately left alone. It is large, and `npm ci` below
# replaces it wholesale anyway; deleting it first only makes the deploy slower
# and fails harder when the account is near its disk quota.
#
# DATA_DIR is not copied, and is not touched. It lives outside this directory by
# requirement, which is the whole reason content survives a redeploy.
# ---------------------------------------------------------------------------
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$SOURCE_DIR/package.json" ] || fail "could not locate the source tree (looked in $SOURCE_DIR)"

mkdir -p "$DEPLOYPATH/tmp" || fail "could not create $DEPLOYPATH/tmp. Is the Node.js application's application root set correctly in cPanel?"

log "copying source from $SOURCE_DIR to $DEPLOYPATH"

# Directories. src/ and public/ are the site's source and static assets,
# server/ and shared/ are the compiled server, db/schema.sql is the schema that
# the server reads at startup, admin/ and scripts/ are needed to build.
for dir in admin db scripts server shared src public; do
  [ -d "$SOURCE_DIR/$dir" ] || fail "$dir/ is missing from the source tree. A partial copy cannot build."
  cp -R "$SOURCE_DIR/$dir" "$DEPLOYPATH/" || fail "could not copy $dir/"
done

# Files, as globs rather than a fixed list. tsconfig*.json in particular must be
# a glob: the root tsconfig.json is a project-references file pointing at
# tsconfig.app.json and tsconfig.node.json, and listing the three by hand is how
# tsconfig.node.json went missing once and broke the build on the host while
# working perfectly on the developer's machine.
for pattern in package.json package-lock.json app.js index.html vite.config.ts eslint.config.js .env.example 'tsconfig*.json'; do
  for file in "$SOURCE_DIR"/$pattern; do
    [ -f "$file" ] || continue
    cp "$file" "$DEPLOYPATH/" || fail "could not copy $(basename "$file")"
  done
done

# ---------------------------------------------------------------------------
# Install and build.
#
# `npm ci`, not `npm ci --omit=dev`: the build needs vite and typescript, which
# are devDependencies, and without them there is no `dist/` and no `dist-server/`
# -- the only two directories the running app reads from.
# ---------------------------------------------------------------------------
cd "$DEPLOYPATH" || fail "could not enter $DEPLOYPATH"

log "installing dependencies (this installs devDependencies too; it is large)"
npm ci || fail "npm ci failed. See the lines above for the actual error."

log "building"
npm run build || fail "npm run build failed. The application was NOT restarted, so the previous release is still serving."

# ---------------------------------------------------------------------------
# Verify the artefacts the running app actually reads.
#
# Exits non-zero if any of them is missing. A deploy that produces a partial
# build and then restarts into it is worse than a deploy that stops: the
# previous release is still on disk and still working.
# ---------------------------------------------------------------------------
missing=0
for artefact in dist-server/server/index.js dist-server/db/schema.sql dist-server/dist/index.html dist-server/dist/admin/index.html; do
  if [ ! -f "$DEPLOYPATH/$artefact" ]; then
    echo "[deploy] ERROR: build output is missing $artefact" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || fail "the build did not produce a complete release. Nothing was restarted."

# Content must never end up inside a release directory. If it is there, the
# next deploy that clears the app root takes the site's content with it.
if [ -d "$DEPLOYPATH/data" ]; then
  echo "[deploy] WARNING: $DEPLOYPATH/data exists. Content inside the app root is" >&2
  echo "[deploy]          destroyed on the next deploy. Move it and set DATA_DIR" >&2
  echo "[deploy]          to a path outside $DEPLOYPATH." >&2
fi

# Recorded only once the release is known to be complete. .cpanel.yml checks for
# this file before restarting, so it works whether or not cPanel runs the tasks
# in a shared shell.
touch "$DEPLOYPATH/tmp/.build-ok" || fail "could not write the build marker"

echo ""
log "build OK. Content directory (DATA_DIR), must be outside $DEPLOYPATH:"
log "  ${DATA_DIR:-NOT SET - content will be lost on redeploy}"
log ""
log "restarting"
