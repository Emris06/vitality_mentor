# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Mentora** is the AI-powered onboarding platform for bank newcomers. The
problem we're solving: banks have plenty of internal knowledge bases, but
newcomers have nowhere safe to *practice*. They can't touch the real ABC/CRM
because of data-leak risk; senior employees don't have time to mentor through
every basic question; the gap between "read the manual" and "do the job" is
where attrition and errors live.

Mentora is a synthetic-data twin of the bank's internal system, with an AI
agent — **Clicky** — that follows the newcomer's cursor, sees the screen, and
explains what to do in real time, by voice, while moving. HR gets a clean view
of cohort progress; mentors get their time back; newcomers learn by doing
without legal/privacy risk.

The npm scope is `@vitality/*` and the original codename was "Vitality" — the
branded product is **Mentora**. Both names point at the same thing.

> **Origin note:** this codebase started as a Turonbank Ideathon submission.
> The Ideathon framing has been dropped — Mentora is now a standalone product.
> Anything in older docs that references "10-minute stage demo", "three tracks
> of equal weight", or "iSpring as system of record" reflects the old scope
> and is not load-bearing. The Skills/Forecasting track and the `infra/demo/*`
> artifacts are candidates for cutting. iSpring integration is **kept** —
> framed as "we integrate with the LMS banks already use," not as system of
> record. Current build focus is the simulator + Clicky; HR and Mentor
> (Employee) surfaces come in a later phase.

## Brand

- Wordmark: **mentora** (lowercase) with an asterisk-burst mark.
- Primary color: electric cobalt blue (working hex `#2046FF` — pull from
  `reference/logo_name.jpg` for any color-exact work).
- Tone: confident, modern, fintech-clean. Not corporate, not childish.
- Logo asset of record: `reference/logo_name.jpg`.

## What Clicky is (the killer feature)

Clicky is the AI agent that lives next to the newcomer's cursor in the
simulator. It:

- Follows the real cursor in real time with an eased offset (follow mode).
- Listens via push-to-talk — hold backtick, speak, release.
- Decides which on-screen element to point at and what to say.
- Animates to that element (target mode) and reads its explanation via TTS.
- Scope: newcomers/interns only. Mentors and HR don't see Clicky.

Current code state (read `apps/web/src/features/clicky/` before acting):

- Visual + interaction layer: `Clicky.tsx`, `ClickyProvider.tsx`,
  `ClickyVoiceOverlay.tsx`, `tts.ts`, `useClickyAgent.ts`.
- **The backend `/clicky/intent` endpoint is wired** (`services/api/src/routes/clicky.ts`).
  It calls Claude Haiku 4.5 (override via `CLICKY_MODEL` env var) with a
  JSON-schema-constrained output. Falls back to an in-process keyword matcher
  when `ANTHROPIC_API_KEY` is absent or the LLM times out — the frontend
  cannot tell the difference. The client-side `agent.ts` now bypasses the local
  matcher and calls `/clicky/intent` via `useClickyAgent.ts`.
- "Sees the screen" = reads `data-clicky-target` annotations. Annotate every
  interactive element in the simulator with both attributes:
  - `data-clicky-target="keyword1, keyword2, …"` — comma-separated synonyms
    the agent scores against the transcript.
  - `data-clicky-hint="One sentence Clicky speaks on arrival."` — optional
    arrival narration; falls back to the element's label if omitted.
- TTS fires on arrival only. A future "narrate-while-moving" mode (speak the
  en-route sentence on movement start, the arrival sentence on arrival) is on
  the roadmap.

## Product constraints (still load-bearing)

These are real product requirements, not hackathon constraints:

- **Synthetic data only** in the simulator. The privacy story to banks
  depends on this entirely. Enforced in CI by `scripts/security-boundary.ts`
  (`pnpm security:audit`) — it greps for `Colvir`/`YABS`, IBAN/INN patterns
  outside `synth-data`/`test` paths, a banned real-name list, and "production
  iSpring" outside `infra/mocks/`. New fixtures route through
  `packages/synth-data/` and keep the `synthetic: true` guard in `persons.ts`.
