import { z } from 'zod';
import {
  generatePerson,
  generatePassportScan,
  generateIncomeStatement,
  isOnSanctionsList,
  isPep,
  type SyntheticPerson,
  type SyntheticPassportScan,
  type SyntheticIncomeStatement,
  type SanctionsCheckResult,
  type PepCheckResult,
} from '@vitality/synth-data';
import type { ScenarioMistake } from '@vitality/shared';
import type { ScenarioDef, StepDef } from '../engine';

/**
 * KYC scenario: onboarding a new individual customer.
 *
 * Five steps, all scored:
 *   1. intake             (10) — pick / generate a synthetic applicant.
 *   2. verify_documents   (20) — confirm passport + income statement validity.
 *   3. sanctions_check    (20) — pass clean applicants, block sanctioned ones.
 *   4. risk_score         (20) — pick the right risk tier per the rubric.
 *   5. decision     final (30) — final approve / reject / manual_review.
 *
 * Total possible = 100. Mistakes subtract penalty points; final score is
 * clamped 0-100 by the engine.
 */

export interface KycState {
  synthetic: true; // engine asserts on this
  person: SyntheticPerson | null;
  passport: SyntheticPassportScan | null;
  incomeStatement: SyntheticIncomeStatement | null;
  sanctions: SanctionsCheckResult | null;
  pep: PepCheckResult | null;
  /** Per-step outcome history — useful for AI hints & the UI summary. */
  history: KycStepOutcome[];
}

export interface KycStepOutcome {
  stepId: string;
  ok: boolean;
  payload: unknown;
  mistakeCode?: string;
  awarded: number;
  at: string;
}

const intakeSchema = z.object({
  personId: z.string().min(1).max(128),
});

const verifyDocsSchema = z.object({
  passportValid: z.boolean(),
  incomeStatementValid: z.boolean(),
});

const sanctionsSchema = z.object({
  decision: z.enum(['pass', 'block']),
});

const riskScoreSchema = z.object({
  score: z.enum(['low', 'medium', 'high']),
  rationale: z.string().min(1).max(2000),
});

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'manual_review']),
});

function recordOutcome(
  state: KycState,
  stepId: string,
  ok: boolean,
  payload: unknown,
  awarded: number,
  mistakeCode?: string,
): KycState {
  const outcome: KycStepOutcome = {
    stepId,
    ok,
    payload,
    awarded,
    at: new Date().toISOString(),
    ...(mistakeCode ? { mistakeCode } : {}),
  };
  return { ...state, history: [...state.history, outcome] };
}

/**
 * Decide expected risk tier from the synthetic ground truth.
 *   - PEP hit   → high
 *   - Sanctions → high
 *   - Otherwise medium-by-default (per the brief's rubric)
 */
function expectedRisk(state: KycState): 'low' | 'medium' | 'high' {
  if (state.pep?.isPep) return 'high';
  if (state.sanctions?.hit) return 'high';
  return 'medium';
}

const stepIntake: StepDef<KycState> = {
  id: 'intake',
  titleKey: 'sim.kyc.intake.title',
  score: 10,
  validate(state, payload) {
    const parsed = intakeSchema.safeParse(payload);
    if (!parsed.success) {
      const mistake: ScenarioMistake = {
        stepId: 'intake',
        code: 'invalid_payload',
        messageKey: 'sim.kyc.intake.invalid_payload',
        penalty: 5,
      };
      return { ok: false, mistake };
    }

    // The personId is used as a deterministic seed so the same applicant
    // can be re-generated across the run without storing PII in the DB
    // beyond what's already in `state`. (It's all synthetic anyway.)
    const person = generatePerson(parsed.data.personId);
    const passport = generatePassportScan(person);
    const incomeStatement = generateIncomeStatement(person);
    const sanctions = isOnSanctionsList(person.fullName);
    const pep = isPep(person);

    const next: KycState = recordOutcome(
      {
        ...state,
        person,
        passport,
        incomeStatement,
        sanctions,
        pep,
      },
      'intake',
      true,
      parsed.data,
      10,
    );
    return { ok: true, next };
  },
};

