import { useMemo, useState, type ReactNode } from 'react';
import { ScenarioRunPage } from '../ScenarioRunPage';
import type { StepDef } from '../ChromeShell';
import type { StepProps } from '../kyc/steps/stepTypes';
import { DEPOSIT_STEP_HINTS } from '../scenarioStepHints';

const STEPS: StepDef[] = [
  { id: 'select_account', titleKey: 'sim.deposit.select_account.title' },
  { id: 'count_cash', titleKey: 'sim.deposit.count_cash.title' },
  { id: 'verify_receipt', titleKey: 'sim.deposit.verify_receipt.title' },
];

const DENOMS = [1_000, 5_000, 10_000, 50_000, 100_000, 200_000] as const;

interface DepositAccount {
  id: string;
  holder: string;
  iban: string;
}

interface DepositRunState {
  accounts?: DepositAccount[];
}

function readState(run: StepProps['run']): DepositRunState {
  return (run as unknown as { state?: DepositRunState }).state ?? {};
}

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <DepositStepFrame title={title} description={description}>
      {children}
    </DepositStepFrame>
  );
}

function DepositStepFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">{description}</p>
      {children}
    </div>
  );
}

function PrimaryButton({
  submitting,
  disabled,
  onClick,
  clickyTarget,
  label,
}: {
  submitting: boolean;
  disabled: boolean;
  onClick: () => void;
  clickyTarget: string;
  label: string;
}) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        disabled={submitting || disabled}
        onClick={onClick}
        data-clicky-target={clickyTarget}
        className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 disabled:opacity-60"
      >
        {submitting ? '…' : label}
      </button>
    </div>
  );
}

function SelectAccountStep({ run, submitting, onSubmit }: StepProps) {
  const accounts = readState(run).accounts ?? [];
  const [accountId, setAccountId] = useState('');

  return (
    <StepShell
      title="Select customer account"
      description="Pick the account receiving this cash deposit. All accounts are synthetic."
    >
      <ul className="mt-4 space-y-2">
        {accounts.map((acc) => (
          <li key={acc.id}>
            <label
              data-clicky-target={`${acc.id}, account, select`}
              data-clicky-hint={`Select account for ${acc.holder}.`}
              className={`flex cursor-pointer items-start gap-3 rounded-md p-3 ring-1 ${
                accountId === acc.id
                  ? 'bg-mentora-50 ring-mentora-600/30'
                  : 'bg-white ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <input
                type="radio"
                name="account"
                checked={accountId === acc.id}
                onChange={() => setAccountId(acc.id)}
                className="mt-1 h-4 w-4 text-mentora-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">{acc.holder}</span>
                <span className="font-mono-tech text-xs text-zinc-600">{acc.iban}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <PrimaryButton
        submitting={submitting}
        disabled={!accountId}
        onClick={() => onSubmit({ accountId })}
        clickyTarget="next, continue, account, select"
        label="Next"
      />
    </StepShell>
  );
}

function CountCashStep({ submitting, onSubmit }: StepProps) {
  const [declared, setDeclared] = useState('1000000');
  const [counts, setCounts] = useState<Record<string, number>>({ '100000': 10 });

  const declaredNum = Math.round(Number(declared.replace(/[^\d]/g, '')) || 0);

  return (
    <StepShell
      title="Count cash"
      description="Enter the declared total and denomination counts. They must match exactly."
    >
      <label className="mt-4 block max-w-xs">
        <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Declared total (UZS)
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={declared}
          onChange={(e) => setDeclared(e.target.value)}
          data-clicky-target="declared, amount, total, uzs"
          className="mt-2 w-full rounded-md px-3 py-2 font-mono-tech ring-1 ring-zinc-300 focus:ring-2 focus:ring-mentora-600/30"
        />
      </label>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {DENOMS.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <span className="w-24 font-mono-tech text-zinc-700">{d.toLocaleString()}</span>
            <input
              type="number"
              min={0}
              value={counts[String(d)] ?? 0}
              onChange={(e) =>
                setCounts((c) => ({ ...c, [String(d)]: Number(e.target.value) || 0 }))
              }
              data-clicky-target={`denom, ${d}, count`}
              className="w-20 rounded-md px-2 py-1 font-mono-tech ring-1 ring-zinc-300"
            />
          </label>
        ))}
      </div>
      <PrimaryButton
        submitting={submitting}
        disabled={declaredNum <= 0}
        onClick={() =>
          onSubmit({
            declaredAmountUzs: declaredNum,
            denominations: Object.fromEntries(
              Object.entries(counts).map(([k, v]) => [k, Number(v) || 0]),
            ),
          })
        }
        clickyTarget="submit, count, cash, next"
        label="Submit count"
      />
    </StepShell>
  );
}

function VerifyReceiptStep({ submitting, onSubmit }: StepProps) {
  const [receipt, setReceipt] = useState('DEP-12345678');

  return (
    <StepShell
      title="Verify receipt"
      description="Enter the deposit receipt number. Format: DEP-######## (eight digits)."
    >
      <label className="mt-4 block max-w-xs">
        <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Receipt number
        </span>
        <input
          type="text"
          value={receipt}
          onChange={(e) => setReceipt(e.target.value)}
          placeholder="DEP-12345678"
          data-clicky-target="receipt, dep, verify, number"
          className="mt-2 w-full rounded-md px-3 py-2 font-mono-tech ring-1 ring-zinc-300 focus:ring-2 focus:ring-mentora-600/30"
        />
      </label>
      <PrimaryButton
        submitting={submitting}
        disabled={receipt.length < 5}
        onClick={() => onSubmit({ receiptNumber: receipt })}
        clickyTarget="finish, confirm, receipt"
        label="Complete deposit"
      />
    </StepShell>
  );
}

const STEP_COMPONENTS = {
  select_account: SelectAccountStep,
  count_cash: CountCashStep,
  verify_receipt: VerifyReceiptStep,
};

export function DepositRunPage() {
  const steps = useMemo(() => STEPS, []);
  return (
    <ScenarioRunPage
      scenarioId="deposit"
      steps={steps}
      stepComponents={STEP_COMPONENTS}
      lastRunKey="vitality.lastDepositRunId"
      stepHints={DEPOSIT_STEP_HINTS}
    />
  );
}
