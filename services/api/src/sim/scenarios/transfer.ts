import { z } from 'zod';
import { isOnSanctionsList } from '@vitality/synth-data';
import type { ScenarioMistake } from '@vitality/shared';
import type { ScenarioDef, StepDef } from '../engine';

// ──────────────────────────────────────────────────────────────────────────
// Transfer scenario — sending money to another account.
//
// Three steps, 100 points total:
//   1. select_source       (20) — pick the customer's source account
//   2. enter_recipient     (40) — recipient details + amount; runs deterministic
//                                 risk + sanctions screen on the synthetic name
//   3. screen_and_confirm  (40) — approve / block based on what the screen found
//
// The synthetic sanctions list is the same one KYC uses, so we get the same
// "Karimov / Mirziyoyev" defense-in-depth coverage for free.
// ──────────────────────────────────────────────────────────────────────────

export interface SyntheticAccount {
  id: string;
  holder: string;
  iban: string;
  currency: 'UZS';
  balanceUzs: number;
}

export interface TransferState {
  synthetic: true;
  accounts: SyntheticAccount[];
  sourceAccountId: string | null;
  recipientName: string | null;
  recipientIban: string | null;
  amountUzs: number | null;
  sanctionsHit: boolean;
  risk: 'low' | 'medium' | 'high';
  history: TransferStepOutcome[];
}

export interface TransferStepOutcome {
  stepId: string;
  ok: boolean;
  payload: unknown;
  mistakeCode?: string;
  awarded: number;
  at: string;
}

const SYNTHETIC_ACCOUNTS: SyntheticAccount[] = [
  { id: 'acc-001', holder: 'Yusupova Madina Akmalovna', iban: 'UZ12 0000 0000 0001 2345', currency: 'UZS', balanceUzs: 12_500_000 },
  { id: 'acc-002', holder: 'Toshmatov Aziz Murodovich', iban: 'UZ34 0000 0000 0006 7890', currency: 'UZS', balanceUzs: 3_200_000 },
  { id: 'acc-003', holder: 'Karimovna Dilshoda Ergashevna', iban: 'UZ56 0000 0000 0011 2233', currency: 'UZS', balanceUzs: 48_900_000 },
];

const IBAN_PATTERN = /^UZ\d{2}(\s?\d{4}){4}$/;

const selectSourceSchema = z.object({
  accountId: z.string().min(1).max(32),
});

const enterRecipientSchema = z.object({
  name: z.string().min(3).max(120),
  iban: z.string().min(8).max(40),
  amountUzs: z.number().int().positive(),
});

const confirmSchema = z.object({
  decision: z.enum(['approve', 'block']),
});

