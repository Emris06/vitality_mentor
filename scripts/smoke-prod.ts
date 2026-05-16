/**
 * Production smoke test — invoked by .github/workflows/deploy.yml after a
 * push to `main` has deployed web/api/ai.
 *
 * What it checks:
 *   1. WEB_URL  GET  /            → 200 within 60s (exponential backoff)
 *   2. API_URL  GET  /health      → 200 within 60s
 *   3. AI_URL   GET  /health      → 200 within 60s
 *   4. (optional, when API_URL is reachable) POST API_URL/chat with a tiny
 *      RU question and assert the SSE/JSON response completes within 6s.
 *      The chat budget is 2s warm; we allow up to 6s here to absorb Railway
 *      free-tier cold-starts on the very first request after a deploy.
 *
 * Output: an ASCII table printed to stdout. Exit 0 on all green; exit 1 on
 * any red so the workflow surfaces a failed deploy.
 *
 * Env:
 *   WEB_URL  required — public Vercel URL
 *   API_URL  required — public Railway API URL
 *   AI_URL   required — public Railway AI URL
 *
 * No external deps — uses the global fetch shipped with Node 20.
 */

interface Probe {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  contentType?: string;
  // Per-probe deadline in ms — chat can be slower than a static health hit.
  deadlineMs: number;
}

interface ProbeResult {
  name: string;
  url: string;
  status: number | 'ERR';
  elapsedMs: number;
  attempts: number;
  ok: boolean;
  detail: string;
}

const WEB_URL = mustEnv('WEB_URL');
const API_URL = mustEnv('API_URL');
const AI_URL = mustEnv('AI_URL');

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[smoke] missing required env: ${name}`);
    process.exit(1);
  }
  return v.replace(/\/$/, '');
}

const HEALTH_DEADLINE_MS = 60_000;
const CHAT_DEADLINE_MS = 6_000;

const probes: Probe[] = [
  { name: 'web', url: WEB_URL + '/', method: 'GET', deadlineMs: HEALTH_DEADLINE_MS },
  { name: 'api/health', url: API_URL + '/health', method: 'GET', deadlineMs: HEALTH_DEADLINE_MS },
  { name: 'ai/health', url: AI_URL + '/health', method: 'GET', deadlineMs: HEALTH_DEADLINE_MS },
  {
    name: 'api/chat (warm)',
    url: API_URL + '/chat',
    method: 'POST',
    contentType: 'application/json',
    // Minimal-shape body — the API tolerates extra fields; locale + question
    // is the only thing the chat route asserts on. The bench script uses the
    // same shape.
    body: JSON.stringify({ locale: 'ru', question: 'Что нужно для открытия счёта?' }),
    deadlineMs: CHAT_DEADLINE_MS,
  },
];

async function probeOnce(p: Probe, signal: AbortSignal): Promise<{ status: number; bodyHint: string }> {
  const init: RequestInit = { method: p.method, signal };
  if (p.method === 'POST') {
    init.headers = { 'content-type': p.contentType ?? 'application/json' };
    init.body = p.body;
  }
  const res = await fetch(p.url, init);
  // Drain a bit of the body — keeps the connection from leaking and gives
  // us a snippet for the failure detail column.
  let snippet = '';
  try {
    const text = await res.text();
    snippet = text.slice(0, 80).replace(/\s+/g, ' ');
  } catch {
    snippet = '<no body>';
  }
  return { status: res.status, bodyHint: snippet };
}

async function runProbe(p: Probe): Promise<ProbeResult> {
  const started = Date.now();
  let attempt = 0;
  let lastErr = '';
  let lastStatus: number | 'ERR' = 'ERR';
  // Exponential backoff: 500ms, 1s, 2s, 4s, capped at 5s. We retry until the
  // probe's deadlineMs has elapsed since `started`.
  let nextDelayMs = 500;
  while (Date.now() - started < p.deadlineMs) {
    attempt++;
    const remaining = p.deadlineMs - (Date.now() - started);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), Math.max(1_000, Math.min(remaining, 15_000)));
    try {
      const { status, bodyHint } = await probeOnce(p, ctl.signal);
      clearTimeout(t);
      lastStatus = status;
      if (status >= 200 && status < 300) {
        return {
          name: p.name,
          url: p.url,
          status,
          elapsedMs: Date.now() - started,
          attempts: attempt,
          ok: true,
          detail: bodyHint,
        };
      }
      lastErr = `HTTP ${status} :: ${bodyHint}`;
    } catch (err) {
      clearTimeout(t);
      lastErr = err instanceof Error ? err.message : String(err);
    }
    // Don't sleep past the deadline.
    const sleepMs = Math.min(nextDelayMs, p.deadlineMs - (Date.now() - started));
    if (sleepMs <= 0) break;
    await new Promise((r) => setTimeout(r, sleepMs));
    nextDelayMs = Math.min(nextDelayMs * 2, 5_000);
  }
  return {
    name: p.name,
    url: p.url,
    status: lastStatus,
    elapsedMs: Date.now() - started,
    attempts: attempt,
    ok: false,
    detail: lastErr || 'timed out',
  };
}

function renderTable(rows: ProbeResult[]): string {
  const headers = ['name', 'status', 'ms', 'tries', 'ok', 'detail'];
  const data = rows.map((r) => [
    r.name,
    String(r.status),
    String(r.elapsedMs),
    String(r.attempts),
    r.ok ? 'PASS' : 'FAIL',
    r.detail.slice(0, 60),
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((row) => row[i].length)),
  );
  const sep = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const fmt = (cells: string[]): string =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
  return [sep, fmt(headers), sep, ...data.map(fmt), sep].join('\n');
}

async function main(): Promise<void> {
  console.log(`[smoke] WEB=${WEB_URL}`);
  console.log(`[smoke] API=${API_URL}`);
  console.log(`[smoke] AI =${AI_URL}`);
  // Run probes in parallel — they don't share state and we want to surface
  // every failure in one pass, not stop at the first.
  const results = await Promise.all(probes.map(runProbe));
  console.log('\n' + renderTable(results));
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n[smoke] ${failed.length}/${results.length} probes failed`);
    process.exit(1);
  }
  console.log(`\n[smoke] all ${results.length} probes passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke] uncaught', err);
  process.exit(1);
});
