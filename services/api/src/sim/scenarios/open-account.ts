import { z } from 'zod';
import type { ScenarioMistake } from '@vitality/shared';
import type { ScenarioDef, StepDef } from '../engine';

// ──────────────────────────────────────────────────────────────────────────
// Open Account scenario — onboarding a new individual deposit account.
//
// Three steps, 100 points total:
//   1. choose_product   (20) — pick account type + currency
//   2. fund_account     (40) — enter a valid initial deposit
//   3. confirm    final (40) — KYC + T&C acknowledgement
//
// All synthetic. No real accounts, no real customer data.
// ──────────────────────────────────────────────────────────────────────────

export interface OpenAccountState {
  synthetic: true;
  accountType: 'current' | 'savings' | null;
  currency: 'UZS' | 'USD' | null;
  initialDepositMinor: number | null; // tiyin for UZS, cents for USD
  kycRef: string | null;
  history: OpenAccountStepOutcome[];
}

export interface OpenAccountStepOutcome {
  stepId: string;
  ok: boolean;
  payload: unknown;
  mistakeCode?: string;
  awarded: number;
  at: string;
}

const chooseProductSchema = z.object({
  accountType: z.enum(['current', 'savings']),
  currency: z.enum(['UZS', 'USD']),
});

const fundAccountSchema = z.object({
  amountMinor: z.number().int().nonnegative(),
});

const confirmSchema = z.object({
  agreedToTerms: z.boolean(),
  kycReference: z.string().min(3).max(64),
});

// Currency-aware deposit bands (in minor units — tiyin / cents).
// Current accounts have a low floor; savings have a higher one to be plausible.
function depositBand(
  accountType: 'current' | 'savings',
  currency: 'UZS' | 'USD',
): { min: number; max: number } {
  if (currency === 'UZS') {
    return accountType === 'savings'
      ? { min: 1_000_000_00, max: 100_000_000_00 } // 1M – 100M UZS
      : { min: 100_000_00, max: 100_000_000_00 };  // 100k – 100M UZS
  }
  return accountType === 'savings'
    ? { min: 100_00, max: 100_000_00 }   // $100 – $100,000
    : { min: 10_00, max: 100_000_00 };   // $10 – $100,000
}

function record(
  state: OpenAccountState,
  stepId: string,
  ok: boolean,
  payload: unknown,
  awarded: number,
  mistakeCode?: string,
): OpenAccountState {
  return {
    ...state,
    history: [
      ...state.history,
      {
        stepId,
        ok,
        payload,
        awarded,
        at: new Date().toISOString(),
        ...(mistakeCode ? { mistakeCode } : {}),
      },
    ],
  };
}

const stepChooseProduct: StepDef<OpenAccountState> = {
  id: 'choose_product',
  titleKey: 'sim.open_account.choose_product.title',
  score: 20,
  validate(state, payload) {
    const parsed = chooseProductSchema.safeParse(payload);
    if (!parsed.success) {
      const mistake: ScenarioMistake = {
        stepId: 'choose_product',
        code: 'invalid_payload',
        messageKey: 'sim.open_account.choose_product.invalid_payload',
        penalty: 5,
      };
      return { ok: false, mistake };
    }
    const next: OpenAccountState = record(
      { ...state, accountType: parsed.data.accountType, currency: parsed.data.currency },
      'choose_product',
      true,
      parsed.data,
      20,
    );
    return { ok: true, next };
  },
};

const stepFundAccount: StepDef<OpenAccountState> = {
  id: 'fund_account',
  titleKey: 'sim.open_account.fund_account.title',
  score: 40,
  validate(state, payload) {
    const parsed = fundAccountSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'fund_account',
          code: 'invalid_payload',
          messageKey: 'sim.open_account.fund_account.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!state.accountType || !state.currency) {
      return {
        ok: false,
        mistake: {
          stepId: 'fund_account',
          code: 'missing_product',
          messageKey: 'sim.open_account.fund_account.missing_product',
          penalty: 10,
        },
      };
    }
    const { min, max } = depositBand(state.accountType, state.currency);
    const amount = parsed.data.amountMinor;
    if (amount < min) {
      return {
        ok: true,
        next: record(state, 'fund_account', false, parsed.data, 0, 'below_minimum'),
        mistake: {
          stepId: 'fund_account',
          code: 'below_minimum',
          messageKey: 'sim.open_account.fund_account.below_minimum',
          penalty: 20,
        },
      };
    }
    if (amount > max) {
      return {
        ok: true,
        next: record(state, 'fund_account', false, parsed.data, 0, 'above_maximum'),
        mistake: {
          stepId: 'fund_account',
          code: 'above_maximum',
          messageKey: 'sim.open_account.fund_account.above_maximum',
          penalty: 20,
        },
      };
    }
    const next = record(
      { ...state, initialDepositMinor: amount },
      'fund_account',
      true,
      parsed.data,
      40,
    );
    return { ok: true, next };
  },
};

const stepConfirm: StepDef<OpenAccountState> = {
  id: 'confirm',
  titleKey: 'sim.open_account.confirm.title',
  score: 40,
  final: true,
  validate(state, payload) {
    const parsed = confirmSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'confirm',
          code: 'invalid_payload',
          messageKey: 'sim.open_account.confirm.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!parsed.data.agreedToTerms) {
      return {
        ok: true,
        next: record(state, 'confirm', false, parsed.data, 0, 'terms_not_accepted'),
        mistake: {
          stepId: 'confirm',
          code: 'terms_not_accepted',
          messageKey: 'sim.open_account.confirm.terms_not_accepted',
          penalty: 30,
        },
      };
    }
    const next = record(
      { ...state, kycRef: parsed.data.kycReference },
      'confirm',
      true,
      parsed.data,
      40,
    );
    return { ok: true, next };
  },
};

export const OpenAccountScenario: ScenarioDef<OpenAccountState> = {
  id: 'open-account',
  initialState: () => ({
    synthetic: true,
    accountType: null,
    currency: null,
    initialDepositMinor: null,
    kycRef: null,
    history: [],
  }),
  steps: [stepChooseProduct, stepFundAccount, stepConfirm],
};
