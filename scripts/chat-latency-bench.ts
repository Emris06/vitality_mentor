/**
 * Chat latency bench for the Vitality chat path.
 *
 * Fires N sequential POST /chat requests against `API_URL` (default
 * `http://localhost:4000`). Sequential — we want a realistic mix of
 * cache-cold and cache-warm runs, not a load test.
 *
 * For each request we measure:
 *   firstByteMs = time from request open to the first SSE byte.
 *   totalMs     = time until the upstream sends a `done` event or closes.
 *
 * Output: ASCII table with count, mean, P50, P90, P95, P99 for both metrics.
 *
 * Exit code: 1 if P95(totalMs) > 2000 (the brief's chatbot latency budget),
 * 0 otherwise — so CI can gate.
 *
 * CLI flags:
 *   --n=100   number of requests (default 30)
 *
 * Env:
 *   API_URL              base URL for the API (default http://localhost:4000)
 *   CHAT_LATENCY_BUDGET  ms, overrides the 2000ms gate
 */
import { randomUUID } from 'node:crypto';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const BUDGET_MS = Number(process.env.CHAT_LATENCY_BUDGET ?? 2000);

const N = (() => {
  const arg = process.argv.find((a) => a.startsWith('--n='));
  const n = arg ? Number(arg.slice(4)) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

// 20-question pool across en/ru/uz. Questions are deliberately short so the
// model warms quickly; they all hit the same RAG corpus.
const QUESTIONS: { locale: 'en' | 'ru' | 'uz'; q: string }[] = [
  { locale: 'en', q: 'What documents are required to onboard an individual client?' },
  { locale: 'en', q: 'How long does the KYC review take for a low-risk customer?' },
  { locale: 'en', q: 'List the steps to open a UZS current account for a legal entity.' },
  { locale: 'en', q: 'What is the dress code for front-office staff?' },
  { locale: 'en', q: 'Which sanctions lists do we screen against?' },
  { locale: 'en', q: 'Describe the AML escalation path for a medium-risk match.' },
  { locale: 'en', q: 'What is the deposit early-withdrawal penalty policy?' },
  { locale: 'ru', q: 'Какие документы нужны для онбординга физического лица?' },
  { locale: 'ru', q: 'Опиши процесс открытия текущего счёта в сумах.' },
  { locale: 'ru', q: 'Какой регламент по проверке санкционных списков?' },
  { locale: 'ru', q: 'Что входит в обязанности наставника на онбординге?' },
  { locale: 'ru', q: 'Каковы лимиты по переводам для физических лиц?' },
  { locale: 'ru', q: 'Каков порядок эскалации подозрительной транзакции?' },
  { locale: 'ru', q: 'Какие документы хранятся в досье клиента?' },
  { locale: 'uz', q: 'Yangi jismoniy shaxsni ro‘yxatdan o‘tkazish uchun qaysi hujjatlar kerak?' },
  { locale: 'uz', q: 'Joriy hisob ochish bosqichlarini tushuntiring.' },
  { locale: 'uz', q: 'Sanksiyalar ro‘yxatini tekshirish qanday amalga oshiriladi?' },
  { locale: 'uz', q: 'Front-ofis xodimlari uchun dress-kod qanday?' },
  { locale: 'uz', q: 'Mentor onboarding davomida nimaga javob beradi?' },
  { locale: 'uz', q: 'Mijoz dosyesida qanday hujjatlar saqlanadi?' },
];

interface Sample {
  ok: boolean;
  firstByteMs: number;
  totalMs: number;
  bytes: number;
  status: number;
  error?: string;
}

async function oneRequest(idx: number): Promise<Sample> {
  const pick = QUESTIONS[idx % QUESTIONS.length]!;
  const body = {
    sessionId: randomUUID(),
    locale: pick.locale,
    message: pick.q,
  };
  const started = performance.now();
  let firstByte = -1;
  let bytes = 0;
  let status = 0;
  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });
    status = res.status;
    if (!res.ok || !res.body) {
      const total = performance.now() - started;
      return {
        ok: false,
        firstByteMs: firstByte < 0 ? total : firstByte,
        totalMs: total,
        bytes,
        status,
        error: `http ${res.status}`,
      };
    }
    // Stream the body and look for either a `done` event or natural close.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let sawDone = false;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (firstByte < 0) firstByte = performance.now() - started;
      bytes += value.byteLength;
      buf += dec.decode(value, { stream: true });
      // Look for an SSE `event: done` block ending in \n\n.
      if (!sawDone && /\bevent:\s*done\b/.test(buf)) {
        sawDone = true;
        // Drain remaining bytes but don't wait — break to stop the clock.
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
    }
    const total = performance.now() - started;
    return {
      ok: true,
      firstByteMs: firstByte < 0 ? total : firstByte,
      totalMs: total,
      bytes,
      status,
    };
  } catch (err) {
    const total = performance.now() - started;
    return {
      ok: false,
      firstByteMs: firstByte < 0 ? total : firstByte,
      totalMs: total,
      bytes,
      status,
      error: (err as Error).message,
    };
  }
}

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] as number;
}
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}
function fmtMs(n: number): string {
  return n.toFixed(0).padStart(6) + ' ms';
}

