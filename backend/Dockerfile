# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT, not backend/ — the API serves the
# Angular bundle, so the image has to be able to build it.

# ---- Stage 1: build the Angular bundle -------------------------------------
FROM node:22-slim AS frontend

WORKDIR /src/front-end

COPY front-end/package.json front-end/package-lock.json ./
# `npm ci` alone is not enough: the lock generated on Windows lists Windows-only
# optional native binaries (e.g. @tailwindcss/oxide-win32-x64-msvc), never the
# Linux equivalents, so the build fails on a missing .node binary without this.
RUN npm ci \
 && OXIDE=$(node -p "require('./node_modules/@tailwindcss/oxide/package.json').version") \
 && npm install --no-save --no-package-lock "@tailwindcss/oxide-linux-x64-gnu@${OXIDE}"

COPY front-end/ ./
# angular.json writes to ../backend/public, i.e. /src/backend/public
RUN npx ng build --configuration production


# ---- Stage 2: the API runtime ----------------------------------------------
FROM node:22-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    TZ=America/Toronto

RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# The freshly built UI, never a local one.
COPY --from=frontend /src/backend/public ./public

USER node

EXPOSE 5000

CMD ["node", "app.js"]
