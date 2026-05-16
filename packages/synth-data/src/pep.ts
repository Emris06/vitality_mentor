import type { SyntheticPerson } from './persons';

/**
 * Synthetic Politically Exposed Persons list.
 *
 * Entries describe a generic government role only (e.g. "deputy minister of
 * synthetic affairs"). No real individuals are referenced.
 *
 * Every entry carries `synthetic: true`.
 */

export interface SyntheticPepEntry {
  synthetic: true;
  fullName: string;
  role: string;
  jurisdiction: 'UZ' | 'KZ' | 'KG' | 'TJ' | 'TM';
}

const RAW: ReadonlyArray<Omit<SyntheticPepEntry, 'synthetic'>> = [
  { fullName: 'Akmal Davlatzoda', role: 'Deputy Minister of Synthetic Affairs', jurisdiction: 'UZ' },
  { fullName: 'Barno Hokimjonova', role: 'Regional Governor (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Choriq Qonunchi', role: 'Member of Parliament (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Davron Vazirzoda', role: 'Minister of Demo Policy', jurisdiction: 'UZ' },
  { fullName: 'Eldor Sudchi', role: 'Supreme Court Judge (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Feruza Vazirjon', role: 'Deputy Minister of Imaginary Trade', jurisdiction: 'UZ' },
  { fullName: 'Gulom Elchi', role: 'Ambassador (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Hilola Hokimbek', role: 'District Mayor (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Ilhom Prokurator', role: 'Regional Prosecutor (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Jamila Vazirzoda', role: 'Minister of Fictional Health', jurisdiction: 'UZ' },
  { fullName: 'Komil Davlatchi', role: 'Head of State Agency (synthetic)', jurisdiction: 'KZ' },
  { fullName: 'Lazizbek Qonunshunos', role: 'Senator (synthetic)', jurisdiction: 'KZ' },
  { fullName: 'Madina Elchijon', role: 'Consul-General (synthetic)', jurisdiction: 'KG' },
  { fullName: 'Nodir Davlatbek', role: 'Central Bank Deputy Chair (synthetic)', jurisdiction: 'TJ' },
  { fullName: 'Oybek Hokimjon', role: 'Regional Governor (synthetic)', jurisdiction: 'TM' },
  { fullName: 'Rayhona Vazirjon', role: 'Deputy Minister of Demo Education', jurisdiction: 'UZ' },
  { fullName: 'Sardor Sudyajon', role: 'Constitutional Court Judge (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Temur Prokuratorbek', role: 'Deputy Prosecutor-General (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Ulugbek Davlatjon', role: 'Head of Customs Agency (synthetic)', jurisdiction: 'UZ' },
  { fullName: 'Zafar Elchibek', role: 'Ambassador-at-Large (synthetic)', jurisdiction: 'UZ' },
];

const ENTRIES: ReadonlyArray<SyntheticPepEntry> = RAW.map(
  (e) => ({ synthetic: true as const, ...e }),
);

export function getSyntheticPepList(): ReadonlyArray<SyntheticPepEntry> {
  return ENTRIES;
}

function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PepCheckResult {
  isPep: boolean;
  role?: string;
  matchedName?: string;
  jurisdiction?: SyntheticPepEntry['jurisdiction'];
}

/**
 * Check whether a person matches a synthetic PEP entry. Same matching
 * heuristic as `isOnSanctionsList`: exact substring OR ≥2 shared name
 * tokens.
 */
export function isPep(person: Pick<SyntheticPerson, 'fullName'>): PepCheckResult {
  const needle = normalize(person.fullName);
  if (!needle) return { isPep: false };
  const needleTokens = new Set(needle.split(' '));

  for (const entry of ENTRIES) {
    const hay = normalize(entry.fullName);
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) {
      return { isPep: true, role: entry.role, matchedName: entry.fullName, jurisdiction: entry.jurisdiction };
    }
    const shared = hay.split(' ').filter((t) => needleTokens.has(t));
    if (shared.length >= 2) {
      return { isPep: true, role: entry.role, matchedName: entry.fullName, jurisdiction: entry.jurisdiction };
    }
  }
  return { isPep: false };
}
