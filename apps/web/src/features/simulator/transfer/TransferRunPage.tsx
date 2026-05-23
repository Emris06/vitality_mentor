import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ScenarioRunPage } from '../ScenarioRunPage';
import type { StepDef } from '../ChromeShell';
import type { StepProps } from '../kyc/steps/stepTypes';

const STEPS: StepDef[] = [
  { id: 'select_source', titleKey: 'sim.transfer.select_source.title' },
  { id: 'enter_recipient', titleKey: 'sim.transfer.enter_recipient.title' },
  { id: 'screen_and_confirm', titleKey: 'sim.transfer.screen_and_confirm.title' },
];

interface SyntheticAccount {
  id: string;
  holder: string;
  iban: string;
  balanceUzs: number;
}

interface TransferRunState {
  accounts?: SyntheticAccount[];
  sourceAccountId?: string | null;
  recipientName?: string | null;
  recipientIban?: string | null;
  amountUzs?: number | null;
  sanctionsHit?: boolean;
  risk?: 'low' | 'medium' | 'high';
}

function readTransferState(run: StepProps['run']): TransferRunState {
  const raw = run.state;
  if (raw && typeof raw === 'object') return raw as TransferRunState;
  return {};
}

function formatUzs(n: number): string {
  return n.toLocaleString() + ' UZS';
}

