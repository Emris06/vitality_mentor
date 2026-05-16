# AI-Mentor

The AI-powered onboarding platform for financial institutions. Single platform for three tracks:

1. **Knowledge Base** — RAG-grounded multilingual Q&A (Uzbek / Russian / English)
2. **Bank Operations Simulator** — KYC, accounts, deposits, transfers on synthetic data only
3. **Skills Analysis** — skill maps, gap analytics, training recommendations, forecasting

Plan: `C:\Users\NoteService\.claude\plans\lets-start-the-project-abstract-squid.md`
Brief: `docs/` (8 small files — read only what the task needs)
Working agreement: `CLAUDE.md`

## Layout

```
apps/web            React + Vite + TS UI
services/api        Node.js (Fastify) — orchestration, HR, gamification, iSpring
services/ai         Python (FastAPI) — RAG, embeddings, simulator hints, forecasting
packages/shared     TS types shared between web and API
infra/docker        Postgres (pgvector), Redis, MinIO, service Dockerfiles
docs                Project brief, split into 8 small files
```

## Prerequisites

- Node.js ≥ 20.11 and pnpm 9
- Python ≥ 3.11
- Docker Desktop (for Postgres, Redis, MinIO, and full-stack runs)

## First-run

```sh
cp services/api/.env.example services/api/.env
cp services/ai/.env.example  services/ai/.env
cp apps/web/.env.example     apps/web/.env

pnpm install
pnpm stack:up           # postgres + redis + minio (and optionally api+ai once built)
pnpm dev:api            # in a second terminal
pnpm dev:web            # in a third terminal — opens http://localhost:5173
```

You should see the landing page render in three locales and the "System status"
card hit `/api/health` → all checks green within ~1s.

The Python AI service runs separately during dev:

```sh
cd services/ai
python -m venv .venv && . .venv/Scripts/activate    # or `source .venv/bin/activate` on macOS/Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

## Hard constraints (from `CLAUDE.md`)

- **Synthetic data only** in the simulator. No real client data, ever.
- **Chatbot ≤ 2 s** end-to-end.
- **RAG-grounded** answers — no free-form LLM.
- **Uzbek + Russian** must work for everything user-facing.
- **iSpring LMS** is the system of record for training results.

## Ideathon Demo

For the 10-minute stage walk-through, three things to know:

1. **One-shot bootstrap** — resets the stack into a known, deterministic
   demo state (skills taxonomy + HR cohort + three fixed personas: Madina
   Yusupova / Dilshoda Karimovna / Aziz Toshmatov + 20 synthetic SOP
   documents):

   ```sh
   pnpm demo:setup:win     # Windows / PowerShell
   pnpm demo:setup:nix     # macOS / Linux
   ```

2. **Chat latency gate** — N=20 requests against `/chat`, fails loud if
   P95 > 2000 ms. Run within 10 minutes of going on stage:

   ```sh
   pnpm demo:bench
   ```

3. **The four tabs to open**:
   - `http://localhost:5173/` — Landing (locale=uz)
   - `http://localhost:5173/chat` — Chat
   - `http://localhost:5173/simulator/kyc` — KYC Simulator
   - `http://localhost:5173/hr` — HR Dashboard

Full beat-by-beat operator script with failure plays:
[`infra/demo/RUNBOOK.md`](infra/demo/RUNBOOK.md). Pitch deck alignment:
[`infra/demo/PITCH_NOTES.md`](infra/demo/PITCH_NOTES.md). Backup video
recording recipe: [`infra/demo/BACKUP_VIDEO.md`](infra/demo/BACKUP_VIDEO.md).
