import { useMemo, useState, type ReactNode } from 'react';
import { ScenarioRunPage } from '../ScenarioRunPage';
import type { StepDef } from '../ChromeShell';
import type { StepProps } from '../kyc/steps/stepTypes';
import { TRANSFER_STEP_HINTS } from '../scenarioStepHints';

const STEPS: StepDef[] = [
  { id: 'select_source', titleKey: 'sim.transfer.select_source.title' },
  { id: 'enter_recipient', titleKey: 'sim.transfer.enter_recipient.title' },
  { id: 'screen_and_confirm', titleKey: 'sim.transfer.screen_and_confirm.title' },
];

interface TransferAccount {
  id: string;
  holder: string;
  iban: string;
  balanceUzs: number;
}

interface TransferRunState {
  accounts?: TransferAccount[];
  sanctionsHit?: boolean;
  risk?: 'low' | 'medium' | 'high';
  recipientName?: string | null;
  amountUzs?: number | null;
}

function readState(run: StepProps['run']): TransferRunState {
  return (run as unknown as { state?: TransferRunState }).state ?? {};
}

function StepFrame({
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

function SelectSourceStep({ run, submitting, onSubmit }: StepProps) {
  const accounts = readState(run).accounts ?? [];
  const [accountId, setAccountId] = useState('');

  return (
    <StepFrame
      title="Select source account"
      description="Choose the customer's account to debit for this transfer."
    >
      <ul className="mt-4 space-y-2">
        {accounts.map((acc) => (
          <li key={acc.id}>
            <label
              data-clicky-target={`${acc.id}, source, account, select`}
              className={`flex cursor-pointer items-start gap-3 rounded-md p-3 ring-1 ${
                accountId === acc.id
                  ? 'bg-mentora-50 ring-mentora-600/30'
                  : 'bg-white ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <input
                type="radio"
                name="source"
                checked={accountId === acc.id}
                onChange={() => setAccountId(acc.id)}
                className="mt-1 h-4 w-4 text-mentora-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">{acc.holder}</span>
                <span className="font-mono-tech text-xs text-zinc-600">
                  {acc.iban} · {acc.balanceUzs.toLocaleString()} UZS
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <PrimaryButton
        submitting={submitting}
        disabled={!accountId}
        onClick={() => onSubmit({ accountId })}
        clickyTarget="next, source, account"
        label="Next"
      />
    </StepFrame>
  );
}

function EnterRecipientStep({ submitting, onSubmit }: StepProps) {
  const [name, setName] = useState('Rustam Karimov');
  const [iban, setIban] = useState('UZ12 0000 0000 0099 8877');
  const [amount, setAmount] = useState('500000');

  const amountUzs = Math.round(Number(amount.replace(/[^\d]/g, '')) || 0);

  return (
    <StepFrame
      title="Enter recipient"
      description="Capture beneficiary details. The system screens the name against sanctions lists."
    >
      <TransferFields
        name={name}
        setName={setName}
        iban={iban}
        setIban={setIban}
        amount={amount}
        setAmount={setAmount}
      />
      <PrimaryButton
        submitting={submitting}
        disabled={name.length < 3 || iban.length < 8 || amountUzs <= 0}
        onClick={() => onSubmit({ name, iban, amountUzs })}
        clickyTarget="submit, recipient, transfer, next"
        label="Run screening"
      />
    </StepFrame>
  );
}

function TransferFields({
  name,
  setName,
  iban,
  setIban,
  amount,
  setAmount,
}: {
  name: string;
  setName: (v: string) => void;
  iban: string;
  setIban: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
}) {
  return (
    <div className="mt-4 max-w-md space-y-4">
      <label className="block">
        <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Recipient name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-clicky-target="name, recipient, beneficiary"
          className="mt-2 w-full rounded-md px-3 py-2 text-sm ring-1 ring-zinc-300 focus:ring-2 focus:ring-mentora-600/30"
        />
      </label>
      <label className="block">
        <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Recipient IBAN
        </span>
        <input
          type="text"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          data-clicky-target="iban, account, recipient"
          className="mt-2 w-full rounded-md px-3 py-2 font-mono-tech text-sm ring-1 ring-zinc-300 focus:ring-2 focus:ring-mentora-600/30"
        />
      </label>
      <label className="block">
        <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Amount (UZS)
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-clicky-target="amount, money, transfer, uzs"
          className="mt-2 w-full rounded-md px-3 py-2 font-mono-tech ring-1 ring-zinc-300 focus:ring-2 focus:ring-mentora-600/30"
        />
      </label>
    </div>
  );
}

function ScreenAndConfirmStep({ run, submitting, onSubmit }: StepProps) {
  const state = readState(run);
  const risk = state.risk ?? 'low';
  const sanctions = state.sanctionsHit ?? false;

  return (
    <StepFrame
      title="Screen and confirm"
      description="Review the automated risk result and approve or block the transfer."
    >
      <div
        className="mt-4 rounded-md bg-zinc-50 p-4 ring-1 ring-zinc-200"
        data-clicky-target="screen, risk, sanctions, result"
      >
        <p className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          Screening result
        </p>
        <p className="mt-2 text-sm text-zinc-800">
          Risk: <strong>{risk}</strong>
          {sanctions && (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
              Sanctions hit
            </span>
          )}
        </p>
        {state.recipientName && (
          <p className="mt-1 text-sm text-zinc-600">
            {state.recipientName} · {(state.amountUzs ?? 0).toLocaleString()} UZS
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ decision: 'block' })}
          data-clicky-target="block, reject, deny, stop"
          className="rounded-md bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          Block
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ decision: 'approve' })}
          data-clicky-target="approve, confirm, send, transfer"
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Approve
        </button>
      </div>
    </StepFrame>
  );
}

const STEP_COMPONENTS = {
  select_source: SelectSourceStep,
  enter_recipient: EnterRecipientStep,
  screen_and_confirm: ScreenAndConfirmStep,
};

export function TransferRunPage() {
  const steps = useMemo(() => STEPS, []);
  return (
    <ScenarioRunPage
      scenarioId="transfer"
      steps={steps}
      stepComponents={STEP_COMPONENTS}
      lastRunKey="vitality.lastTransferRunId"
      stepHints={TRANSFER_STEP_HINTS}
    />
  );
}
