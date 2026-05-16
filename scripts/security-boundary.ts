/**
 * Security boundary check.
 *
 * Enforces the Ideathon non-negotiable: the Bank Operations Simulator and
 * everything around it must run on synthetic data only. This script fails CI
 * if it spots any of the leak patterns below.
 *
 * Scan roots: apps/, services/, packages/, infra/
 * File types: *.ts, *.tsx, *.py, *.sql
 *
 * Forbidden patterns:
 *   1. Substring match (case-insensitive) on "Colvir" or "YABS" (the
 *      production core-banking systems we are explicitly NOT integrating).
 *   2. Plaintext IBAN-like tokens (`\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b`) AND
 *      Uzbek-style INN (`\b\d{9}\b` or `\b\d{14}\b`) on a non-comment line in
 *      a file whose path does not contain `synth-data` or `test`.
 *   3. Real-person substring match on a small banned list: Karimov,
 *      Mirziyoyev, "Saida Mirziyoyeva".
 *   4. "production iSpring" or "prod.ispring" outside of `infra/mocks/`.
 *
 * Synth-data guarantee:
 *   - `packages/synth-data/src/persons.ts` MUST contain `synthetic: true`
 *     and a banned-token guard.
 *
 * Exit code: 0 if clean, 1 on any FAIL. Heuristic — favors false positives.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(HERE, '..', '..');

const SCAN_ROOTS = ['apps', 'services', 'packages', 'infra'].map((d) =>
  resolve(REPO_ROOT, d),
);
const FILE_EXTS = ['.ts', '.tsx', '.py', '.sql'];
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.venv',
  '__pycache__',
  '.git',
]);

interface Hit {
  category:
    | 'colvir_yabs'
    | 'iban_like'
    | 'inn_like'
    | 'banned_person'
    | 'prod_ispring'
    | 'synth_guard_missing';
  file: string;
  line: number;
  sample: string;
}

// ---------- Helpers ----------
function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc);
    else if (FILE_EXTS.some((e) => full.endsWith(e))) acc.push(full);
  }
  return acc;
}

function isCommentLine(line: string, file: string): boolean {
  const trimmed = line.trimStart();
  if (file.endsWith('.py')) return trimmed.startsWith('#');
  if (file.endsWith('.sql')) return trimmed.startsWith('--');
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function isExempt(file: string): boolean {
  const norm = file.split(sep).join('/');
  return norm.includes('/synth-data/') || /\btest(s)?\b/.test(norm) || norm.includes('/fixtures/');
}

// ---------- Patterns ----------
const COLVIR_YABS = /\b(colvir|yabs)\b/i;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/;
const INN_RE = /\b(?:\d{9}|\d{14})\b/;
const BANNED_PERSONS = ['Karimov', 'Mirziyoyev', 'Saida Mirziyoyeva'];
const PROD_ISPRING = /(production iSpring|prod\.ispring)/i;

// Allowlist of harmless IBAN-shaped tokens common in code (e.g. SHA-like
// hashes — already excluded by the [A-Z]{2}\d{2} prefix — and currency
// codes). We rely on the file-path exemption for real data.

function scanFile(file: string): Hit[] {
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const hits: Hit[] = [];
  const lines = src.split(/\r?\n/);
  const exemptPath = isExempt(file);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const lineNo = i + 1;

    // colvir/yabs: always a fail, comment or not.
    const cm = line.match(COLVIR_YABS);
    if (cm) {
      hits.push({ category: 'colvir_yabs', file, line: lineNo, sample: line.trim().slice(0, 200) });
    }

    // prod ispring: fail outside infra/mocks.
    const pm = line.match(PROD_ISPRING);
    if (pm && !file.includes(`${sep}infra${sep}mocks${sep}`)) {
      hits.push({ category: 'prod_ispring', file, line: lineNo, sample: line.trim().slice(0, 200) });
    }

    // banned persons: case-sensitive substring.
    for (const name of BANNED_PERSONS) {
      if (line.includes(name)) {
        hits.push({
          category: 'banned_person',
          file,
          line: lineNo,
          sample: `${name} :: ${line.trim().slice(0, 180)}`,
        });
      }
    }

    if (exemptPath || isCommentLine(line, file)) continue;

    if (IBAN_RE.test(line)) {
      hits.push({ category: 'iban_like', file, line: lineNo, sample: line.trim().slice(0, 200) });
    }
    // Skip INN check on lines that look like length/limit literals.
    if (INN_RE.test(line) && !/length|max|min|limit|timeout|port|version/i.test(line)) {
      hits.push({ category: 'inn_like', file, line: lineNo, sample: line.trim().slice(0, 200) });
    }
  }
  return hits;
}

function checkSynthGuard(): Hit[] {
  const file = resolve(REPO_ROOT, 'packages', 'synth-data', 'src', 'persons.ts');
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return [
      {
        category: 'synth_guard_missing',
        file,
        line: 0,
        sample: 'persons.ts is unreadable or missing',
      },
    ];
  }
  const hits: Hit[] = [];
  if (!/synthetic\s*:\s*true/.test(src)) {
    hits.push({
      category: 'synth_guard_missing',
      file,
      line: 0,
      sample: 'missing `synthetic: true` marker on generated records',
    });
  }
  if (!/BANNED_TOKENS|bannedTokensInName/.test(src)) {
    hits.push({
      category: 'synth_guard_missing',
      file,
      line: 0,
      sample: 'missing banned-token guard (expected BANNED_TOKENS / bannedTokensInName)',
    });
  }
  return hits;
}

// ---------- Run ----------
function main(): void {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) files.push(...walk(root));

  // Exclude this script itself and its sibling i18n script from scanning —
  // they reference the banned tokens as documentation strings.
  const selfDir = resolve(REPO_ROOT, 'scripts');
  const filtered = files.filter((f) => !f.startsWith(selfDir));

  const allHits: Hit[] = [];
  for (const f of filtered) allHits.push(...scanFile(f));
  allHits.push(...checkSynthGuard());

  const buckets: Record<Hit['category'], Hit[]> = {
    colvir_yabs: [],
    iban_like: [],
    inn_like: [],
    banned_person: [],
    prod_ispring: [],
    synth_guard_missing: [],
  };
  for (const h of allHits) buckets[h.category].push(h);

  process.stdout.write('security boundary audit — Vitality\n');
  process.stdout.write('─'.repeat(60) + '\n');
  process.stdout.write(`scanned ${filtered.length} files under ${SCAN_ROOTS.length} roots\n\n`);

  let fail = false;
  for (const [cat, hs] of Object.entries(buckets) as [Hit['category'], Hit[]][]) {
    const tag = hs.length === 0 ? 'OK' : 'FAIL';
    if (hs.length > 0) fail = true;
    process.stdout.write(`[${tag}] ${cat}: ${hs.length}\n`);
    for (const h of hs.slice(0, 5)) {
      const rel = h.file.replace(REPO_ROOT + sep, '');
      process.stdout.write(`    ${rel}:${h.line}  ${h.sample}\n`);
    }
    if (hs.length > 5) process.stdout.write(`    … ${hs.length - 5} more\n`);
  }
  process.stdout.write('\n' + (fail ? 'FAILED' : 'OK') + '\n');
  process.exit(fail ? 1 : 0);
}

main();