const stepVerifyDocs: StepDef<KycState> = {
  id: 'verify_documents',
  titleKey: 'sim.kyc.verify_documents.title',
  score: 20,
  validate(state, payload) {
    const parsed = verifyDocsSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'verify_documents',
          code: 'invalid_payload',
          messageKey: 'sim.kyc.verify_documents.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!state.passport || !state.incomeStatement) {
      return {
        ok: false,
        mistake: {
          stepId: 'verify_documents',
          code: 'missing_documents',
          messageKey: 'sim.kyc.verify_documents.missing_documents',
          penalty: 10,
        },
      };
    }

    const passportTruth = state.passport.valid;
    const incomeTruth = state.incomeStatement.valid;

    const passportMatch = parsed.data.passportValid === passportTruth;
    const incomeMatch = parsed.data.incomeStatementValid === incomeTruth;

    if (passportMatch && incomeMatch) {
      return { ok: true, next: recordOutcome(state, 'verify_documents', true, parsed.data, 20) };
    }

    const code = !passportMatch && !incomeMatch
      ? 'both_wrong'
      : !passportMatch
        ? 'passport_wrong'
        : 'income_wrong';
    return {
      ok: true,
      next: recordOutcome(state, 'verify_documents', false, parsed.data, 0, code),
      mistake: {
        stepId: 'verify_documents',
        code,
        messageKey: `sim.kyc.verify_documents.${code}`,
        penalty: !passportMatch && !incomeMatch ? 20 : 10,
      },
    };
  },
};

const stepSanctions: StepDef<KycState> = {
  id: 'sanctions_check',
  titleKey: 'sim.kyc.sanctions_check.title',
  score: 20,
  validate(state, payload) {
    const parsed = sanctionsSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'sanctions_check',
          code: 'invalid_payload',
          messageKey: 'sim.kyc.sanctions_check.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!state.sanctions) {
      return {
        ok: false,
        mistake: {
          stepId: 'sanctions_check',
          code: 'not_screened',
          messageKey: 'sim.kyc.sanctions_check.not_screened',
          penalty: 10,
        },
      };
    }

    const expected = state.sanctions.hit ? 'block' : 'pass';
    if (parsed.data.decision === expected) {
      return { ok: true, next: recordOutcome(state, 'sanctions_check', true, parsed.data, 20) };
    }
    const code = state.sanctions.hit ? 'passed_sanctioned' : 'blocked_clean';
    return {
      ok: true,
      next: recordOutcome(state, 'sanctions_check', false, parsed.data, 0, code),
      mistake: {
        stepId: 'sanctions_check',
        code,
        messageKey: `sim.kyc.sanctions_check.${code}`,
        penalty: 15,
      },
    };
  },
};

const stepRiskScore: StepDef<KycState> = {
  id: 'risk_score',
  titleKey: 'sim.kyc.risk_score.title',
  score: 20,
  validate(state, payload) {
    const parsed = riskScoreSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'risk_score',
          code: 'invalid_payload',
          messageKey: 'sim.kyc.risk_score.invalid_payload',
          penalty: 5,
        },
      };
    }
    const expected = expectedRisk(state);
    if (parsed.data.score === expected) {
      return { ok: true, next: recordOutcome(state, 'risk_score', true, parsed.data, 20) };
    }
    return {
      ok: true,
      next: recordOutcome(state, 'risk_score', false, parsed.data, 0, 'risk_mismatch'),
      mistake: {
        stepId: 'risk_score',
        code: 'risk_mismatch',
        messageKey: 'sim.kyc.risk_score.mismatch',
        penalty: 10,
      },
    };
  },
};

const stepDecision: StepDef<KycState> = {
  id: 'decision',
  titleKey: 'sim.kyc.decision.title',
  score: 30,
  final: true,
  validate(state, payload) {
    const parsed = decisionSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'decision',
          code: 'invalid_payload',
          messageKey: 'sim.kyc.decision.invalid_payload',
          penalty: 5,
        },
      };
    }
    const risk = expectedRisk(state);
    // Approving a high-risk applicant is the worst mistake here.
    if (risk === 'high' && parsed.data.decision === 'approve') {
      return {
        ok: true,
        next: recordOutcome(state, 'decision', false, parsed.data, 0, 'approved_high_risk'),
        mistake: {
          stepId: 'decision',
          code: 'approved_high_risk',
          messageKey: 'sim.kyc.decision.approved_high_risk',
          penalty: 30,
        },
      };
    }
    // High-risk → manual_review is best; reject is acceptable. Medium → any
    // non-approve choice is acceptable but approve is also fine. Low isn't
    // reachable in the current rubric.
    return { ok: true, next: recordOutcome(state, 'decision', true, parsed.data, 30) };
  },
};

export const KycScenario: ScenarioDef<KycState> = {
  id: 'kyc',
  initialState: () => ({
    synthetic: true,
    person: null,
    passport: null,
    incomeStatement: null,
    sanctions: null,
    pep: null,
    history: [],
  }),
  steps: [stepIntake, stepVerifyDocs, stepSanctions, stepRiskScore, stepDecision],
};
