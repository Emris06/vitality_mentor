import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StepProps } from './stepTypes';

type Decision = 'approve' | 'reject' | 'manual_review';

interface Option {
  value: Decision;
  labelKey: string;
  descKey: string;
  activeTone: string;
  clickyTarget: string;
}

const OPTIONS: Option[] = [
  {
    value: 'approve',
    labelKey: 'sim.kyc.steps.decision.approve',
    descKey: 'sim.kyc.steps.decision.approve_desc',
    activeTone: 'bg-[var(--good-tint)] text-[var(--good)] ring-[var(--good)]',
    clickyTarget: 'approve, accept, ok, green, decision',
  },
  {
    value: 'manual_review',
    labelKey: 'sim.kyc.steps.decision.manual_review',
    descKey: 'sim.kyc.steps.decision.manual_review_desc',
    activeTone: 'bg-[var(--warn-tint)] text-[var(--warn-ref)] ring-[var(--warn-ref)]',
    clickyTarget: 'manual, review, escalate, amber, decision',
  },
  {
    value: 'reject',
    labelKey: 'sim.kyc.steps.decision.reject',
    descKey: 'sim.kyc.steps.decision.reject_desc',
    activeTone: 'bg-[var(--bad-tint)] text-[var(--bad)] ring-[var(--bad)]',
    clickyTarget: 'reject, deny, red, decision',
  },
];

export function DecisionStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const [decision, setDecision] = useState<Decision | null>(null);

  const canSubmit = decision !== null && !submitting;

  return (
    <div
      className="p-6"
      data-clicky-target="decision, approve, reject, manual, final"
      data-clicky-hint={t('clicky.hint.kyc.decision')}
    >
      <h2 className="text-base font-semibold tracking-tight text-[var(--ink)]">
        {t('sim.kyc.steps.decision.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--mute)]">
        {t('sim.kyc.steps.decision.description')}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = decision === opt.value;
          return (
            <label
              key={opt.value}
              data-clicky-target={opt.clickyTarget}
              data-clicky-hint={`Pick this to ${t(opt.labelKey).toLowerCase()} the application.`}
              className={
                'flex cursor-pointer flex-col gap-2 rounded-[var(--r-md)] p-4 transition ' +
                (active
                  ? `${opt.activeTone} ring-1 ring-inset`
                  : 'bg-white ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{t(opt.labelKey)}</span>
                <input
                  type="radio"
                  name="decision"
                  className="accent-mentora-600"
                  checked={active}
                  onChange={() => setDecision(opt.value)}
                />
              </div>
              <p className="text-xs leading-snug text-[var(--mute)]">{t(opt.descKey)}</p>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ decision })}
          data-clicky-target="submit, finish, decide, send, decision"
          data-clicky-hint="Submits your final KYC decision and scores the run."
          className="btn btn-primary inline-flex items-center gap-2 rounded-[var(--r-md)] px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--cobalt)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.run.submit')}
        </button>
      </div>
    </div>
  );
}