- **Multilingual (Uzbek + Russian)** for any user-facing text and the Q&A
  pipeline. The bank market is uz/ru. English-only ships nothing. Enforced
  by `pnpm i18n:audit`. Locales: `packages/shared/src/types/locale.ts`. The
  chat default locale in `services/api/src/routes/chat.ts` is `ru`.
- **RAG-grounded answers** for both the chatbot and Clicky's explanations.
  Free-form LLM output in a banking context is a non-starter. RAG pipeline:
  `services/ai/app/rag/` (`embeddings.py` → `retriever.py` → `generator.py`,
  with `prompts.py` enforcing grounding).
- **Fast chat** — sub-2-second responses. Slow chat in an onboarding tool
  destroys trust. Bench: `pnpm bench:chat` (N=20 P95 > 2000 ms fails).
  Treat it as a regression alarm.

## Architecture in one screen

```
apps/web              React 18 + Vite + TS + Tailwind + i18next + react-router
                      + framer-motion. Three.js on landing only.
                      Supabase auth via @supabase/ssr.
                      Routes: see apps/web/src/App.tsx.

services/api          Fastify 4 (Node 20, ESM). Owns Postgres + Redis state
                      and proxies AI calls. Embeds gamification + lms-export
                      + lms-consumer workers, toggled by *_EMBEDDED env vars.
                      Migrations apply on dev startup
                      (services/api/src/db/migrate.ts → migrations/*.sql).

services/ai           FastAPI (Python 3.11). RAG (sentence-transformers +
                      pgvector), sim hints, voice agent intent.
                      Owns its own migrations and DB pool. Embedding model
                      loads lazily so /health stays fast.

infra/docker          docker-compose: postgres (pgvector/pg16, host port 5433
                      to avoid clashing with a local Postgres), redis, minio,
                      api, ai.

packages/shared       TS types shared between web and api. @vitality/shared.

packages/synth-data   Only sanctioned source of person/document fixtures.
                      @vitality/synth-data.
```

Path aliases (`@vitality/shared`, `@vitality/synth-data`) are wired in
`tsconfig.base.json` and as pnpm workspace deps — prefer them over relative
paths across package boundaries.

Inter-service: web → api via `WEB_ORIGIN`/CORS; api → ai via `AI_SERVICE_URL`.
The api validates Supabase JWTs (`SUPABASE_JWT_SECRET`) when present and
falls back to a cookie session in dev.

## Roles

Three personas, three dashboards:

- **Intern / newcomer** (`/intern`) — primary user. Sees assigned simulator
  scenarios, current quest, badges, deadline, messages from mentor/HR.
  Clicky is enabled by default.
- **Mentor / existing employee** (`/employee`) — sees their assigned interns,
  questions inbox, progress. Clicky is *not* enabled.
- **HR** (`/hr`) — cohort-wide progress, mentor availability for matching,
  exports.

## Commands

Node ≥ 20.11, pnpm 9, Python ≥ 3.11, Docker Desktop.

```sh
pnpm install
pnpm stack:up           # postgres + redis + minio + api + ai
pnpm stack:infra        # just postgres + redis + minio (when running api/ai locally)
pnpm stack:down         # stop all containers
pnpm dev                # parallel: api + web (NOT ai — runs separately)
pnpm dev:web            # http://localhost:5173
pnpm dev:api            # http://localhost:4000 — applies migrations on startup in dev
pnpm typecheck
pnpm lint
pnpm audit:all          # i18n + security boundary; both run in CI
```

