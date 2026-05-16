# Ideathon Demo Runbook — AI-Mentor HUB (Vitality)

Operator-facing checklist + 10-minute story beat sheet for the Turonbank
Ideathon stage. Print this. Read it once. Then run it.

> **Synthetic data only. Chat ≤ 2 s. Trilingual.** Three lines. Don't
> drop any of them.

---

## a) Pre-flight (5 minutes before stage)

### 1. Bootstrap the stack

Windows / PowerShell:

```powershell
pnpm demo:setup:win
```

macOS / Linux:

```sh
pnpm demo:setup:nix
```

Wait for the green block at the end:

```
== 6. ready ===========================================================
  seeded:
    skills.skill_nodes        = 10
    skills.role_requirements  = 8
    skills.training_modules   = 13
    hr.employees              = 38 + 3 demo personas
    hr.newcomers              = 8 + 1 (Aziz)
    gamification.badges       = 5
    gamification.quests       = 3
    rag.documents (base)      = 6
    rag.documents (extended)  = 14
```

If any line is missing, **stop and fix** — don't proceed.

### 2. Verify chat latency

```sh
pnpm demo:bench
```

This runs **N=20** requests against `http://localhost:4000/chat` and
hard-fails on `P95(total) > 2000 ms`. You want the **green** banner.

If you get the red banner:

1. Open `services/ai/.env` and switch `GEN_PROVIDER=ollama` →
   `GEN_PROVIDER=openai` (an `OPENAI_API_KEY` must be present in the
   same file).
2. Restart the AI service (`docker compose restart ai` or your local
   `uvicorn`).
3. `pnpm demo:bench` again. If still red, go to the backup video.

### 3. Open the 4 stage tabs (in this order)

| # | URL                                       | Tab title in browser |
|---|-------------------------------------------|----------------------|
| 1 | `http://localhost:5173/`                  | Landing (locale=uz)  |
| 2 | `http://localhost:5173/chat`              | Chat                 |
| 3 | `http://localhost:5173/simulator/kyc`     | KYC Simulator        |
| 4 | `http://localhost:5173/hr`                | HR Dashboard         |

