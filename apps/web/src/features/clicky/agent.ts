// ──────────────────────────────────────────────────────────────────────────
// Local Clicky agent stub.
//
// Takes a spoken question + a snapshot of the page, and decides:
//   - where to move Clicky (which DOM element to point at), and
//   - what to say when it arrives.
//
// Today this is a deterministic keyword matcher. Tomorrow the same input
// shape can be sent to a backend `/clicky/intent` endpoint that runs an LLM
// over the targets — the contract is the only thing the rest of the app
// depends on, so the swap is local.
// ──────────────────────────────────────────────────────────────────────────

export interface PageTarget {
  /** A CSS selector that resolves back to the element (we use a uid). */
  uid: string;
  /** Comma-separated keywords/synonyms declared on the element. */
  keywords: string[];
  /** Optional: the hint Clicky should say when it arrives. */
  hint: string | null;
  /** Visible text inside the element — used as a fallback signal. */
  label: string;
  /** Bounding rect at scan time. */
  rect: { x: number; y: number; w: number; h: number };
}

export type AgentAction =
  | {
      type: 'point';
      uid: string;
      hint: string;
      spoken: string;
    }
  | {
      type: 'noop';
      spoken: string;
    };

export interface AgentInput {
  transcript: string;
  targets: PageTarget[];
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'it',
  'to',
  'do',
  'i',
  'me',
  'my',
  'how',
  'what',
  'where',
  'should',
  'can',
  'this',
  'that',
  'please',
  'ok',
  'okay',
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreTarget(qTokens: string[], target: PageTarget): number {
  const hay = new Set(tokens(`${target.keywords.join(' ')} ${target.label}`));
  let score = 0;
  for (const t of qTokens) {
    if (target.keywords.includes(t)) score += 3; // direct keyword hit
    else if (hay.has(t)) score += 1; // label/hint hit
  }
  return score;
}

/** Run the deterministic local agent. Always synchronous, instant. */
export function runLocalAgent(input: AgentInput): AgentAction {
  const q = input.transcript.trim();
  if (!q) {
    return { type: 'noop', spoken: 'I did not catch that — try again.' };
  }
  const qTokens = tokens(q);

  let best: PageTarget | null = null;
  let bestScore = 0;
  for (const t of input.targets) {
    const s = scoreTarget(qTokens, t);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }

  if (!best || bestScore === 0) {
    return {
      type: 'noop',
      spoken: `I am not sure what to point at. Try naming a button — for example "start", "skills", or "ask AI".`,
    };
  }

  return {
    type: 'point',
    uid: best.uid,
    hint: best.hint ?? `Here — ${best.label}.`,
    spoken: `Got it. Here is "${best.label}".`,
  };
}

/** Scan the current DOM for elements annotated with data-clicky-target. */
export function scanPageTargets(root: ParentNode = document): PageTarget[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('[data-clicky-target]'),
  );
  const out: PageTarget[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    // Skip elements that are not visible right now — agent should only
    // point at things the user can actually see.
    if (rect.width === 0 || rect.height === 0) continue;
    const uid = `cly-${i}`;
    el.dataset.clickyUid = uid;
    const keywords = (el.dataset.clickyTarget ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    out.push({
      uid,
      keywords,
      hint: el.dataset.clickyHint?.trim() || null,
      label: (el.textContent ?? '').trim().slice(0, 80),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    });
  }
  return out;
}

/** Resolve a uid produced by scanPageTargets back to its element. */
export function findTargetElement(uid: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-clicky-uid="${uid}"]`);
}
