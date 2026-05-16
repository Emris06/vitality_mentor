/**
 * Synthetic sanctions list.
 *
 * Entirely fabricated. Spread across three fake list authorities ("OFAC-like",
 * "EU-like", "UN-like") so the UI can show a plausible source label without
 * referencing real sanctions programs.
 *
 * Every entry carries `synthetic: true`.
 */

export type SanctionsListName = 'OFAC-like' | 'EU-like' | 'UN-like';

export interface SyntheticSanctionsEntry {
  synthetic: true;
  fullName: string;
  list: SanctionsListName;
  reason: string;
  addedOn: string; // ISO date
}

const RAW_ENTRIES: ReadonlyArray<Omit<SyntheticSanctionsEntry, 'synthetic'>> = [
  // --- OFAC-like (10) ---
  { fullName: 'Akmal Sanksiyonov', list: 'OFAC-like', reason: 'sdn_terror_financing', addedOn: '2019-03-04' },
  { fullName: 'Bekzod Qoraqalpoq', list: 'OFAC-like', reason: 'sdn_narcotics', addedOn: '2020-11-12' },
  { fullName: 'Davron Yashirin', list: 'OFAC-like', reason: 'sdn_cyber', addedOn: '2021-06-19' },
  { fullName: 'Eldor Tunqora', list: 'OFAC-like', reason: 'sdn_corruption', addedOn: '2018-09-22' },
  { fullName: 'Farrukh Soyaboy', list: 'OFAC-like', reason: 'sdn_arms', addedOn: '2022-01-30' },
  { fullName: 'Gulnora Tunchiroq', list: 'OFAC-like', reason: 'sdn_corruption', addedOn: '2017-12-11' },
  { fullName: 'Husan Soxtabek', list: 'OFAC-like', reason: 'sdn_money_laundering', addedOn: '2023-04-08' },
  { fullName: 'Iroda Yashirinjon', list: 'OFAC-like', reason: 'sdn_corruption', addedOn: '2024-02-14' },
  { fullName: 'Jasur Niqobov', list: 'OFAC-like', reason: 'sdn_terror_financing', addedOn: '2016-08-05' },
  { fullName: 'Kamola Qopqonova', list: 'OFAC-like', reason: 'sdn_human_trafficking', addedOn: '2021-10-27' },

  // --- EU-like (10) ---
  { fullName: 'Lazizbek Soxtazoda', list: 'EU-like', reason: 'eu_restrictive_measures', addedOn: '2022-03-15' },
  { fullName: 'Madina Qaroqchi', list: 'EU-like', reason: 'eu_human_rights', addedOn: '2020-07-09' },
  { fullName: 'Nodir Tunsoya', list: 'EU-like', reason: 'eu_corruption', addedOn: '2019-05-21' },
  { fullName: 'Oybek Soxtaev', list: 'EU-like', reason: 'eu_chemical_weapons', addedOn: '2018-11-02' },
  { fullName: 'Rustam Niqobjon', list: 'EU-like', reason: 'eu_restrictive_measures', addedOn: '2023-08-17' },
  { fullName: 'Sardor Yashirinov', list: 'EU-like', reason: 'eu_money_laundering', addedOn: '2021-02-28' },
  { fullName: 'Temur Qopqonbek', list: 'EU-like', reason: 'eu_cyber', addedOn: '2024-06-03' },
  { fullName: 'Ulugbek Tunqaroq', list: 'EU-like', reason: 'eu_human_rights', addedOn: '2017-04-13' },
  { fullName: 'Vohid Soxtaman', list: 'EU-like', reason: 'eu_restrictive_measures', addedOn: '2022-09-25' },
  { fullName: 'Zarina Niqobjonova', list: 'EU-like', reason: 'eu_human_rights', addedOn: '2020-12-31' },

  // --- UN-like (10) ---
  { fullName: 'Aziza Tunqorajon', list: 'UN-like', reason: 'un_al_qaida_isil', addedOn: '2016-05-18' },
  { fullName: 'Barno Soxtabonu', list: 'UN-like', reason: 'un_taliban', addedOn: '2019-08-07' },
  { fullName: 'Choriq Qopqonov', list: 'UN-like', reason: 'un_dprk', addedOn: '2021-04-22' },
  { fullName: 'Dilnoza Yashirinjon', list: 'UN-like', reason: 'un_libya', addedOn: '2018-02-09' },
  { fullName: 'Feruza Tunsoyajon', list: 'UN-like', reason: 'un_al_qaida_isil', addedOn: '2023-11-14' },
  { fullName: 'Hilola Niqobjonova', list: 'UN-like', reason: 'un_sudan', addedOn: '2020-06-11' },
  { fullName: 'Ilhom Soxtabek', list: 'UN-like', reason: 'un_somalia', addedOn: '2022-07-29' },
  { fullName: 'Jamila Qopqonjon', list: 'UN-like', reason: 'un_dprk', addedOn: '2017-10-04' },
  { fullName: 'Komil Niqobman', list: 'UN-like', reason: 'un_al_qaida_isil', addedOn: '2024-01-19' },
  { fullName: 'Lola Soxtaonim', list: 'UN-like', reason: 'un_yemen', addedOn: '2019-12-06' },
];

const ENTRIES: ReadonlyArray<SyntheticSanctionsEntry> = RAW_ENTRIES.map(
  (e) => ({ synthetic: true as const, ...e }),
);

export function getSyntheticSanctionsList(): ReadonlyArray<SyntheticSanctionsEntry> {
  return ENTRIES;
}

/** Normalise a name to a lowercase tokens-only form for matching. */
function normalize(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SanctionsCheckResult {
  hit: boolean;
  list?: SanctionsListName;
  reason?: string;
  matchedName?: string;
}

/**
 * Substring + token-level check against the synthetic sanctions list. Good
 * enough for the learning simulator — real OFAC/EU/UN matching uses fuzzy
 * algorithms, but the goal here is pedagogy, not production AML.
 */
export function isOnSanctionsList(name: string): SanctionsCheckResult {
  const needle = normalize(name);
  if (!needle) return { hit: false };
  const needleTokens = new Set(needle.split(' '));

  for (const entry of ENTRIES) {
    const hay = normalize(entry.fullName);
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) {
      return { hit: true, list: entry.list, reason: entry.reason, matchedName: entry.fullName };
    }
    const hayTokens = hay.split(' ');
    // Match if BOTH a first and a last token line up — single-token matches
    // are too noisy in the learning context.
    const shared = hayTokens.filter((t) => needleTokens.has(t));
    if (shared.length >= 2) {
      return { hit: true, list: entry.list, reason: entry.reason, matchedName: entry.fullName };
    }
  }
  return { hit: false };
}
