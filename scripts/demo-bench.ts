/**
 * scripts/demo-bench.ts — short-form chat latency bench for the Ideathon stage.
 *
 * Wraps `scripts/chat-latency-bench.ts` and:
 *   1. Forces N=20 (Ideathon stage time matters; the 100-shot CI bench takes
 *      too long when you're about to walk on stage).
 *   2. Targets http://localhost:4000 by default (override with API_URL).
 *   3. Hard-fails on P95(total) > BUDGET_MS with a loud red ASCII banner.
 *
 * Exit codes propagate from the underlying bench: 0 = pass, 1 = fail.
 *
 * Usage:
 *   pnpm demo:bench
 *   API_URL=http://localhost:4000 CHAT_LATENCY_BUDGET=2000 pnpm demo:bench
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH_ENTRY = resolve(HERE, 'chat-latency-bench.ts');

const BUDGET_MS = Number(process.env.CHAT_LATENCY_BUDGET ?? 2000);
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const N = 20;

function banner(text: string, color: 'red' | 'green'): void {
  const code = color === 'red' ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';
  const line = '#'.repeat(72);
  process.stdout.write(`\n${code}${line}\n`);
  for (const ln of text.split('\n')) {
    const padded = ln.padEnd(68);
    process.stdout.write(`# ${padded}#\n`);
  }
  process.stdout.write(`${line}${reset}\n\n`);
}

function main(): void {
  process.stdout.write(`demo-bench — Vitality Ideathon stage check\n`);
  process.stdout.write(`  api    = ${API_URL}\n`);
  process.stdout.write(`  n      = ${N}\n`);
  process.stdout.write(`  budget = P95(total) <= ${BUDGET_MS} ms\n`);
  process.stdout.write('-'.repeat(72) + '\n');

  const r = spawnSync(
    process.execPath,
    ['--import=tsx/esm', BENCH_ENTRY, `--n=${N}`],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        API_URL,
        CHAT_LATENCY_BUDGET: String(BUDGET_MS),
      },
    },
  );

  if (r.status === 0) {
    banner(
      'CHAT LATENCY: PASS\n' +
        `P95(total) <= ${BUDGET_MS} ms across ${N} requests.\n` +
        'Safe to demo. Keep this terminal open as proof during the talk.',
      'green',
    );
    process.exit(0);
  } else {
    banner(
      '!! CHAT LATENCY: FAIL !!\n' +
        `P95(total) > ${BUDGET_MS} ms (budget breached). DO NOT DEMO.\n` +
        'Mitigations:\n' +
        '  1. Switch GEN_PROVIDER from ollama -> openai in services/ai/.env\n' +
        '     and restart the AI service.\n' +
        '  2. Re-run: pnpm demo:bench\n' +
        '  3. If still failing, switch to the backup video (infra/demo/BACKUP_VIDEO.md).',
      'red',
    );
    process.exit(r.status ?? 1);
  }
}

main();
