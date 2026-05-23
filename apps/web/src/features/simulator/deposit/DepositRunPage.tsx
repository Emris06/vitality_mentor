import { useMemo, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ScenarioRunPage } from '../ScenarioRunPage';
import type { StepDef } from '../ChromeShell';
import type { StepProps } from '../kyc/steps/stepTypes';

const DENOMINATIONS = [1_000, 5_000, 10_000, 50_000, 100_000, 200_000] as const;

const STEPS: StepDef[] = [
  { id: 'select_account', titleKey: 'sim.deposit.select_account.title' },
  { id: 'count_cash', titleKey: 'sim.deposit.count_cash.title' },
  { id: 'verify_receipt', titleKey: 'sim.deposit.verify_receipt.title' },
];

interface SyntheticAccount {
  id: string;
  holder: string;
  iban: string;
}

interface DepositRunState {
  accounts?: SyntheticAccount[];
  selectedAccountId?: string | null;
}

function readDepositState(run: StepProps['run']): DepositRunState {
  const raw = run.state;
  if (raw && typeof raw === 'object') return raw as DepositRunState;
  return {};
}

function SelectAccountStep({ run, submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const { accounts = [] } = readDepositState(run);
  const [accountId, setAccountId] = useState('');

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.deposit.steps.select_account.heading')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.deposit.steps.select_account.description')}
      </p>

      <ul className="mt-5 space-y-2">
        {accounts.map((acc) => (
          <li key={acc.id}>
            <label
              data-clicky-target={`account, ${acc.holder}, ${acc.id}, select`}
              data-clicky-hint={`Select account for ${acc.holder}.`}
              className={`flex cursor-pointer items-start gap-3 rounded-md p-4 transition ${
                accountId === acc.id
                  ? 'bg-mentora-50 ring-1 ring-inset ring-mentora-600/30'
                  : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <input
                type="radio"
                name="accountId"
                value={acc.id}
                checked={accountId === acc.id}
                onChange={() => setAccountId(acc.id)}
                className="mt-1 h-4 w-4 text-mentora-600 focus:ring-mentora-600/30"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">{acc.holder}</span>
                <span className="mt-0.5 block font-mono-tech text-xs text-zinc-600">{acc.iban}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || !accountId}
          onClick={() => onSubmit({ accountId })}
          data-clicky-target="next, continue, submit, account, select"
          data-clicky-hint="Confirms the customer account and moves to cash counting."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.deposit.steps.select_account.submit')}
        </button>
      </div>
    </div>
  );
}

function CountCashStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const [declared, setDeclared] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [String(d), '0'])),
  );

  const declaredUzs = Math.round(Number(declared.replace(/[^\d.]/g, '')));
  const countedUzs = useMemo(() => {
    let total = 0;
    for (const denom of DENOMINATIONS) {
      const n = parseInt(counts[String(denom)] ?? '0', 10);
      if (!isNaN(n) && n >= 0) total += denom * n;
    }
    return total;
  }, [counts]);

  const validDeclared = !isNaN(declaredUzs) && declaredUzs > 0;
  const countsMatch = validDeclared && countedUzs === declaredUzs;

  function setCount(denom: number, value: string) {
    setCounts((prev) => ({ ...prev, [String(denom)]: value }));
  }

  function handleSubmit() {
    const denominations: Record<string, number> = {};
    for (const denom of DENOMINATIONS) {
      const n = parseInt(counts[String(denom)] ?? '0', 10);
      if (n > 0) denominations[String(denom)] = n;
    }
    onSubmit({ declaredAmountUzs: declaredUzs, denominations });
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.deposit.steps.count_cash.heading')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.deposit.steps.count_cash.description')}
      </p>

      <div className="mt-5 max-w-md">
        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          {t('sim.deposit.steps.count_cash.declared_label')}
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={declared}
          onChange={(e) => setDeclared(e.target.value)}
          data-clicky-target="declared, amount, deposit, total"
          data-clicky-hint="Enter the total deposit amount the customer declared."
          className="mt-2 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-base text-zinc-900 ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
        />
      </div>

      <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200">
        <p className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          {t('sim.deposit.steps.count_cash.counted_label')}
        </p>
        <p
          className={
            'font-mono-tech text-lg font-bold ' +
            (validDeclared && !countsMatch ? 'text-rose-600' : 'text-zinc-900')
          }
        >
          {countedUzs.toLocaleString()} UZS
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {DENOMINATIONS.map((denom) => (
          <label key={denom} className="block">
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
              {t('sim.deposit.steps.count_cash.denomination_label', {
                value: denom.toLocaleString(),
              })}
            </span>
            <input
              type="number"
              min={0}
              value={counts[String(denom)]}
              onChange={(e) => setCount(denom, e.target.value)}
              data-clicky-target={`denomination, ${denom}, count, cash`}
              className="mt-1 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-sm ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
            />
          </label>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || !validDeclared}
          onClick={handleSubmit}
          data-clicky-target="confirm, count, submit, cash"
          data-clicky-hint="Submits your denomination breakdown for validation."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.deposit.steps.count_cash.submit')}
        </button>
      </div>
    </div>
  );
}

function VerifyReceiptStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const [receiptNumber, setReceiptNumber] = useState('DEP-');
  const canSubmit = receiptNumber.trim().length >= 4;

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.deposit.steps.verify_receipt.heading')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.deposit.steps.verify_receipt.description')}
      </p>

      <div className="mt-5 max-w-md">
        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          {t('sim.deposit.steps.verify_receipt.input_label')}
        </label>
        <input
          type="text"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value.toUpperCase())}
          placeholder={t('sim.deposit.steps.verify_receipt.placeholder')}
          data-clicky-target="receipt, number, verify, dep"
          data-clicky-hint="Enter the receipt number from the cash desk printer."
          className="mt-2 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-sm ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {t('sim.deposit.steps.verify_receipt.format_hint')}
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || !canSubmit}
          onClick={() => onSubmit({ receiptNumber })}
          data-clicky-target="verify, finish, submit, receipt"
          data-clicky-hint="Verifies the receipt and completes the deposit run."
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.deposit.steps.verify_receipt.submit')}
        </button>
      </div>
    </div>
  );
}

const STEP_COMPONENTS: Record<string, ComponentType<StepProps>> = {
  select_account: SelectAccountStep,
  count_cash: CountCashStep,
  verify_receipt: VerifyReceiptStep,
};

export function DepositRunPage() {
  return (
    <ScenarioRunPage
      scenarioId="deposit"
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      lastRunKey="vitality.lastDepositRunId"
    />
  );
}
