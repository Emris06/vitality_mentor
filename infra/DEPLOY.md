# Vitality — Deployment runbook

Operator runbook for shipping the AI-Mentor HUB to free-tier cloud. **This
is operational doc, not user-facing copy** — keep it terse.

Stack:

| Concern        | Provider                          |
| -------------- | --------------------------------- |
| Web (Vite/React) | Vercel (free hobby tier)        |
| API (Fastify)  | Railway (Node Dockerfile)         |
| AI (FastAPI)   | Railway (Python Dockerfile)       |
| Postgres       | Neon (free, pgvector enabled)     |
| Redis          | Upstash (free, TLS `rediss://`)   |
| Object storage | Cloudflare R2 (S3-compatible)     |
| iSpring        | Mock on Railway (TODO: real LMS)  |

## 1. GitHub secrets (Settings → Secrets and variables → Actions)

| Secret name          | Where to get it                                              |
| -------------------- | ------------------------------------------------------------ |
| `VERCEL_TOKEN`       | Vercel → Settings → Tokens → Create                          |
| `VERCEL_ORG_ID`      | Vercel project → Settings → General (or `.vercel/project.json` after `vercel link`) |
| `VERCEL_PROJECT_ID`  | Same as above                                                |
| `RAILWAY_TOKEN`      | Railway → Account → Tokens → Create (project-scoped)         |
| `OPENAI_API_KEY`     | platform.openai.com → API keys (used by AI service env)      |

## 2. GitHub repo vars (Settings → Variables → Actions)

These are used by the smoke-test job — not secrets, just URLs.

| Var name   | Example                                          |
| ---------- | ------------------------------------------------ |
| `WEB_URL`  | `https://vitality.vercel.app`                    |
| `API_URL`  | `https://vitality-api.up.railway.app`            |
| `AI_URL`   | `https://vitality-ai.up.railway.app`             |

## 3. Neon Postgres setup (one-time)

1. Create a project at <https://neon.tech>. Region: `eu-central-1` (Frankfurt).
2. SQL Editor → run once:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

3. Copy the pooled `postgresql://...?sslmode=require` URL — that's
   `DATABASE_URL` for both API and AI services.
4. Apply migrations. The API auto-migrates in dev only — in production we
   apply manually:

   ```bash
   # From the Railway API service shell (or `railway run` locally):
   pnpm --filter @vitality/api db:migrate:once
   ```

   This calls `services/api/src/db/migrate-cli.ts`, which applies every
   `services/api/src/db/migrations/*.sql` in lexical order exactly once
   (tracked in `_migrations`). Re-running is a no-op.

   Alternative for the truly minimal path: open Neon's SQL editor and paste
   each `services/api/src/db/migrations/*.sql` file in order.

## 4. Upstash Redis setup (one-time)

1. <https://upstash.com> → Create database, region `eu-west-1` or closer.
2. Copy the **TLS** connection string (`rediss://`, two `s`) — used as
   `REDIS_URL` for both API and AI services.
3. Free tier limits: 10k commands/day, 256 MB. The gamification stream
   trims aggressively; we stay well under in normal use.

## 5. Cloudflare R2 (optional, for uploads)

1. Create a bucket `vitality-uploads`.
2. Generate an S3-compatible token. Region is `auto`.
3. Wire via `S3_*` env vars on the API service if/when uploads ship.

## 6. Vercel project setup

1. **Import** the GitHub repo into Vercel.
2. Set the **Root directory** to `apps/web`.
3. Vercel will pick up `apps/web/vercel.json` — no need to set build
   commands in the UI.
4. Environment variables (Production scope): copy from
   `apps/web/.env.production.example`. `API_URL` here is the rewrite target
   and **must** match `vars.API_URL` in GitHub.
5. The workflow uses `vercel deploy --prebuilt` from CI — that path needs
   `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (see secrets table above).

## 7. Railway project setup

Create one project, three services:

| Service name              | Source                                    | Config file                                 |
| ------------------------- | ----------------------------------------- | ------------------------------------------- |
| `vitality-api`            | this repo, root `/`                       | `services/api/railway.toml`                 |
| `vitality-ai`             | this repo, root `/`                       | `services/ai/railway.toml`                  |
| `vitality-ispring-mock`   | this repo, root `/`                       | `infra/mocks/ispring/railway.toml`          |

For each, paste the matching `.env.production.example` into the Variables
tab and replace placeholders. Railway sets `$PORT` automatically — leave
those values as `$PORT` (Railway interpolates).

## 8. DNS (optional)

To attach `vitality.example.com`:

1. Vercel → Project → Settings → Domains → Add.
2. Add the CNAME at your registrar pointing to `cname.vercel-dns.com`.
3. Once verified, update `WEB_ORIGIN` on the API service to the new origin,
   redeploy the API. Update `vars.WEB_URL` in GitHub.

## 9. Rollback

**Vercel** — Deployments tab → previous deploy → "Promote to Production".
Sub-second cutover.

**Railway** — Service → Deployments tab → previous deploy → "Redeploy".
Railway keeps the prior image; this redeploys it from the cache. Approx
30–90s depending on cold-start.

**Database** — Neon supports point-in-time restore on paid tiers. On the
free tier: dump locally with `pg_dump`, restore with `psql`. Migrations
are forward-only; do not roll back schemas without a corresponding down
migration (we don't author those — by design, for the demo).

## 10. TODO before judging day

- [ ] Swap iSpring mock for the real LMS (`infra/mocks/ispring` Railway
      service → delete; set `ISPRING_BASE_URL` on the API to the real URL).
- [ ] Attach the bank-provided custom domain (DNS step above).
- [ ] Pin `bervProject/railway-deploy` in `deploy.yml` to a SHA — `@main`
      is fine for the Ideathon but is a supply-chain risk long term.
- [ ] Replace the OpenAI key with a project-scoped one (kill switch on
      blast-radius if the repo leaks).
