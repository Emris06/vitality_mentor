import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StepProps } from './stepTypes';

type Decision = 'approve' | 'reject' | 'manual_review';

interface Option {
  value: Decision;
  labelKey: string;
  descKey: string;
  accent: string;
}

const OPTIONS: Option[] = [
  {
    value: 'approve',
    labelKey: 'sim.kyc.steps.decision.approve',
    descKey: 'sim.kyc.steps.decision.approve_desc',
    accent: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  {
    value: 'manual_review',
    labelKey: 'sim.kyc.steps.decision.manual_review',
    descKey: 'sim.kyc.steps.decision.manual_review_desc',
    accent: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  {
    value: 'reject',
    labelKey: 'sim.kyc.steps.decision.reject',
    descKey: 'sim.kyc.steps.decision.reject_desc',
    accent: 'border-rose-300 bg-rose-50 text-rose-900',
  },
];

export function DecisionStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const [decision, setDecision] = useState<Decision | null>(null);

  const canSubmit = decision !== null && !submitting;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-ink-900">
        {t('sim.kyc.steps.decision.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        {t('sim.kyc.steps.decision.description')}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = decision === opt.value;
          return (
            <label
              key={opt.value}
              className={
                'flex cursor-pointer flex-col gap-2 rounded border p-4 transition-colors ' +
                (active ? opt.accent : 'border-ink-200 bg-white hover:bg-ink-50')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-base font-semibold">{t(opt.labelKey)}</span>
                <input
                  type="radio"
                  name="decision"
                  className="accent-brand-600"
                  checked={active}
                  onChange={() => setDecision(opt.value)}
                />
              </div>
              <p className="text-xs leading-snug text-ink-600">{t(opt.descKey)}</p>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ decision })}
          className="inline-flex items-center gap-2 rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.run.submit')}
        </button>
      </div>
    </div>
  );
}