function SelectSourceStep({ run, submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const { accounts = [] } = readTransferState(run);
  const [accountId, setAccountId] = useState('');

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.transfer.steps.select_source.heading')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.transfer.steps.select_source.description')}
      </p>

      <ul className="mt-5 space-y-2">
        {accounts.map((acc) => (
          <li key={acc.id}>
            <label
              data-clicky-target={`source, account, ${acc.holder}, ${acc.id}`}
              data-clicky-hint={`Select ${acc.holder} as the source account.`}
              className={`flex cursor-pointer items-start gap-3 rounded-md p-4 transition ${
                accountId === acc.id
                  ? 'bg-mentora-50 ring-1 ring-inset ring-mentora-600/30'
                  : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <input
                type="radio"
                name="sourceAccountId"
                value={acc.id}
                checked={accountId === acc.id}
                onChange={() => setAccountId(acc.id)}
                className="mt-1 h-4 w-4 text-mentora-600 focus:ring-mentora-600/30"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">{acc.holder}</span>
                <span className="mt-0.5 block font-mono-tech text-xs text-zinc-600">{acc.iban}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {t('sim.transfer.steps.select_source.balance_label')}:{' '}
                  <span className="font-mono-tech font-semibold text-zinc-800">
                    {formatUzs(acc.balanceUzs)}
                  </span>
                </span>
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
          data-clicky-target="next, continue, source, account"
          data-clicky-hint="Confirms the source account and moves to recipient entry."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.transfer.steps.select_source.submit')}
        </button>
      </div>
    </div>
  );
}

function EnterRecipientStep({ run, submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const state = readTransferState(run);
  const source = state.accounts?.find((a) => a.id === state.sourceAccountId);
  const maxBalance = source?.balanceUzs ?? Infinity;

  const [name, setName] = useState('');
  const [iban, setIban] = useState('UZ');
  const [amount, setAmount] = useState('');

  const amountUzs = Math.round(Number(amount.replace(/[^\d.]/g, '')));
  const valid =
    name.trim().length >= 3 &&
    iban.trim().length >= 8 &&
    !isNaN(amountUzs) &&
    amountUzs > 0 &&
    amountUzs <= maxBalance;

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.transfer.steps.enter_recipient.heading')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.transfer.steps.enter_recipient.description')}
      </p>

      <div className="mt-5 max-w-md space-y-4">
        <label className="block">
          <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
            {t('sim.transfer.steps.enter_recipient.name_label')}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-clicky-target="recipient, name, beneficiary"
            className="mt-2 w-full rounded-md bg-white px-3 py-2 text-sm ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
          />
        </label>
        <label className="block">
          <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
            {t('sim.transfer.steps.enter_recipient.iban_label')}
          </span>
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            data-clicky-target="iban, account, recipient"
            className="mt-2 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-sm ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
          />
          <p className="mt-1 text-xs text-zinc-500">
            {t('sim.transfer.steps.enter_recipient.iban_hint')}
          </p>
        </label>
        <label className="block">
          <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
            {t('sim.transfer.steps.enter_recipient.amount_label')}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-clicky-target="amount, transfer, money, uzs"
            className="mt-2 w-full rounded-md bg-white px-3 py-2 font-mono-tech text-base ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
          />
          {source && (
            <p className="mt-1 text-xs text-zinc-500">
              {t('sim.transfer.steps.select_source.balance_label')}: {formatUzs(source.balanceUzs)}
            </p>
          )}
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || !valid}
          onClick={() => onSubmit({ name: name.trim(), iban: iban.trim(), amountUzs })}
          data-clicky-target="screen, run, submit, recipient"
          data-clicky-hint="Runs the sanctions and risk screen on the recipient."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.transfer.steps.enter_recipient.submit')}
        </button>
      </div>
    </div>
  );
}

function ScreenAndConfirmStep({ run, submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const state = readTransferState(run);
  const risk = state.risk ?? 'low';
  const sanctions = state.sanctionsHit ?? false;
  const [decision, setDecision] = useState<'approve' | 'block' | null>(null);

  const riskClass =
    risk === 'high' ? 'text-rose-600' : risk === 'medium' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.transfer.steps.screen_and_confirm.heading')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.transfer.steps.screen_and_confirm.description')}
      </p>

      <dl className="mt-5 grid gap-3 rounded-md bg-zinc-50 p-4 ring-1 ring-zinc-200 sm:grid-cols-2">
        <div>
          <dt className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
            {t('sim.transfer.steps.screen_and_confirm.risk_label')}
          </dt>
          <dd className={'mt-1 font-mono-tech text-sm font-bold uppercase ' + riskClass}>
            {risk}
          </dd>
        </div>
        <div>
          <dt className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
            {t('sim.transfer.steps.screen_and_confirm.sanctions_label')}
          </dt>
          <dd
            className={
              'mt-1 text-sm font-semibold ' + (sanctions ? 'text-rose-600' : 'text-emerald-600')
            }
          >
            {sanctions
              ? t('sim.transfer.steps.screen_and_confirm.sanctions_yes')
              : t('sim.transfer.steps.screen_and_confirm.sanctions_no')}
          </dd>
        </div>
        {state.recipientName && (
          <div className="sm:col-span-2">
            <dt className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
              {t('sim.transfer.steps.enter_recipient.name_label')}
            </dt>
            <dd className="mt-1 text-sm text-zinc-900">{state.recipientName}</dd>
          </div>
        )}
        {state.amountUzs != null && (
          <div className="sm:col-span-2">
            <dt className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
              {t('sim.transfer.steps.enter_recipient.amount_label')}
            </dt>
            <dd className="mt-1 font-mono-tech text-sm font-semibold text-zinc-900">
              {formatUzs(state.amountUzs)}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-5 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
        {t('sim.transfer.steps.screen_and_confirm.decision_label')}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setDecision('approve')}
          data-clicky-target="approve, transfer, allow"
          data-clicky-hint="Approve this transfer after reviewing the screen."
          className={
            'rounded-md px-5 py-2 text-sm font-semibold ring-1 transition ' +
            (decision === 'approve'
              ? 'bg-emerald-600 text-white ring-emerald-600'
              : 'bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50')
          }
        >
          {t('sim.transfer.steps.screen_and_confirm.approve')}
        </button>
        <button
          type="button"
          onClick={() => setDecision('block')}
          data-clicky-target="block, transfer, reject, stop"
          data-clicky-hint="Block this transfer — use when sanctions or high risk apply."
          className={
            'rounded-md px-5 py-2 text-sm font-semibold ring-1 transition ' +
            (decision === 'block'
              ? 'bg-rose-600 text-white ring-rose-600'
              : 'bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50')
          }
        >
          {t('sim.transfer.steps.screen_and_confirm.block')}
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={submitting || decision === null}
          onClick={() => onSubmit({ decision })}
          data-clicky-target="submit, decision, confirm"
          data-clicky-hint="Submits your approve or block decision and scores the run."
          className="rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.transfer.steps.screen_and_confirm.submit')}
        </button>
      </div>
    </div>
  );
}

const STEP_COMPONENTS: Record<string, ComponentType<StepProps>> = {
  select_source: SelectSourceStep,
  enter_recipient: EnterRecipientStep,
  screen_and_confirm: ScreenAndConfirmStep,
};

export function TransferRunPage() {
  return (
    <ScenarioRunPage
      scenarioId="transfer"
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      lastRunKey="vitality.lastTransferRunId"
    />
  );
}
