FROM node:22-alpine AS base
WORKDIR /app
# pnpm 11.x requires Node >= 22.13 (uses node:sqlite)
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# Copy workspace manifests for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/synth-data/package.json ./packages/synth-data/
COPY services/api/package.json ./services/api/

# Install with workspace context
RUN pnpm install --frozen-lockfile=false

# Copy sources
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/synth-data ./packages/synth-data
COPY services/api ./services/api

RUN pnpm --filter @vitality/api build

ENV NODE_ENV=production
WORKDIR /app/services/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