function record(
  state: TransferState,
  stepId: string,
  ok: boolean,
  payload: unknown,
  awarded: number,
  mistakeCode?: string,
): TransferState {
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

// Deterministic risk function used by step 2's screen. Large amount or
// sanctions hit → high. Round-tripping > 10M without sanctions hit → medium.
function classifyRisk(amountUzs: number, sanctionsHit: boolean): 'low' | 'medium' | 'high' {
  if (sanctionsHit) return 'high';
  if (amountUzs >= 50_000_000) return 'high';
  if (amountUzs >= 10_000_000) return 'medium';
  return 'low';
}

const stepSelectSource: StepDef<TransferState> = {
  id: 'select_source',
  titleKey: 'sim.transfer.select_source.title',
  score: 20,
  validate(state, payload) {
    const parsed = selectSourceSchema.safeParse(payload);
    if (!parsed.success) {
      const mistake: ScenarioMistake = {
        stepId: 'select_source',
        code: 'invalid_payload',
        messageKey: 'sim.transfer.select_source.invalid_payload',
        penalty: 5,
      };
      return { ok: false, mistake };
    }
    const found = state.accounts.find((a) => a.id === parsed.data.accountId);
    if (!found) {
      return {
        ok: true,
        next: record(state, 'select_source', false, parsed.data, 0, 'unknown_account'),
        mistake: {
          stepId: 'select_source',
          code: 'unknown_account',
          messageKey: 'sim.transfer.select_source.unknown_account',
          penalty: 15,
        },
      };
    }
    const next = record(
      { ...state, sourceAccountId: found.id },
      'select_source',
      true,
      parsed.data,
      20,
    );
    return { ok: true, next };
  },
};

const stepEnterRecipient: StepDef<TransferState> = {
  id: 'enter_recipient',
  titleKey: 'sim.transfer.enter_recipient.title',
  score: 40,
  validate(state, payload) {
    const parsed = enterRecipientSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'enter_recipient',
          code: 'invalid_payload',
          messageKey: 'sim.transfer.enter_recipient.invalid_payload',
          penalty: 5,
        },
      };
    }
    if (!IBAN_PATTERN.test(parsed.data.iban)) {
      return {
        ok: true,
        next: record(state, 'enter_recipient', false, parsed.data, 0, 'bad_iban'),
        mistake: {
          stepId: 'enter_recipient',
          code: 'bad_iban',
          messageKey: 'sim.transfer.enter_recipient.bad_iban',
          penalty: 20,
        },
      };
    }
    const source = state.accounts.find((a) => a.id === state.sourceAccountId);
    if (!source) {
      return {
        ok: false,
        mistake: {
          stepId: 'enter_recipient',
          code: 'no_source',
          messageKey: 'sim.transfer.enter_recipient.no_source',
          penalty: 10,
        },
      };
    }
    if (parsed.data.amountUzs > source.balanceUzs) {
      return {
        ok: true,
        next: record(state, 'enter_recipient', false, parsed.data, 0, 'insufficient_funds'),
        mistake: {
          stepId: 'enter_recipient',
          code: 'insufficient_funds',
          messageKey: 'sim.transfer.enter_recipient.insufficient_funds',
          penalty: 25,
        },
      };
    }

    // Run the screen NOW so step 3 can branch on it. The intern doesn't see
    // the verdict yet — that's their job in step 3.
    const sanctions = isOnSanctionsList(parsed.data.name);
    const risk = classifyRisk(parsed.data.amountUzs, sanctions.hit);

    const next = record(
      {
        ...state,
        recipientName: parsed.data.name,
        recipientIban: parsed.data.iban,
        amountUzs: parsed.data.amountUzs,
        sanctionsHit: sanctions.hit,
        risk,
      },
      'enter_recipient',
      true,
      parsed.data,
      40,
    );
    return { ok: true, next };
  },
};

const stepScreenAndConfirm: StepDef<TransferState> = {
  id: 'screen_and_confirm',
  titleKey: 'sim.transfer.screen_and_confirm.title',
  score: 40,
  final: true,
  validate(state, payload) {
    const parsed = confirmSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        mistake: {
          stepId: 'screen_and_confirm',
          code: 'invalid_payload',
          messageKey: 'sim.transfer.screen_and_confirm.invalid_payload',
          penalty: 5,
        },
      };
    }
    // Correct call: block on sanctions or high risk, approve otherwise.
    const shouldBlock = state.sanctionsHit || state.risk === 'high';
    const expected = shouldBlock ? 'block' : 'approve';
    if (parsed.data.decision === expected) {
      return { ok: true, next: record(state, 'screen_and_confirm', true, parsed.data, 40) };
    }
    const code = shouldBlock ? 'approved_risky' : 'blocked_clean';
    return {
      ok: true,
      next: record(state, 'screen_and_confirm', false, parsed.data, 0, code),
      mistake: {
        stepId: 'screen_and_confirm',
        code,
        messageKey: `sim.transfer.screen_and_confirm.${code}`,
        penalty: shouldBlock ? 35 : 20,
      },
    };
  },
};

export const TransferScenario: ScenarioDef<TransferState> = {
  id: 'transfer',
  initialState: () => ({
    synthetic: true,
    accounts: SYNTHETIC_ACCOUNTS,
    sourceAccountId: null,
    recipientName: null,
    recipientIban: null,
    amountUzs: null,
    sanctionsHit: false,
    risk: 'low',
    history: [],
  }),
  steps: [stepSelectSource, stepEnterRecipient, stepScreenAndConfirm],
};
