import type { SyntheticPerson } from './persons';
import { seedRng } from './seed';

/**
 * Document factories.
 *
 * These return *metadata only* — no real images, no real PDFs. The shape
 * is deliberately rich enough that the scenario engine can score whether
 * a learner's manual validation of the document (e.g. "is the passport
 * valid?") matches the truth, which is encoded in the `valid` field.
 *
 * Every document carries `synthetic: true`.
 */

export interface SyntheticPassportScan {
  synthetic: true;
  kind: 'passport_scan';
  personSeed: string;
  passportNumber: string;
  issuedAt: string; // ISO date
  expiresAt: string; // ISO date
  issuedBy: string;
  mrzLine1: string;
  mrzLine2: string;
  imageUrl: string; // synthetic placeholder url
  /**
   * Ground truth: would a careful KYC officer consider this passport valid?
   * Used by the engine to score the `verify_documents` step.
   */
  valid: boolean;
  invalidReason?: 'expired' | 'mrz_mismatch' | 'photo_tampered';
}

export interface SyntheticIncomeStatement {
  synthetic: true;
  kind: 'income_statement';
  personSeed: string;
  employerName: string;
  employerInn: string;
  periodStart: string;
  periodEnd: string;
  monthlyIncomeUzs: number;
  totalIncomeUzs: number;
  issuedAt: string;
  valid: boolean;
  invalidReason?: 'period_too_short' | 'employer_inn_invalid' | 'signature_missing';
}

function isoDateOffset(fromIso: string, days: number): string {
  const base = new Date(fromIso);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function mrzLine(name: string, country: 'UZ', passportNumber: string): string {
  // Not a real MRZ — just deterministic, plausibly-shaped filler text for
  // the UI to show. Real MRZ rules are out of scope for synthetic data.
  const filler = `${country}<${name.toUpperCase().replace(/[^A-Z]/g, '<').padEnd(30, '<')}`;
  return `${filler}${passportNumber}`.slice(0, 44).padEnd(44, '<');
}

export function generatePassportScan(person: SyntheticPerson): SyntheticPassportScan {
  // Document validity is derived deterministically from the person seed so
  // the same person always produces the same document — the engine relies
  // on this to score the verification step.
  const rng = seedRng(`${person.seed}:passport`);
  const issuedAt = `${2015 + Math.floor(rng() * 8)}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-15`;
  const expiresAt = isoDateOffset(issuedAt, 3650); // ~10 years

  // ~20% of passports are intentionally invalid so the learner has
  // something to catch during `verify_documents`.
  const validRoll = rng();
  const valid = validRoll >= 0.2;
  let invalidReason: SyntheticPassportScan['invalidReason'];
  if (!valid) {
    const r = rng();
    invalidReason = r < 0.34 ? 'expired' : r < 0.67 ? 'mrz_mismatch' : 'photo_tampered';
  }

  // If marked "expired" we backdate the expiry so the UI matches the truth.
  const effectiveExpiresAt = invalidReason === 'expired'
    ? isoDateOffset(new Date().toISOString().slice(0, 10), -30)
    : expiresAt;

  return {
    synthetic: true,
    kind: 'passport_scan',
    personSeed: person.seed,
    passportNumber: person.passportNumber,
    issuedAt,
    expiresAt: effectiveExpiresAt,
    issuedBy: 'IIV Tashkent (synthetic)',
    mrzLine1: mrzLine(`${person.lastName}<<${person.firstName}`, 'UZ', person.passportNumber),
    mrzLine2: mrzLine(person.inn, 'UZ', person.passportNumber),
    imageUrl: `synthetic://passports/${person.seed}.png`,
    valid,
    ...(invalidReason ? { invalidReason } : {}),
  };
}

export function generateIncomeStatement(person: SyntheticPerson): SyntheticIncomeStatement {
  const rng = seedRng(`${person.seed}:income`);
  const periodEnd = new Date();
  periodEnd.setUTCDate(1);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - 6);

  const validRoll = rng();
  const valid = validRoll >= 0.2;
  let invalidReason: SyntheticIncomeStatement['invalidReason'];
  if (!valid) {
    const r = rng();
    invalidReason = r < 0.34 ? 'period_too_short' : r < 0.67 ? 'employer_inn_invalid' : 'signature_missing';
  }

  const periodStartIso = invalidReason === 'period_too_short'
    ? isoDateOffset(periodEnd.toISOString().slice(0, 10), -30)
    : periodStart.toISOString().slice(0, 10);

  const employerInn = invalidReason === 'employer_inn_invalid'
    ? '0000000000000X' // obviously malformed
    : String(Math.floor(rng() * 9e13)).padStart(14, '0');

  return {
    synthetic: true,
    kind: 'income_statement',
    personSeed: person.seed,
    employerName: `LLC Synth-Employer-${Math.floor(rng() * 1000)}`,
    employerInn,
    periodStart: periodStartIso,
    periodEnd: periodEnd.toISOString().slice(0, 10),
    monthlyIncomeUzs: person.monthlyIncomeUzs,
    totalIncomeUzs: person.monthlyIncomeUzs * 6,
    issuedAt: periodEnd.toISOString().slice(0, 10),
    valid,
    ...(invalidReason ? { invalidReason } : {}),
  };
}
