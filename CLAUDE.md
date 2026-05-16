# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This is an Ideathon submission to Turonbank. The brief is in [`docs/`](docs/); the only code so far is a bare `package.json` with `framer-motion` installed — no app scaffold, no build/lint/test pipeline yet. Not a git repository. When the user asks you to start building, confirm which track / feature is in scope before generating code; the brief covers three tracks (Knowledge Base, Skills Analysis, Bank Operations Simulator) and you should not assume all three are in play. There are no commonly-used dev commands to document yet — add them here when a real scaffold lands.

## How to read the brief — do not load it all at once

The brief was deliberately split into 8 small files under [`docs/`](docs/) so you can pull in only the section relevant to the current task. **Do not Read every part by default** — pick the one or two parts that actually inform the task.

Mapping from common tasks to the part you should read:

| Task                                                | Read                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Scoping / framing a feature                         | `docs/01-overview-and-problem.md`                           |
| UI or flow for HR / Mentor / Newcomer               | `docs/02-users.md` + `docs/05-user-flows.md`                |
| "Why are we building X?"                            | `docs/03-solutions.md`                                      |
| Picking what to build for a track                   | `docs/04-features-by-track.md`                              |
| Scaffolding services, choosing libraries, API shape | `docs/06-architecture-and-stack.md`                         |
| Performance, security, "is the MVP done?"           | `docs/07-requirements-and-mvp.md`                           |
| Pitch deck / storytelling only                      | `docs/08-design-thinking.md` (skip for implementation work) |

If the task touches more than one area (e.g., building the chatbot end-to-end), read the parts in parallel rather than reading the whole index file first.

## Non-negotiable constraints

Restated here so you don't need to open a doc to remember them. These shape every implementation decision and must not be relaxed without the user's say-so:

- **Synthetic data only** in the Bank Operations Simulator. No real client data, no live connection to Colvir/YABS. This is the core security premise of the product — treat any suggestion to wire to a real banking system as out of scope. (See `docs/03-solutions.md` problem 1, `docs/07-requirements-and-mvp.md`.)
- **Chatbot latency ≤ 2 seconds** end-to-end. Architectural choices for the Q&A path (model size, retrieval, caching) must respect this.
- **RAG-grounded answers, not free-form LLM.** The Q&A assistant retrieves from internal bank documents and answers from them to prevent hallucination. Don't propose ungrounded chat.
- **Uzbek and Russian** must both work for any user-facing text and the Q&A pipeline. English-only is not acceptable for shipped features.
- **iSpring LMS** is the system of record for training results — progress and assessment outcomes are exported there.

## Intended tech stack

From `docs/06-architecture-and-stack.md`. Defaults when scaffolding, unless the user picks otherwise:

- Frontend: React.js **or** Vue.js (pick one — the brief lists alternatives, not both), mobile-responsive web
- Backend: Python for AI/ML, Node.js for the API layer, behind an API gateway
- Data: PostgreSQL for user progress and logs
- AI: LLM + RAG, NLP supporting English + Uzbek + Russian
- Integrations: iSpring LMS, HR system API

Clarify the frontend choice and the Python/Node split with the user before generating both stacks.
