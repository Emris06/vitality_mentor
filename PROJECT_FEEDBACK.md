# Project Feedback — AI-Mentor HUB (Vitality)

> A read-through of the repo and brief, summarized from a fresh pair of eyes. Branch `ui2`, May 2026.

## 1. What this project is

**AI-Mentor HUB** (npm scope `@vitality/*`, branded "AI-Mentor") is a single onboarding/learning platform built for a **Turonbank Ideathon submission**. The 10-minute live stage demo is treated as a real engineering constraint, not marketing fluff — bench scripts, runbooks, and a deterministic seed flow are all wired up for it.

One product, **three tracks**:

1. **Knowledge Base** — a multilingual, RAG-grounded Q&A chatbot over internal bank documents (regulations, SOPs, procedures).
2. **Bank Operations Simulator** — a sandboxed mirror of real teller workflows (KYC, account opening, deposits, transfers) running on **synthetic data only**.
3. **Skills Analysis / HR** — skill maps, gap analytics, mentor matching, promotion-readiness flags, and a forecasting view, all funneling to the iSpring LMS as system of record.

The three personas it explicitly designs for: **HR specialist**, **existing employee (mentor)**, **newcomer/intern**.

## 2. The problem it solves

Banks (specifically Uzbek banks running Colvir/YABS) have a structural training paradox:

- Newcomers **cannot legally touch real banking systems** — privacy law, GDPR-equivalents, fraud risk, data-leak liability. So they can't learn the real job until they're trusted enough not to need training.
- HR is doing onboarding **manually**, with no visibility into mentor availability, no consistent progress tracking, and no automated LMS export.
- Mentors are answering the **same basic questions every week** ("how do I open a foreign-currency account?"), bleeding senior-staff productivity.
- Errors during onboarding aren't just embarrassing — in banking ops, one mis-typed transaction is a regulatory event.

AI-Mentor HUB collapses that into one platform:
- **Simulator** removes the legal/privacy risk of letting interns practice on real systems.
- **RAG chatbot** offloads the routine Q&A from senior employees to a grounded AI that speaks Uzbek and Russian, 24/7.
- **HR Dashboard + mentor-matching** gives HR a single pane of glass and removes manual mentor-assignment work.
- **Gamified skill tracking** + **iSpring export** keeps progress measurable and slots into the LMS the bank already uses for compliance records.

## 3. How it's built

It's a **pnpm monorepo** with five long-lived processes:

| Process | Stack | Owns |
|---|---|---|
| `apps/web` | React 18 + Vite + TS + Tailwind, i18next, react-router, framer-motion, @react-three/fiber (landing only), Supabase auth | All UI for the three roles |
| `services/api` | Fastify 4 (Node 20, ESM) | Postgres + Redis state, auth, HR, gamification, iSpring export pipeline. Embeds three workers (gamification, lms-export, lms-consumer) toggled by env vars |
| `services/ai` | FastAPI (Python 3.11), sentence-transformers, pgvector | RAG (embeddings → retriever → generator), simulator hints, skills forecasting |
| `infra/mocks/ispring` | Node | Stand-in for the real iSpring LMS in dev |
| `infra/docker` | Postgres (pgvector/pg16, port 5433), Redis, MinIO | Stateful infra |

Shared TS contracts live in `packages/shared` (`@vitality/shared`); all sanctioned person/document fixtures live in `packages/synth-data` (`@vitality/synth-data`).

Routing in `apps/web/src/App.tsx` cleanly mirrors the three tracks: `/chat`, `/simulator/*`, `/hr/*`, `/skills/*`, plus role landing pages (`/intern`, `/employee`, `/hr`, `/me`).

The API exposes a small, focused surface: `chat`, `sim`, `skills`, `hr`, `hr_stream`, `gamification`, `lms`, `clicky`, `health` — no kitchen-sink endpoints.

## 4. The non-negotiables (and what enforces them)

The CLAUDE.md treats five constraints as non-negotiable, and impressively, each one has a real enforcement mechanism — not just a doc:

