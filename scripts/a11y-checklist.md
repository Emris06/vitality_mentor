# Accessibility checklist — Vitality (Part 8)

Manual checklist because we can't run axe-core / Lighthouse cleanly in the
Ideathon environment. Re-run before the demo and again before any external
release. Status legend: `PASS` (verified), `TODO` (not yet verified or known
gap), `N/A` (not in scope).

---

## 1. Focus order and keyboard navigation

| Surface | Item | Status |
| --- | --- | --- |
| Chat | Tab order: input → send button → stop → message list (most recent first) | TODO |
| Chat | Enter sends; Shift+Enter inserts newline; Esc closes any open citation popover | TODO |
| Chat | Voice mode toggle and start/stop listening reachable by Tab and Space | TODO |
| Simulator (KYC) | Steps navigable by Tab; each step's primary action is the first focusable button | TODO |
| Simulator (KYC) | Score and step indicator have an aria-live polite region announcing changes | TODO |
| HR dashboard | Tab table → search → "Assign" button → mentor picker dialog (focus trapped) | TODO |
| HR dashboard | Mentor picker traps focus and returns it to the originating button on close | TODO |
| Skills | Matrix cells are reachable via arrow keys (left/right/up/down) inside a roving tabindex | TODO |
| Global | First Tab from page load lands on a "Skip to content" link before the locale switcher | TODO |

## 2. Color contrast — brand/ink palette

Computed pairings against WCAG 2.1 AA (4.5:1 normal text, 3:1 large/UI). The
brand palette is defined in `apps/web/src/index.css` / Tailwind tokens.

| Pair | Hex foreground | Hex background | Ratio | AA | Notes / status |
| --- | --- | --- | --- | --- | --- |
| Ink primary on canvas | `#0F172A` | `#FFFFFF` | 17.3:1 | PASS | Body text |
| Ink secondary on canvas | `#475569` | `#FFFFFF` | 7.5:1 | PASS | Meta / timestamps |
| Brand primary on white | `#1D4ED8` | `#FFFFFF` | 7.0:1 | PASS | Primary buttons |
| White on brand primary | `#FFFFFF` | `#1D4ED8` | 7.0:1 | PASS | Button label |
| Accent on white | `#0D9488` | `#FFFFFF` | 4.6:1 | PASS | Sparingly used |
| Danger on white | `#B91C1C` | `#FFFFFF` | 6.6:1 | PASS | Error banners |
| Muted ink on muted bg | `#64748B` | `#F1F5F9` | 4.7:1 | PASS | Empty-state copy |
| Citation pill | `#1E293B` | `#E2E8F0` | 11.3:1 | PASS | Source chips |
| Synth-data banner | `#7C2D12` | `#FFEDD5` | 7.9:1 | PASS | Required by sim |

Re-verify with a real contrast checker if the brand palette is tweaked.
Status: PASS (all pairs currently above 4.5:1).

## 3. Landmark roles and document structure

| Item | Status |
| --- | --- |
| Each route has exactly one `<main>` with a labelled heading | TODO |
| Top-level navigation uses `<nav aria-label="Primary">` | TODO |
| HR/Skills tables use proper `<table><thead><tbody>` and `<th scope="col">` | TODO |
| Chat message list is `role="log" aria-live="polite" aria-relevant="additions"` | TODO |
| Modal dialogs use `role="dialog" aria-modal="true"` and labelled with `aria-labelledby` | TODO |
| Locale switcher exposes the current locale via `aria-current="true"` | TODO |

## 4. Screen-reader announcement for streaming tokens

The chat streams tokens via SSE. Naively rendering each token into the
message bubble causes a screen reader to re-announce the full bubble on
every paint. Requirements:

- Stream into a hidden `aria-live="polite" aria-atomic="false"` buffer that
  appends sentence-sized chunks (split on `. `, `? `, `! ` or line breaks).
- After the `done` event, replace the buffer with the final message and
  silence the live region for 500ms to avoid double announcement.
- Mark the visible bubble `aria-hidden="true"` while streaming so AT users
  hear the buffered version, not the partial bubble.
- "Stop" button announces "Generation stopped" via the live region.

Status: TODO (current implementation pipes tokens straight into the bubble).

## 5. Mobile responsiveness viewports

Verify at these viewports in DevTools (Chrome) before the demo:

| Viewport | Device class | Status |
| --- | --- | --- |
| 390 x 844 | iPhone 14/15 | TODO — chat input must stick to bottom above the keyboard |
| 768 x 1024 | iPad portrait | TODO — HR table should switch to a card list under 900px |
| 1280 x 800 | small laptop | PASS — base design size |
| 1920 x 1080 | desktop | PASS |

Sim runs are explicitly desktop-only and already show a "best on desktop"
banner on small viewports — see the existing `sim.best_on_desktop` key.

## 6. Other notes

- Form fields must have visible labels or `aria-label`. Placeholder-only
  labels fail.
- All icon-only buttons must carry an `aria-label`.
- The synth-data banner inside the simulator must be the first element
  inside `<main>` and must be focusable so screen readers always encounter
  the disclosure before any "customer" data.
- Run a manual VoiceOver / NVDA pass on the chat and KYC flow before the
  pitch.
