/**
 * i18n completeness audit.
 *
 * Runs against `apps/web/src/i18n/locales/{en,ru,uz}.json`.
 *
 * Checks (all FAIL on mismatch, non-zero exit):
 *   1. Missing keys (present in en, absent in another locale).
 *   2. Extra keys (present in another locale, absent in en).
 *   3. Empty string values anywhere.
 *   4. Placeholder mismatch (`{{name}}` interpolations) per key across locales.
 *   5. Plural family completeness:
 *        - en: { one, other }
 *        - ru: { one, few, many, other }
 *        - uz: { one, other }
 *
 * Warnings (non-fatal):
 *   - Keys referenced from `apps/web/src/**\/*.{ts,tsx}` via t('...') or
 *     i18nKey="..." that are absent from any locale.
 *   - Keys present in en.json that no source file references.
 *
 * CLI flags:
 *   --json   Emit a JSON report to stdout instead of a human summary.
 *
 * Exit code: 0 on clean, 1 on any FAIL. Warnings never affect exit code.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type FlatMap = Map<string, Json>;

interface Issue {
  category:
    | 'missing_key'
    | 'extra_key'
    | 'empty_value'
    | 'placeholder_mismatch'
    | 'plural_incomplete';
  locale: string;
  key: string;
  detail?: string;
}

interface Warning {
  category: 'key_in_code_missing_locale' | 'key_unused_in_code';
  locale?: string;
  key: string;
  detail?: string;
}

interface Report {
  ok: boolean;
  failures: Issue[];
  warnings: Warning[];
  stats: {
    locales: string[];
    keyCount: Record<string, number>;
    codeRefCount: number;
  };
}

// ---------- Plural rules per locale ----------
const PLURAL_FORMS: Record<string, string[]> = {
  en: ['one', 'other'],
  ru: ['one', 'few', 'many', 'other'],
  uz: ['one', 'other'],
};
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;

// ---------- Helpers ----------
const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(HERE, '..', '..');
const LOCALES_DIR = resolve(REPO_ROOT, 'apps', 'web', 'src', 'i18n', 'locales');
const WEB_SRC_DIR = resolve(REPO_ROOT, 'apps', 'web', 'src');

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');

function readJson(p: string): Json {
  return JSON.parse(readFileSync(p, 'utf8')) as Json;
}

function flatten(obj: Json, prefix = '', out: FlatMap = new Map()): FlatMap {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out.set(prefix, obj);
    return out;
  }
  for (const k of Object.keys(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    flatten((obj as Record<string, Json>)[k] as Json, next, out);
  }
  return out;
}

function extractPlaceholders(v: Json): string[] {
  if (typeof v !== 'string') return [];
  const matches = v.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.replace(/[{}\s]/g, '')))).sort();
}

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, exts, acc);
    } else if (exts.some((e) => full.endsWith(e))) {
      acc.push(full);
    }
  }
  return acc;
}

function collectCodeKeys(): Set<string> {
  const files = walk(WEB_SRC_DIR, ['.ts', '.tsx']);
  const keys = new Set<string>();
  const tRe = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
  const i18nKeyRe = /\bi18nKey\s*=\s*["']([^"']+)["']/g;
  for (const f of files) {
    let src: string;
    try {
      src = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(tRe)) keys.add(m[1] as string);
    for (const m of src.matchAll(i18nKeyRe)) keys.add(m[1] as string);
  }
  return keys;
}

// ---------- Audit ----------
function audit(): Report {
  const locales = ['en', 'ru', 'uz'] as const;
  const raw: Record<string, Json> = {};
  const flat: Record<string, FlatMap> = {};
  for (const loc of locales) {
    raw[loc] = readJson(join(LOCALES_DIR, `${loc}.json`));
    flat[loc] = flatten(raw[loc] as Json);
  }

  const failures: Issue[] = [];
  const warnings: Warning[] = [];

  const enKeys = new Set(flat.en!.keys());

  // 1 + 2: key set diffs.
  for (const loc of locales) {
    if (loc === 'en') continue;
    const here = new Set(flat[loc]!.keys());
    for (const k of enKeys) {
      if (!here.has(k)) failures.push({ category: 'missing_key', locale: loc, key: k });
    }
    for (const k of here) {
      if (!enKeys.has(k)) failures.push({ category: 'extra_key', locale: loc, key: k });
    }
  }

  // 3: empty string values.
  for (const loc of locales) {
    for (const [k, v] of flat[loc]!) {
      if (typeof v === 'string' && v.trim() === '') {
        failures.push({ category: 'empty_value', locale: loc, key: k });
      }
    }
  }

  // 4: placeholder mismatch (compare each non-en against en).
  for (const k of enKeys) {
    const enPh = extractPlaceholders(flat.en!.get(k) as Json);
    if (enPh.length === 0) continue;
    for (const loc of locales) {
      if (loc === 'en') continue;
      if (!flat[loc]!.has(k)) continue; // already flagged as missing.
      const here = extractPlaceholders(flat[loc]!.get(k) as Json);
      const aSet = enPh.join('|');
      const bSet = here.join('|');
      if (aSet !== bSet) {
        failures.push({
          category: 'placeholder_mismatch',
          locale: loc,
          key: k,
          detail: `en=[${enPh.join(',')}] ${loc}=[${here.join(',')}]`,
        });
      }
    }
  }

  // 5: plural family completeness — within each locale.
  for (const loc of locales) {
    const required = PLURAL_FORMS[loc] ?? ['one', 'other'];
    // group keys by their base (strip plural suffix).
    const families = new Map<string, Set<string>>();
    for (const k of flat[loc]!.keys()) {
      const m = k.match(PLURAL_SUFFIX_RE);
      if (!m) continue;
      const base = k.slice(0, -m[0].length);
      const form = m[1] as string;
      let set = families.get(base);
      if (!set) {
        set = new Set();
        families.set(base, set);
      }
      set.add(form);
    }
    for (const [base, found] of families) {
      const missing = required.filter((f) => !found.has(f));
      if (missing.length > 0) {
        failures.push({
          category: 'plural_incomplete',
          locale: loc,
          key: base,
          detail: `missing forms: ${missing.join(',')} (have: ${[...found].join(',')})`,
        });
      }
    }
  }

  // Warnings: code-vs-locale drift.
  const codeKeys = collectCodeKeys();
  for (const k of codeKeys) {
    // Only warn when the key (or any of its plural variants) is missing in en.
    const candidates = [k, `${k}_one`, `${k}_other`, `${k}_few`, `${k}_many`, `${k}_zero`, `${k}_two`];
    const present = candidates.some((c) => enKeys.has(c)) || hasPrefix(enKeys, `${k}.`);
    if (!present) {
      warnings.push({ category: 'key_in_code_missing_locale', key: k });
    }
  }
  for (const k of enKeys) {
    // Strip plural suffix for the lookup — code references the base.
    const base = k.replace(PLURAL_SUFFIX_RE, '');
    const referenced =
      codeKeys.has(k) || codeKeys.has(base) || hasAncestor(codeKeys, k);
    if (!referenced) {
      warnings.push({ category: 'key_unused_in_code', locale: 'en', key: k });
    }
  }

  const stats = {
    locales: [...locales],
    keyCount: Object.fromEntries(locales.map((l) => [l, flat[l]!.size])) as Record<
      string,
      number
    >,
    codeRefCount: codeKeys.size,
  };

  return { ok: failures.length === 0, failures, warnings, stats };
}

function hasPrefix(set: Set<string>, prefix: string): boolean {
  for (const k of set) if (k.startsWith(prefix)) return true;
  return false;
}

function hasAncestor(set: Set<string>, key: string): boolean {
  // a code ref of `chat` matches any `chat.*` locale key.
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const candidate = parts.slice(0, i).join('.');
    if (set.has(candidate)) return true;
  }
  return false;
}

// ---------- Output ----------
function fmt(report: Report): string {
  const lines: string[] = [];
  lines.push('i18n audit — Vitality');
  lines.push('─'.repeat(60));
  lines.push(
    `locales=${report.stats.locales.join(',')} ` +
      `keys=${Object.entries(report.stats.keyCount)
        .map(([l, n]) => `${l}:${n}`)
        .join(' ')} ` +
      `codeRefs=${report.stats.codeRefCount}`,
  );
  lines.push('');
  if (report.failures.length === 0) {
    lines.push('FAIL: 0');
  } else {
    lines.push(`FAIL: ${report.failures.length}`);
    const grouped = new Map<string, Issue[]>();
    for (const f of report.failures) {
      const k = `${f.category}/${f.locale}`;
      const arr = grouped.get(k) ?? [];
      arr.push(f);
      grouped.set(k, arr);
    }
    for (const [k, arr] of [...grouped].sort()) {
      lines.push(`  [${k}] ${arr.length}`);
      for (const f of arr.slice(0, 10)) {
        lines.push(`    - ${f.key}${f.detail ? ` (${f.detail})` : ''}`);
      }
      if (arr.length > 10) lines.push(`    … ${arr.length - 10} more`);
    }
  }
  lines.push('');
  lines.push(`WARN: ${report.warnings.length}`);
  const warnGroup = new Map<string, Warning[]>();
  for (const w of report.warnings) {
    const arr = warnGroup.get(w.category) ?? [];
    arr.push(w);
    warnGroup.set(w.category, arr);
  }
  for (const [k, arr] of [...warnGroup].sort()) {
    lines.push(`  [${k}] ${arr.length}`);
    for (const w of arr.slice(0, 10)) lines.push(`    - ${w.key}`);
    if (arr.length > 10) lines.push(`    … ${arr.length - 10} more`);
  }
  lines.push('');
  lines.push(report.ok ? 'OK' : 'FAILED');
  return lines.join('\n');
}

function main(): void {
  const report = audit();
  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(fmt(report) + '\n');
  }
  // sep is unused but importing it keeps platform-aware imports if extended.
  void sep;
  process.exit(report.ok ? 0 : 1);
}

main();
