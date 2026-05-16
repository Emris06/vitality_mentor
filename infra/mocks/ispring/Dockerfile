# Minimal image for the iSpring mock. Runs via tsx (no build step) so the
# demo container picks up edits without a rebuild loop.
FROM node:20-alpine

WORKDIR /app

# Copy manifests first for layer caching.
COPY package.json ./
# We intentionally avoid pnpm lockfile here — the mock is standalone and
# `npm install --omit=dev=false` is the simplest path inside a container that
# is detached from the workspace.
RUN npm install --no-audit --no-fund

COPY src ./src
COPY tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
EXPOSE 4010

# Run via tsx — no compile step, fast cold-start. If you want a hardened
# image, swap to `npm run build && node dist/server.js`.
CMD ["npx", "tsx", "src/server.ts"]
