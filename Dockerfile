# Golden Steps — full-stack image.
#
# The app is one Node process: Express serves the API *and* the built site from
# `dist/`, and hosts /admin. A container that runs `npm start` is the whole
# deployment — there is no separate frontend host to configure, and no rewrite
# rules to keep in sync.
#
# better-sqlite3 is a native module, so the dependency install needs a compiler.
# The build stage provides one and the runtime stage copies the compiled result
# across; the two stages use the same base image and architecture, so the binary
# matches and does not need recompiling.

# ---------------------------------------------------------------- build stage
FROM node:24-bookworm-slim AS build

# `python3` and `make` are what node-gyp needs if better-sqlite3 has to compile
# from source rather than use a prebuilt binary. On Debian the C/C++ headers live
# in the `g++` package, which pulls in `gcc` and `make`.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# Contact details are BAKED INTO THE BUNDLE at build time.
#
# Vite inlines every `VITE_*` variable into the JavaScript, so these are read
# when this image is built, not when it runs — and `.dockerignore` keeps `.env`
# out of the build context. Without the ARGs below, a container build silently
# ships a site with every contact surface blank ("not published yet") even
# though the variables are set correctly at runtime.
#
# Pass them at build time:
#
#   docker build \
#     --build-arg VITE_ORG_EMAIL=goldenstepscbo@gmail.com \
#     --build-arg VITE_ORG_PHONE="+254 722 999 630" \
#     --build-arg VITE_ORG_ADDRESS="P.O. Box 40100, Kisumu, Kenya" \
#     -t golden-steps .
#
# Quote the values: an unquoted `+254 ...` is two shell words, not one.
# ─────────────────────────────────────────────────────────────────────────────
ARG VITE_ORG_EMAIL=""
ARG VITE_ORG_PHONE=""
ARG VITE_ORG_PHONE_2=""
ARG VITE_ORG_ADDRESS=""
ARG VITE_ORG_MAP_URL=""
ARG VITE_ORG_REGISTRATION=""
ARG VITE_ORG_FACEBOOK=""
ARG VITE_ORG_X=""
ARG VITE_ORG_LINKEDIN=""
ARG VITE_ORG_INSTAGRAM=""

ENV VITE_ORG_EMAIL=$VITE_ORG_EMAIL \
    VITE_ORG_PHONE=$VITE_ORG_PHONE \
    VITE_ORG_PHONE_2=$VITE_ORG_PHONE_2 \
    VITE_ORG_ADDRESS=$VITE_ORG_ADDRESS \
    VITE_ORG_MAP_URL=$VITE_ORG_MAP_URL \
    VITE_ORG_REGISTRATION=$VITE_ORG_REGISTRATION \
    VITE_ORG_FACEBOOK=$VITE_ORG_FACEBOOK \
    VITE_ORG_X=$VITE_ORG_X \
    VITE_ORG_LINKEDIN=$VITE_ORG_LINKEDIN \
    VITE_ORG_INSTAGRAM=$VITE_ORG_INSTAGRAM

WORKDIR /app

# Manifests first: this layer is only rebuilt when dependencies change, not on
# every source edit.
COPY package.json package-lock.json ./

# `npm ci` installs exactly what the lockfile pins. If the lockfile and
# package.json ever disagree this fails the build rather than silently
# resolving something different from what was tested.
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY admin/ ./admin/
COPY shared/ ./shared/
COPY src/ ./src/
COPY public/ ./public/
COPY server/ ./server/
COPY db/ ./db/

# `tsc -b` type-checks and Vite emits `dist/`, including the separate
# `dist/admin/index.html` entry that makes /admin resolve on its own.
RUN npm run build

# Drops devDependencies, keeping the compiled better-sqlite3 binary so the
# runtime stage does not have to rebuild it.
RUN npm prune --omit=dev

# -------------------------------------------------------------- runtime stage
FROM node:24-bookworm-slim AS runtime

# `tini` reaps zombies and, more importantly here, forwards SIGTERM to Node.
# Without an init, PID 1 does not get default signal handlers, so the graceful
# shutdown in server/index.ts never runs and SQLite is left with a stale WAL file
# on every deploy.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
# The schema is read at startup, so it has to ship with the image. Deploying a
# newer schema without it would leave the database on the old shape.
COPY --from=build /app/db ./db
COPY --from=build /app/package.json ./package.json

# The database and uploaded media live here. This is the mount point for a
# persistent volume — without one, every redeploy discards the dashboard's
# content and every image uploaded through it.
#
# Only /data is chowned. Nothing in /app is written at runtime (static assets are
# served read-only, SQLite and uploads both go to DATA_DIR), so a recursive
# chown over node_modules would only add an expensive layer and widen the
# writable surface for no benefit.
RUN mkdir -p /data && chown -R node:node /data

# Declared so a bare `docker run` without `-v` still gets a writable location
# rather than writing into the image layer, where it would be lost on rebuild.
VOLUME ["/data"]

# Never run as root. The `node` user is UID 1000.
#
# -- Volume ownership: the thing that silently breaks uploads --------------------
# A volume mounted over /data inherits the HOST's ownership, not this image's.
# If the platform or the host creates the volume as root, this process cannot
# write, and every save and upload fails with a permissions error while reads
# keep working perfectly — so it presents as an application bug, not a mount
# problem.
#
#   Named volume  Docker copies the ownership from this image on first use, so
#                 `docker volume create` + `-v name:/data` works as-is.
#   Bind mount    The host directory wins. Fix it host-side first:
#                     sudo chown -R 1000:1000 /path/to/data
#   PaaS volume   Set the volume's user to UID 1000 in the platform's dashboard
#                 or service definition.
USER node

EXPOSE 4000

# /api/health reports process uptime, so a failing check means the process is
# actually wedged rather than merely slow to answer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/index.ts"]
