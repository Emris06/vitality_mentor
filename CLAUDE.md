# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AI-Mentor HUB ("Vitality" / `@vitality/*` packages) — a Turonbank Ideathon submission, now a pnpm monorepo scaffolded across `apps/`, `services/`, `packages/`, and `infra/`. The platform covers three tracks behind one product: RAG-grounded Knowledge Base chat, a Bank Operations Simulator (KYC etc.), and Skills Analysis / HR dashboards. The branded product is "AI-Mentor"; the npm scope and DB user is `vitality` — both names point at the same thing.

The 10-minute stage demo is a real constraint on architecture decisions, not an afterthought. The Ideathon-specific operator script lives at [`infra/demo/RUNBOOK.md`](infra/demo/RUNBOOK.md); skim it before changing the demo seed, the latency bench, or anything on the four demo routes (`/`, `/chat`, `/simulator/kyc`, `/hr`).

## Non-negotiable constraints

Restated here so you don't need to open a doc to remember them. These shape every implementation decision and must not be relaxed without the user's say-so:

- **Synthetic data only** in the Bank Operations Simulator. No real client data, no live connection to Colvir/YABS. This is enforced in CI by [`scripts/security-boundary.ts`](scripts/security-boundary.ts) (`pnpm security:audit`) — it greps for `Colvir`/`YABS`, IBAN/INN-shaped tokens outside `synth-data`/`test` paths, a small banned real-person name list, and "production iSpring" outside `infra/mocks/`. If you add fixtures, route them through [`packages/synth-data/`](packages/synth-data/src) and keep the `synthetic: true` guard in `persons.ts`.
- **Chatbot latency ≤ 2 s** end-to-end. Validated by `pnpm bench:chat` / `pnpm demo:bench` (N=20 against `/chat`, fails on P95 > 2000 ms). Architectural choices in the Q&A path (model size, retrieval, caching) must respect this.
- **RAG-grounded answers, not free-form LLM.** The chat path runs through `services/ai/app/rag/` (`embeddings.py` → `retriever.py` → `generator.py`, with `prompts.py` enforcing grounding). Don't propose ungrounded chat.
- **Uzbek and Russian** must both work for any user-facing text and the Q&A pipeline. English-only is not acceptable for shipped features. Enforced by `pnpm i18n:audit`. `SUPPORTED_LOCALES` lives in [`packages/shared/src/types/locale.ts`](packages/shared/src/types/locale.ts) and the chat default locale in `services/api/src/routes/chat.ts` is `ru`.
- **iSpring LMS** is the system of record for training results. The export pipeline is `services/api/src/integrations/ispring/` (consumer reads the gamification Redis stream → enqueues `lms_exports` → queue posts to `/api/v1/results`). In dev it runs against [`infra/mocks/ispring`](infra/mocks/ispring) (port 4010), never the real iSpring.

## Architecture in one screen

Five long-lived processes; everything else is scripts:

```
apps/web              React 18 + Vite + TS + Tailwind + i18next + react-router + framer-motion
                      Three.js (@react-three/fiber) on the landing page only.
                      Supabase auth via @supabase/ssr in the browser.
                      Routes mirror the demo flow — see apps/web/src/App.tsx.

services/api          Fastify 4 (Node 20, ESM). Owns Postgres + Redis state and
                      proxies AI calls. Single process by default — it embeds three
                      workers (gamification, lms-export, lms-consumer) toggled by
                      *_EMBEDDED env vars. Migrations apply on dev startup
                      (services/api/src/db/migrate.ts → migrations/*.sql).

services/ai           FastAPI (Python 3.11). RAG (sentence-transformers + pgvector),
                      sim hints, skills forecasting. Owns its own migrations
                      (services/ai/migrations/001_rag.sql) and DB pool. The
                      embedding model loads lazily on first use so /health stays fast.

infra/docker          docker-compose with postgres (pgvector/pg16, host port 5433
                      to avoid clashing with a local Postgres), redis, minio,
                      api, ai, and the ispring mock.

infra/mocks/ispring   Standalone Node service implementing the iSpring surface
                      the LMS pipeline writes to. Part of the workspace.

packages/shared       TS types shared between web and api (chat, simulator, skills,
                      employee, locale, health). Imported as @vitality/shared.

packages/synth-data   The only sanctioned source of person/document fixtures for
                      the simulator. Trips security-boundary.ts otherwise.
```

Path aliases `@vitality/shared` and `@vitality/synth-data` are wired in [`tsconfig.base.json`](tsconfig.base.json) and as pnpm workspace deps — prefer the alias over relative paths across package boundaries.

Inter-service contract: web → api over `WEB_ORIGIN`/CORS; api → ai over `AI_SERVICE_URL`; api → ispring over `ISPRING_BASE_URL`. The api validates Supabase JWTs (`SUPABASE_JWT_SECRET`) when present and falls back to a cookie session in dev.

## Commands you actually need

All commands are pnpm scripts from the repo root unless noted. Node ≥ 20.11, pnpm 9, Python ≥ 3.11, Docker Desktop.

```sh
pnpm install
pnpm stack:up           # postgres + redis + minio + api + ai + ispring
pnpm stack:infra        # just postgres + redis + minio (when running api/ai locally)
pnpm dev                # parallel: api + web (NOT ai — see below)
pnpm dev:web            # http://localhost:5173
pnpm dev:api            # http://localhost:4000 — applies migrations on startup in dev
pnpm typecheck          # all workspaces
pnpm lint               # all workspaces (ai/, infra/, docs/ are ignored at root)
pnpm audit:all          # i18n + security boundary; both run in CI
```

The Python AI service is **not** part of `pnpm dev` — start it separately:

```sh
cd services/ai
python -m venv .venv && . .venv/Scripts/activate    # PowerShell: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest tests -q                                     # single test: pytest tests/test_sim_hint_parse.py -q
```

Per-package commands (when iterating in one workspace):

```sh
pnpm --filter @vitality/web typecheck
pnpm --filter @vitality/api db:migrate:once         # one-shot migration outside dev
pnpm --filter @vitality/api db:seed:hr              # seed HR cohort (also: db:seed:skills, db:seed:demo)
```

Demo / latency commands — `pnpm demo:setup:win` (or `:nix`) drops the stack into a known seeded state with three fixed personas + 20 synthetic SOPs; `pnpm demo:bench` enforces the 2 s P95 chat budget. Run both within 10 minutes of going on stage. Full beat sheet: [`infra/demo/RUNBOOK.md`](infra/demo/RUNBOOK.md).

## How to read the brief — do not load it all at once

The brief is split into 8 small files under [`docs/`](docs/) (NB: `07-requirements-and-mvp.md` is missing in the current tree — only 01–06 and 08 are present). Pull in only the section relevant to the task; don't Read every part by default.

| Task                                                | Read                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Scoping / framing a feature                         | `docs/01-overview-and-problem.md`                           |
| UI or flow for HR / Mentor / Newcomer               | `docs/02-users.md` + `docs/05-user-flows.md`                |
| "Why are we building X?"                            | `docs/03-solutions.md`                                      |
| Picking what to build for a track                   | `docs/04-features-by-track.md`                              |
| Scaffolding services, choosing libraries, API shape | `docs/06-architecture-and-stack.md`                         |
| Pitch deck / storytelling only                      | `docs/08-design-thinking.md` (skip for implementation work) |

For visual / product spec (page-level layouts, copy, demo screenshots), [`reference/DESIGN.md`](reference/DESIGN.md) is the source.
