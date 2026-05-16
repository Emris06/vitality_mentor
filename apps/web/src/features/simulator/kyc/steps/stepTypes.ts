import type { ScenarioRun } from '@vitality/shared';

export interface StepProps {
  run: ScenarioRun;
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}

/**
 * Synthetic structures that we expect to find in `run.state` once intake
 * has been processed by the API. The backend produces these via the synth
 * customer generator; we type them loosely here because `state` is jsonb.
 */
export interface SyntheticPerson {
  fullName?: string;
  dob?: string;
  passport?: string;
  address?: string;
  phone?: string;
  inn?: string;
}

export interface SyntheticDocuments {
  passport?: {
    fullName?: string;
    dob?: string;
    passportNo?: string;
    valid?: boolean;
  };
  incomeStatement?: {
    employer?: string;
    monthlyIncome?: number;
    valid?: boolean;
  };
}

export interface SanctionsHit {
  hit: boolean;
  list?: string;
  reason?: string;
}

export interface PepHit {
  isPep: boolean;
  role?: string;
}

export interface KycRunState {
  person?: SyntheticPerson;
  documents?: SyntheticDocuments;
  sanctionsHit?: SanctionsHit;
  pepHit?: PepHit;
  // additional fields are tolerated
  [key: string]: unknown;
}

/**
 * Read `run.state` defensively — the backend may not have populated all
 * fields for every step. Always guard against `undefined`.
 */
export function readState(run: ScenarioRun): KycRunState {
  const raw = (run as ScenarioRun & { state?: unknown }).state;
  if (raw && typeof raw === 'object') {
    return raw as KycRunState;
  }
  return {};
}
