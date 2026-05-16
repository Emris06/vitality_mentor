# Pitch Deck Alignment — AI-Mentor HUB (Vitality)

Maps each slide of the Ideathon pitch deck to the exact section of the
project brief that backs it up, and gives the operator one tight
talking point per slide. Use alongside `infra/demo/RUNBOOK.md`.

> The slide numbers below assume the standard 10-slide Ideathon deck.
> If your final deck reorders slides, keep the *source-doc anchors*
> below in the speaker notes so the story stays consistent with the
> brief.

---

## Slide-by-slide

### Slide 1 — Title + Team

**Source:** `README.md` (project name, three tracks).

**Talking point (one sentence):**
> "AI-Mentor HUB — one platform for the three places a new Turonbank
> employee gets stuck: knowing, doing, and being seen."

---

### Slide 2 — The problem

**Source:** [`docs/01-overview-and-problem.md`](../../docs/01-overview-and-problem.md)
and [`docs/03-solutions.md`](../../docs/03-solutions.md) (problem statements 1-3).

**Talking point:**
> "Three real frictions: newcomers can't safely practice on Colvir,
> HR has no live picture of skill gaps, and onboarding theory and
> practice are two disconnected systems."

---

### Slide 3 — The three users

**Source:** [`docs/02-users.md`](../../docs/02-users.md)
(HR, Mentor, Newcomer personas).

**Talking point:**
> "We designed for three people, not one. HR sees the cohort, the
> mentor sees the match, the newcomer sees their own progress."

---

### Slide 4 — Our solution

**Source:** [`docs/03-solutions.md`](../../docs/03-solutions.md)
(the three solution paragraphs that mirror the three problems).

**Talking point:**
> "One platform: a RAG-grounded multilingual chatbot, a synthetic-data
> banking simulator, and a live skill map that feeds HR and the
> mentor matcher."

---

### Slide 5 — The three tracks

**Source:** [`docs/04-features-by-track.md`](../../docs/04-features-by-track.md).

**Talking point:**
> "Knowledge Base, Simulator, Skills Analysis. We built all three
> because the problem isn't any single one of them — it's the gap
> between them."

---

### Slide 6 — User flow (live demo trigger)

**Source:** [`docs/05-user-flows.md`](../../docs/05-user-flows.md)
(the three flows: HR assigns, Newcomer practices, Mentor monitors).

**Talking point:**
> "Let me walk you through this." *(switch to live demo, follow
> `RUNBOOK.md` Beats 1-5.)*

---

### Slide 7 — Architecture

**Source:** [`docs/06-architecture-and-stack.md`](../../docs/06-architecture-and-stack.md).

**Talking point:**
> "React up front, two services behind a gateway: Node for the
> orchestration and HR domain, Python for the AI. Postgres with
> pgvector for retrieval. iSpring is the system of record."

---

### Slide 8 — Non-negotiables

**Source:** [`docs/07-requirements-and-mvp.md`](../../docs/07-requirements-and-mvp.md)
(performance, security, language coverage).

**Talking point:**
> "Three rules we don't relax: synthetic data only, chat under two
> seconds end-to-end, Uzbek and Russian on every user-facing surface."

---

### Slide 9 — How we built it (design thinking)

**Source:** [`docs/08-design-thinking.md`](../../docs/08-design-thinking.md)
(Empathize → Define → Ideate → Prototype).

**Talking point:**
> "We started with three frustrated users. We ended with a system
> that addresses the actual blockers, not just the surface complaints."

---

### Slide 10 — Close + ask

**Source:** [`docs/07-requirements-and-mvp.md`](../../docs/07-requirements-and-mvp.md)
(MVP scope = what we have today).

**Talking point:**
> "Today: working MVP across all three tracks. Next: pilot in two
> branches for six weeks. Ask: green-light the pilot and a
> production iSpring connector."

---

## Beat ↔ slide cross-reference

For the live-demo portion (`RUNBOOK.md` section b), this is which
slide the operator should mentally return to during each beat:

| Beat | Demo focus              | Anchor slide     |
|------|-------------------------|------------------|
| 1    | Problem framing         | Slide 2          |
| 2    | RAG, multilingual chat  | Slide 4 + 8      |
| 3    | Simulator               | Slide 4          |
| 4    | Mentor matching         | Slide 6          |
| 5    | Skills + gamification   | Slide 5          |
| 6    | Close                   | Slide 8 + 10     |

---

## TODO (human)

- [ ] Insert real slide numbers above once the final deck is locked.
- [ ] Add presenter photos to Slide 1.
- [ ] Validate the source-doc anchors with the pitch coach.
