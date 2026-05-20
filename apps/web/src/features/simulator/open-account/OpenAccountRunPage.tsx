import { useState, type ComponentType } from 'react';
import { ScenarioRunPage } from '../ScenarioRunPage';
import { OPEN_ACCOUNT_STEP_HINTS } from '../scenarioStepHints';
import type { StepDef } from '../ChromeShell';
import type { StepProps } from '../kyc/steps/stepTypes';

// ──────────────────────────────────────────────────────────────────────────
// Open Account — three steps: choose product → fund account → confirm.
// Step UIs are inline in this file because they're tiny and tightly coupled.
// Direction A discipline: Inter body + JetBrains Mono for IDs/amounts,
// 4–8px corners, status pills emerald-50 / amber-50 / rose-50, primary
// actions on bg-mentora-600.
// ──────────────────────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  { id: 'choose_product', titleKey: 'sim.open_account.choose_product.title' },
  { id: 'fund_account', titleKey: 'sim.open_account.fund_account.title' },
  { id: 'confirm', titleKey: 'sim.open_account.confirm.title' },
];

function ChooseProductStep({ submitting, onSubmit }: StepProps) {
  const [accountType, setAccountType] = useState<'current' | 'savings'>('current');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Choose product</h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        Pick the account type and currency the customer is opening. Both are valid
        choices — the system will only flag clearly wrong combinations later.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FieldCard label="Account type">
          <Radio
            name="accountType"
            value="current"
            checked={accountType === 'current'}
            onChange={() => setAccountType('current')}
            label="Current account"
            hint="Daily use, low minimum"
            clickyTarget="current, account, daily, type"
          />
          <Radio
            name="accountType"
            value="savings"
            checked={accountType === 'savings'}
            onChange={() => setAccountType('savings')}
            label="Savings account"
            hint="Higher minimum, interest-bearing"
            clickyTarget="savings, account, interest, type"
          />
        </FieldCard>
        <FieldCard label="Currency">
          <Radio
            name="currency"
            value="UZS"
            checked={currency === 'UZS'}
            onChange={() => setCurrency('UZS')}
            label="UZS"
            hint="Local currency"
            clickyTarget="uzs, soum, local, currency"
          />
          <Radio
            name="currency"
            value="USD"
            checked={currency === 'USD'}
            onChange={() => setCurrency('USD')}
            label="USD"
            hint="Foreign currency"
            clickyTarget="usd, dollar, foreign, currency"
          />
        </FieldCard>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ accountType, currency })}
          data-clicky-target="next, continue, submit, choose, product, account, currency"
          data-clicky-hint="Confirms your product pick and moves to funding."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function FundAccountStep({ run, submitting, onSubmit }: StepProps) {
  // Read the previously chosen product to show the right currency cue.
  const state = (run as unknown as { state?: { currency?: string } }).state ?? {};
  const currency = state.currency ?? 'UZS';
  const [amount, setAmount] = useState('');

  const minor = Math.round(Number(amount.replace(/[^\d.]/g, '')) * 100);
  const valid = !isNaN(minor) && minor > 0;

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Fund account</h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        Enter the initial deposit in{' '}
        <span className="font-mono-tech font-semibold text-zinc-900">{currency}</span>. Below
        the minimum or above the regulatory ceiling counts as a mistake — the system will
        tell you which way you went wrong.
      </p>

      <div className="mt-5 max-w-md">
        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Initial deposit ({currency})
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={currency === 'UZS' ? 'e.g. 500000' : 'e.g. 1000'}
          data-clicky-target="amount, deposit, money, fund, input, field"
          data-clicky-hint="Type the initial deposit amount here."
          className="mt-2 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-base text-zinc-900 ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || !valid}
          onClick={() => onSubmit({ amountMinor: minor })}
          data-clicky-target="submit, next, continue, confirm, fund"
          data-clicky-hint="Submits the deposit amount for validation."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : 'Submit deposit'}
        </button>
      </div>
    </div>
  );
}

function ConfirmStep({ submitting, onSubmit }: StepProps) {
  const [agreed, setAgreed] = useState(false);
  const [kycRef, setKycRef] = useState('KYC-DEMO-001');
  const ready = agreed && kycRef.length >= 3;

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Confirm</h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        Final step: link this opening to a completed KYC and acknowledge the terms.
        Opening an account without ticking the T&C box is a hard mistake — it would
        be a compliance breach in production.
      </p>

      <div className="mt-5 max-w-md space-y-4">
        <label className="block">
          <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
            KYC reference
          </span>
          <input
            type="text"
            value={kycRef}
            onChange={(e) => setKycRef(e.target.value)}
            data-clicky-target="kyc, reference, ref"
            data-clicky-hint="Paste the KYC reference for the customer."
            className="mt-2 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-sm ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
          />
        </label>
        <label className="flex items-start gap-3 rounded-md bg-zinc-50 p-3 ring-1 ring-zinc-200">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            data-clicky-target="agree, terms, checkbox, confirm"
            data-clicky-hint="Tick this to confirm the customer agreed to the T&C."
            className="mt-0.5 h-4 w-4 rounded text-mentora-600 focus:ring-mentora-600/30"
          />
          <span className="text-sm text-zinc-700">
            The customer has signed the account opening terms and conditions.
          </span>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || !ready}
          onClick={() => onSubmit({ agreedToTerms: agreed, kycReference: kycRef })}
          data-clicky-target="open, account, finish, confirm, submit"
          data-clicky-hint="Opens the account and scores your run."
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : 'Open account'}
        </button>
      </div>
    </div>
  );
}

const STEP_COMPONENTS: Record<string, ComponentType<StepProps>> = {
  choose_product: ChooseProductStep,
  fund_account: FundAccountStep,
  confirm: ConfirmStep,
};

export function OpenAccountRunPage() {
  return (
    <ScenarioRunPage
      scenarioId="open-account"
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      lastRunKey="vitality.lastOpenAccountRunId"
      stepHints={OPEN_ACCOUNT_STEP_HINTS}
    />
  );
}

// ── Shared mini-controls ────────────────────────────────────────────────
function FieldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-white p-4 ring-1 ring-zinc-200">
      <p className="mb-3 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Radio({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
  clickyTarget,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
  clickyTarget?: string;
}) {
  return (
    <label
      data-clicky-target={clickyTarget}
      data-clicky-hint={`Pick "${label}" — ${hint.toLowerCase()}.`}
      className={`flex cursor-pointer items-start gap-3 rounded-md p-3 transition ${
        checked
          ? 'bg-mentora-50 ring-1 ring-inset ring-mentora-600/30'
          : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 text-mentora-600 focus:ring-mentora-600/30"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        <span className="block text-xs text-zinc-600">{hint}</span>
      </span>
    </label>
  );
}
