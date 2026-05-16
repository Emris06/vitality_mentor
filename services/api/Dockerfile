FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Copy workspace manifests for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api/package.json ./services/api/

# Install with workspace context
RUN pnpm install --frozen-lockfile=false

# Copy sources
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/api ./services/api

RUN pnpm --filter @vitality/api build

ENV NODE_ENV=production
WORKDIR /app/services/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
