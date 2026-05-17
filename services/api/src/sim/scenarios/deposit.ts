import { z } from 'zod';
import type { ScenarioMistake } from '@vitality/shared';
import type { ScenarioDef, StepDef } from '../engine';

// ──────────────────────────────────────────────────────────────────────────
// Cash Deposit scenario — taking a cash deposit at the teller window.
//
// Three steps, 100 points total:
//   1. select_account   (20) — pick the customer's account from a list
//   2. count_cash       (40) — denomination breakdown must equal declared
//   3. verify_receipt   (40) — receipt number must match the expected format
//
// All accounts are synthetic. The denomination math is the real interesting
// part — trains the intern to reconcile counts against the declared total.
// ──────────────────────────────────────────────────────────────────────────

export interface SyntheticAccount {
  id: string;
  holder: string;
  iban: string;
  currency: 'UZS';
}

export interface DepositState {
  synthetic: true;
  accounts: SyntheticAccount[];
  selectedAccountId: string | null;
  declaredAmountUzs: number | null;
  countedAmountUzs: number | null;
  receiptNumber: string | null;
  history: DepositStepOutcome[];
}

export interface DepositStepOutcome {
  stepId: string;
  ok: boolean;
  payload: unknown;
  mistakeCode?: string;
  awarded: number;
  at: string;
}

// Hardcoded synthetic account roster. Deterministic so the demo plays the
// same way every time. None of these IBANs route anywhere real.
const SYNTHETIC_ACCOUNTS: SyntheticAccount[] = [
  { id: 'acc-001', holder: 'Yusupova Madina Akmalovna', iban: 'UZ12 0000 0000 0001 2345', currency: 'UZS' },
  { id: 'acc-002', holder: 'Toshmatov Aziz Murodovich', iban: 'UZ34 0000 0000 0006 7890', currency: 'UZS' },
  { id: 'acc-003', holder: 'Karimovna Dilshoda Ergashevna', iban: 'UZ56 0000 0000 0011 2233', currency: 'UZS' },
];

const VALID_DENOMINATIONS = [1_000, 5_000, 10_000, 50_000, 100_000, 200_000] as const;
type Denomination = (typeof VALID_DENOMINATIONS)[number];

const selectAccountSchema = z.object({
  accountId: z.string().min(1).max(32),
});

const countCashSchema = z.object({
  declaredAmountUzs: z.number().int().positive(),
  // Map of denomination → count, e.g. { "100000": 4, "50000": 2 }
  denominations: z.record(
    z.string().regex(/^\d+$/),
    z.number().int().nonnegative(),
  ),
});

const verifyReceiptSchema = z.object({
  receiptNumber: z.string().min(1).max(32),
});

const RECEIPT_PATTERN = /^DEP-\d{8}$/;

function record(
  state: DepositState,
  stepId: string,
  ok: boolean,
  payload: unknown,
  awarded: number,
  mistakeCode?: string,
): DepositState {
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

const stepSelectAccount: StepDef<DepositState> = {
  id: 'select_account',
  titleKey: 'sim.deposit.select_account.title',
  score: 20,
  validate(state, payload) {
    const parsed = selectAccountSchema.safeParse(payload);
    if (!parsed.success) {
      const mistake: ScenarioMistake = {
        stepId: 'select_account',
        code: 'invalid_payload',
        messageKey: 'sim.deposit.select_account.invalid_payload',
        penalty: 5,
      };
      return { ok: false, mistake };
    }
    const found = state.accounts.find((a) => a.id === parsed.data.accountId);
    if (!found) {
      return {
        ok: true,
        next: record(state, 'select_account', false, parsed.data, 0, 'unknown_account'),
        mistake: {
          stepId: 'select_account',
          code: 'unknown_account',
          messageKey: 'sim.deposit.select_account.unknown_account',
          penalty: 15,
        },
      };
    }
    const next = record(
      { ...state, selectedAccountId: found.id },
      'select_account',
      true,
      parsed.data,
      20,
    );
    return { ok: true, next };
  },
};

const stepCountCash: StepDef<DepositState> = {
  id: 'count_cash',
  titleKey: 'sim.deposit.count_cash.title',
  score: 40,
  validate(state, payload) {
    const parsed = countCashSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'count_cash',
          code: 'invalid_payload',
          messageKey: 'sim.deposit.count_cash.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!state.selectedAccountId) {
      return {
        ok: false,
        mistake: {
          stepId: 'count_cash',
          code: 'no_account',
          messageKey: 'sim.deposit.count_cash.no_account',
          penalty: 10,
        },
      };
    }

    let counted = 0;
    for (const [denomStr, count] of Object.entries(parsed.data.denominations)) {
      const denom = Number(denomStr) as Denomination;
      if (!VALID_DENOMINATIONS.includes(denom)) {
        return {
          ok: true,
          next: record(state, 'count_cash', false, parsed.data, 0, 'invalid_denomination'),
          mistake: {
            stepId: 'count_cash',
            code: 'invalid_denomination',
            messageKey: 'sim.deposit.count_cash.invalid_denomination',
            penalty: 20,
          },
        };
      }
      counted += denom * count;
    }

    if (counted !== parsed.data.declaredAmountUzs) {
      return {
        ok: true,
        next: record(
          { ...state, declaredAmountUzs: parsed.data.declaredAmountUzs, countedAmountUzs: counted },
          'count_cash',
          false,
          parsed.data,
          0,
          'amount_mismatch',
        ),
        mistake: {
          stepId: 'count_cash',
          code: 'amount_mismatch',
          messageKey: 'sim.deposit.count_cash.amount_mismatch',
          penalty: 30,
        },
      };
    }

    const next = record(
      {
        ...state,
        declaredAmountUzs: parsed.data.declaredAmountUzs,
        countedAmountUzs: counted,
      },
      'count_cash',
      true,
      parsed.data,
      40,
    );
    return { ok: true, next };
  },
};

const stepVerifyReceipt: StepDef<DepositState> = {
  id: 'verify_receipt',
  titleKey: 'sim.deposit.verify_receipt.title',
  score: 40,
  final: true,
  validate(state, payload) {
    const parsed = verifyReceiptSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'verify_receipt',
          code: 'invalid_payload',
          messageKey: 'sim.deposit.verify_receipt.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!RECEIPT_PATTERN.test(parsed.data.receiptNumber)) {
      return {
        ok: true,
        next: record(state, 'verify_receipt', false, parsed.data, 0, 'bad_format'),
        mistake: {
          stepId: 'verify_receipt',
          code: 'bad_format',
          messageKey: 'sim.deposit.verify_receipt.bad_format',
          penalty: 20,
        },
      };
    }
    const next = record(
      { ...state, receiptNumber: parsed.data.receiptNumber },
      'verify_receipt',
      true,
      parsed.data,
      40,
    );
    return { ok: true, next };
  },
};

export const DepositScenario: ScenarioDef<DepositState> = {
  id: 'deposit',
  initialState: () => ({
    synthetic: true,
    accounts: SYNTHETIC_ACCOUNTS,
    selectedAccountId: null,
    declaredAmountUzs: null,
    countedAmountUzs: null,
    receiptNumber: null,
    history: [],
  }),
  steps: [stepSelectAccount, stepCountCash, stepVerifyReceipt],
};