Python AI service runs separately:

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
pnpm --filter @vitality/api db:migrate:once
pnpm --filter @vitality/api db:seed:hr               # also: db:seed:skills, db:seed:demo
```

## What may be cut soon

Decision-still-open as of 2026-05-17 — these were built for the Ideathon
brief and may be deleted. Don't introduce new dependencies on them:

- **Skills/Forecasting track** — `/skills/*` routes, `SkillsHub`,
  `EmployeeSkillsPage`, `Heatmap`, `SkillsRadarMini`, `ImpactBar`,
  `services/ai/app/skills/`, `services/api/src/routes/skills.ts`.
- **Demo artifacts** — `infra/demo/RUNBOOK.md`, `PITCH_NOTES.md`,
  `BACKUP_VIDEO.md`, `scripts/demo-bench.ts`, `scripts/demo-setup.{ps1,sh}`,
  the fixed personas (Madina Yusupova / Dilshoda Karimovna / Aziz Toshmatov).

## Reading the old brief

`docs/01-06.md` + `docs/08.md` is the original Ideathon brief — useful for
context, partially stale for the product. The source of truth for product
shape is this file plus the user's product decisions. `docs/04-features-by-track.md`
in particular treats Skills as a first-class track; that framing is no longer
correct.

For visual/product layout reference (until the new design system lands):
[`reference/DESIGN.md`](reference/DESIGN.md) and the in-progress mockups in
[`reference/mockups/`](reference/mockups/).

## Simulator scenarios

Four scenario IDs are registered: `kyc`, `open-account`, `deposit`, `transfer`.
Only `kyc` and `open-account` are fully implemented — the others return `501`.
The gate is `isImplemented()` in `services/api/src/sim/scenarios/index.ts`.
Each scenario lives in `services/api/src/sim/scenarios/<id>.ts` and exports a
`ScenarioDef<TState>` consumed by the generic engine in `sim/engine.ts`.

Step flow: `POST /sim/runs` → `POST /sim/runs/:id/steps` (repeat per step) →
status transitions to `scored`. A step validator returns `{ ok: true, next }` to
advance or `{ ok: false, mistake }` to penalise without advancing. Final score
is clamped 0–100 and triggers both `hr.scored` and `sim.scored` Redis events.

## Gamification

Redis Streams are the event bus. Two event types:
- `publishGameEvent()` (`src/gamification/events.ts`) — downstream worker awards XP + badges.
- `publishHrEvent()` (`src/hr/events.ts`) — HR dashboard real-time update.

The game worker is embedded in the API process by default (`GAME_WORKER_EMBEDDED`
env, default on). XP rules live in `src/gamification/rules.ts` (pure, no I/O —
unit-testable in isolation). `apply.ts` writes to Postgres. Daily XP cap per
skill: `XP_DAILY_CAP_PER_SKILL = 60`.

Badge IDs: `first_kyc`, `kyc_perfectionist`, `night_owl`, `streak_7`,
`polyglot`. Criteria are defined in `rules.ts::badgeCriteria`.

## i18n

Translation files: `apps/web/src/i18n/locales/{en,ru,uz}.json`.  
i18next is wired at `apps/web/src/i18n/index.ts` — use `useTranslation()` in
components and add keys to all three files. The CI audit (`pnpm i18n:audit` via
`scripts/i18n-audit.ts`) fails on missing or untranslated keys.

Default locale: `ru` (both the web fallback in `locale.ts` and the chat route in
`services/api/src/routes/chat.ts`).

## Frontend API client

`apps/web/src/lib/api.ts` is the single entry point for backend calls:

- `authedFetch(path, init)` — wraps `fetch`, attaches Supabase `Bearer` token
  when a session exists; cookie session used as fallback in dev.
- `simApi` — typed object with `.startRun`, `.getRun`, `.submitStep`,
  `.getHint`. All simulator UI goes through this.
- `useChatStream` hook in `features/chat/` streams SSE from `/chat`.

Always use `authedFetch` (not raw `fetch`) for requests that touch user data.

## Environment variables (key ones)

See `.env.example` at root and `services/ai/.env.example`.  
Key variables Claude Code will commonly encounter:

| Var | Service | Purpose |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | api | Enables Clicky LLM brain; without it, keyword fallback runs |
| `CLICKY_MODEL` | api | Claude model for `/clicky/intent` (default: `claude-haiku-4-5-20251001`) |
| `CLICKY_TIMEOUT_MS` | api | Abort timeout for Clicky LLM call |
| `AI_SERVICE_URL` | api | URL of the FastAPI AI service (default: `http://localhost:8000`) |
| `SUPABASE_JWT_SECRET` | api | JWT validation; omit in dev to use cookie session |
| `GAME_WORKER_EMBEDDED` | api | Set to `false` to run gamification worker standalone |
| `LMS_WORKER_EMBEDDED` | api | Set to `false` to run iSpring export queue standalone |
| `GEN_PROVIDER` | ai | LLM provider for RAG (`anthropic` or `openai`) |