| Constraint | Enforced by |
|---|---|
| Synthetic data only in the simulator | `scripts/security-boundary.ts` greps the tree for Colvir/YABS/IBAN/INN/real-name tokens outside `synth-data`/`test`; runs in CI via `pnpm security:audit` |
| Chat P95 ≤ 2 s end-to-end | `pnpm bench:chat` / `pnpm demo:bench` — N=20 against `/chat`, fails loud on P95 > 2000 ms |
| RAG-grounded answers, never free-form LLM | `services/ai/app/rag/` pipeline (`embeddings → retriever → generator`) + `prompts.py` grounding template |
| Uzbek + Russian for all user-facing text and the Q&A pipeline | `pnpm i18n:audit`; `SUPPORTED_LOCALES` in `packages/shared/src/types/locale.ts`; chat default locale `ru` |
| iSpring LMS is the system of record | Redis-stream consumer → `lms_exports` queue → `/api/v1/results` POST; dev runs against the mock on port 4010, never real iSpring |

This is the part of the project that most impressed me on read-through. The constraints aren't aspirational — they're testable, and they're tested.

## 5. The demo posture

The Ideathon stage demo gets first-class treatment:

- `pnpm demo:setup:win` / `:nix` — one-shot deterministic reset (skills taxonomy + HR cohort + three fixed personas — Madina Yusupova / Dilshoda Karimovna / Aziz Toshmatov — + 20 synthetic SOP docs).
- `pnpm demo:bench` — the latency gate, run within 10 minutes of going on stage.
- Four URLs to open: `/`, `/chat`, `/simulator/kyc`, `/hr`.
- A beat-by-beat operator runbook at `infra/demo/RUNBOOK.md` with failure plays, plus pitch alignment notes and a backup-video recipe.

The runbook-first approach to a live demo is the right call for a 10-minute slot where things will go wrong.

## 6. What I think is strong

- **Clear problem framing.** The brief in `docs/` is split into eight short files with a routing table in CLAUDE.md telling you which one to read for which task. That's unusually disciplined.
- **Constraints with teeth.** Every hard rule has a CI check or bench behind it. The synthetic-data boundary script is genuinely useful guardrail engineering for a regulated-industry pitch.
- **Sensible service split.** Python owns the ML/RAG path (where the library ecosystem lives); Node owns orchestration and Postgres (where the business logic and team comfort live). Inter-service contract is explicit (`AI_SERVICE_URL`, `WEB_ORIGIN`, `ISPRING_BASE_URL`).
- **Demo as a first-class artifact.** Deterministic seed, latency bench, runbook, backup video. This is what shipping for a stage looks like.
- **No leak between branded and technical names.** "AI-Mentor" branding, `@vitality/*` packages — both names point at the same thing and the docs say so.

## 7. Risks and rough edges I'd flag

- **Generator backend is Ollama-only today.** `services/ai/app/rag/generator.py` has stubs for OpenAI and Anthropic that raise `NotImplementedError`. For the stage demo that's fine (local Ollama is faster and free), but the 2-second P95 is on a single laptop — on a real bank deployment with hosted inference, the budget gets tight.
- **`docs/07-requirements-and-mvp.md` is missing.** The doc index implies eight files; only 01–06 and 08 are checked in. Either it was intentionally cut or it's a gap — worth a one-line note in the doc index either way.
- **The api is a monolith with embedded workers.** Toggled by `*_EMBEDDED` env vars. Good for dev simplicity and the demo; will need a split before any production scale, but that's an explicit, deferred choice — not a mistake.
- **Auth is dual-mode** (Supabase JWT when present, cookie session in dev). Whichever path the demo runs, make sure the smoke tests cover the *actual* deployment mode, not just the dev fallback.
- **Three.js on the landing page only** is the right scope, but it's worth a perf budget check on lower-end conference laptops — the landing is the first impression and the heaviest single page.
- **"iSpring is system of record" is load-bearing.** In dev you're hitting the mock on 4010. The export pipeline (Redis stream → `lms_exports` queue → POST) is the seam most likely to break against real iSpring; there should be a stage-gated integration test against a real sandbox before any pilot.

## 8. One-line summary

> A bank-onboarding platform that lets newcomers practice on a synthetic mirror of Colvir/YABS, asks a multilingual RAG chatbot for grounded answers, and feeds the results into iSpring — packaged for a 10-minute Ideathon stage demo with the latency, language, and data-safety constraints actually enforced in CI.