Keep a fifth tab cued but **hidden**: `http://localhost:5173/me`
(Aziz's profile) for Beat 5. And a sixth: `http://localhost:5173/skills`
for the radar.

### 4. Sign in as the demo personas

The seeder creates three stable-id personas:

| Persona              | Role     | Display name        | Used in            |
|----------------------|----------|---------------------|--------------------|
| `Madina Yusupova`    | hr       | HR Business Partner | Beat 4 (HR tab)    |
| `Dilshoda Bobojonova` | mentor   | Senior Compliance   | Beat 4 (picker)    |
| `Aziz Toshmatov`     | newcomer | Junior Compliance   | Beats 2, 3, 5      |

The chat, simulator, and `/me` tabs run as Aziz. The HR tab runs as
Madina.

---

## b) The 10-minute story (beat sheet)

Each beat has a **target end time** in mm:ss. Keep one eye on the
timer.

### Beat 1 — 0:00 → 1:30 — The problem

| Action                                                                            | Word for the audience |
|-----------------------------------------------------------------------------------|-----------------------|
| Show **Tab 1 (Landing)** in Uzbek.                                                | "Bank newcomers can't safely learn real banking operations." |
| Click the locale switcher: `uz` → `ru` → `uz`. Land back on Uzbek.                | "Uzbek and Russian, day one — same interface, same content." |
| Click the **"Start Chat"** CTA → switches to Tab 2.                               | "Let's show how a newcomer gets unstuck." |

**Talking points:**
- Real banking systems can't be used as a sandbox.
- iSpring covers theory; the gap is between "I watched a video" and "I
  can do the operation".

### Beat 2 — 1:30 → 3:30 — RAG knowledge base

| Action                                                                            | Word for the audience |
|-----------------------------------------------------------------------------------|-----------------------|
| Confirm locale = `uz`.                                                            | (silent setup)        |
| Click the prefilled question: **"Yangi jismoniy shaxsni KYC orqali ro'yxatdan o'tkazish uchun qaysi hujjatlar talab qilinadi?"** | "Same question a new hire asks on day three." |
| Tokens stream. Wait for the first sentence.                                       | "Notice the citations — the answer isn't invented, it's grounded in our internal SOPs." |
| Click a **citation chip** → it expands to the source paragraph.                   | "Every answer is auditable." |
| Toggle the **voice button**.                                                      | "Voice mode for tellers on the floor." |
| Switch locale to `ru`, ask: **"Какие документы нужны для онбординга физического лица?"** | "Same source, different language, same answer quality." |

**Latency check:** if the first token didn't appear within ~1.5 s,
say *"and we measured this end-to-end at under two seconds — let me
show you our bench"* and bring up the green banner from `pnpm demo:bench`.

### Beat 3 — 3:30 → 6:30 — Simulator on synthetic data

| Action                                                                            | Word for the audience |
|-----------------------------------------------------------------------------------|-----------------------|
| Switch to **Tab 3 (KYC Simulator)**. New run starts at Step 1 "Intake".           | "All client data on this screen is synthetic." |
| Step 1 → enter the prefilled synthetic passport, click **Submit**.                | "First step: capture the document." |
| Step 2 "Verify Documents" — click **Hint** before submitting.                     | "AI hint with rationale, not just the answer." |
| Read the hint aloud, submit the correct answer.                                   | (move on)             |
| Step 3 "Sanctions Check" — **deliberately submit without checking PEP**.          | "Now watch — I'm going to make a mistake on purpose." |
| Score deducted, mistake recorded with code `missed_pep_flag`.                     | "It logged what I missed and why." |
| Step 4 "Risk Score", Step 5 "Decision" — submit each.                             | (move quickly)        |
| Land on the score screen — should show **88**.                                    | "Not 100. That's the point — the system noticed." |

**Latency check:** the hint endpoint has a graceful fallback. If it
returns the fallback string, just say *"and even if our hint model
times out, the operator gets a usable answer instead of an error"*.

### Beat 4 — 6:30 → 8:00 — HR dashboard + mentor matching

| Action                                                                            | Word for the audience |
|-----------------------------------------------------------------------------------|-----------------------|
| Switch to **Tab 4 (HR Dashboard)** as Madina Yusupova.                            | "Same event flows to HR in real time." |
| Aziz appears at the top with a fresh score = 88. (SSE refresh, no manual reload.) | "Madina sees Aziz needs a mentor — his sanctions step was wobbly." |
| Click **Assign Mentor** on Aziz's row.                                            |                       |
| **Dilshoda Bobojonova** is row 1 in the picker. Hover the score chip.              | "Three weights: availability, skill overlap, language match. All transparent." |
| Click **Assign**.                                                                 | "Done. Aziz now has a mentor whose skills exactly match his gap." |

### Beat 5 — 8:00 → 9:30 — Skills + iSpring + gamification

| Action                                                                            | Word for the audience |
|-----------------------------------------------------------------------------------|-----------------------|
| Open the **Skills** tab (`/skills/employees/<aziz-id>` — the id is printed by the seeder). | "Each employee has a live skill radar." |
| Point at the radar: KYC and Compliance are visibly above Customer Service.        | "And a gap matrix against the role he's targeting." |
| Show the readiness gauge for **senior_compliance**.                               | "Right now Aziz is 38% ready for senior compliance. We can tell him exactly which two modules close the gap." |
| Switch to `/me` (Aziz's profile).                                                 | "Aziz's view of his own progress." |
| Point at the streak ring, the XP bars, and the **first_kyc** badge.               | "Streak. XP per skill. And his first badge — earned 20 minutes ago." |
| Open the LMS exports tab: `http://localhost:4000/lms/exports?status=submitted`.   | "And his KYC result is already in iSpring." |

### Beat 6 — 9:30 → 10:00 — Close

| Action                                                                            | Word for the audience |
|-----------------------------------------------------------------------------------|-----------------------|
| Switch back to the slide with the three non-negotiables.                          | "Three rules we don't break." |
| Slide content:                                                                    |                       |
|   1. Synthetic data only.                                                         |                       |
|   2. Chat ≤ 2 seconds, end to end.                                                |                       |
|   3. Uzbek and Russian, parity.                                                   |                       |
| "Questions?"                                                                      |                       |

---

## c) Failure plays

| Failure                                       | Play                                                                                                                              |
|-----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Chat times out or stalls > 5 s.               | The 1-hour response cache (Part 1) returns the prior answer. Re-ask the **exact same question** — second hit is < 200 ms.         |
| Simulator hint endpoint errors.               | The hint returns a graceful fallback string. Don't apologise — say *"and even with the AI hint offline, the user still gets a hint."* |
| HR dashboard SSE stream drops (no live update). | Click any column header — the table refetches over HTTP and the new row appears.                                                  |
| `/me` doesn't show the badge.                 | The badge was seeded directly. Refresh the tab (Ctrl-R). If still missing, point at the XP bars instead and skip the badge call-out.|
| Whole UI doesn't render.                      | Check `docker ps`. If `vitality-api` or `vitality-ai` is restarting, run `pnpm stack:up` again and `pnpm demo:bench`.              |
| Stack is dead / network is hostile.           | Open the backup video (see `infra/demo/BACKUP_VIDEO.md`). Don't try to fix live; the clock is running.                            |

---

## d) Required env at demo time

`services/ai/.env`:

```ini
# pick one — DO NOT leave both empty
GEN_PROVIDER=openai
OPENAI_API_KEY=sk-...

# fallback if you're offline
# GEN_PROVIDER=ollama
# OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M
```

`services/api/.env`:

```ini
NODE_ENV=production
DATABASE_URL=postgres://vitality:vitality@localhost:5432/vitality
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
ISPRING_BASE_URL=http://localhost:4010
```

`apps/web/.env`:

```ini
VITE_API_URL=http://localhost:4000
```

**Latency budget verified within the last 10 minutes.** If your last
`pnpm demo:bench` was more than 10 minutes ago, run it again before
walking on stage.

---

## TODO (human)

- [ ] Record the 90-second backup video per `infra/demo/BACKUP_VIDEO.md`.
- [ ] Print this runbook double-sided, one copy per operator.
- [ ] Confirm with the venue that ports 4000, 5173, 8000, 4010, 5432,
      6379, 9000-9001 are not blocked on the demo Wi-Fi.