async function main(): Promise<void> {
  process.stdout.write(`chat latency bench — Vitality\n`);
  process.stdout.write(`api=${API_URL}  n=${N}  budget=P95<=${BUDGET_MS}ms\n`);
  process.stdout.write('─'.repeat(60) + '\n');

  const samples: Sample[] = [];
  for (let i = 0; i < N; i++) {
    const s = await oneRequest(i);
    samples.push(s);
    const tag = s.ok ? 'OK ' : 'ERR';
    process.stdout.write(
      `  [${String(i + 1).padStart(3)}] ${tag} ` +
        `first=${s.firstByteMs.toFixed(0).padStart(5)}ms ` +
        `total=${s.totalMs.toFixed(0).padStart(6)}ms ` +
        `bytes=${String(s.bytes).padStart(5)}` +
        (s.error ? `  ${s.error}` : '') +
        '\n',
    );
  }

  const okSamples = samples.filter((s) => s.ok);
  const okFirst = okSamples.map((s) => s.firstByteMs);
  const okTotal = okSamples.map((s) => s.totalMs);

  process.stdout.write('\nResults (successful requests only)\n');
  process.stdout.write(
    '  metric        count    mean      P50      P90      P95      P99\n',
  );
  process.stdout.write(
    `  firstByte ${String(okFirst.length).padStart(7)} ${fmtMs(mean(okFirst))} ${fmtMs(
      pct(okFirst, 50),
    )} ${fmtMs(pct(okFirst, 90))} ${fmtMs(pct(okFirst, 95))} ${fmtMs(pct(okFirst, 99))}\n`,
  );
  process.stdout.write(
    `  total     ${String(okTotal.length).padStart(7)} ${fmtMs(mean(okTotal))} ${fmtMs(
      pct(okTotal, 50),
    )} ${fmtMs(pct(okTotal, 90))} ${fmtMs(pct(okTotal, 95))} ${fmtMs(pct(okTotal, 99))}\n`,
  );

  const failCount = samples.length - okSamples.length;
  if (failCount > 0) process.stdout.write(`\nfailures: ${failCount}\n`);

  const p95Total = pct(okTotal, 95);
  const gate = p95Total <= BUDGET_MS && okSamples.length > 0;
  process.stdout.write(
    `\nP95(total)=${p95Total.toFixed(0)}ms  budget=${BUDGET_MS}ms  ${gate ? 'PASS' : 'FAIL'}\n`,
  );
  process.exit(gate ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`bench crashed: ${(err as Error).message}\n`);
  process.exit(1);
});
