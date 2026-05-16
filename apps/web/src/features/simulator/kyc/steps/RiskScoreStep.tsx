import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StepProps } from './stepTypes';

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskOption {
  value: RiskLevel;
  labelKey: string;
  accent: string;
  ring: string;
  icon: string;
}

const OPTIONS: RiskOption[] = [
  {
    value: 'low',
    labelKey: 'sim.kyc.steps.risk_score.score_low',
    accent: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    ring: 'focus-within:ring-emerald-300',
    icon: '↓',
  },
  {
    value: 'medium',
    labelKey: 'sim.kyc.steps.risk_score.score_medium',
    accent: 'border-amber-300 bg-amber-50 text-amber-800',
    ring: 'focus-within:ring-amber-300',
    icon: '~',
  },
  {
    value: 'high',
    labelKey: 'sim.kyc.steps.risk_score.score_high',
    accent: 'border-rose-300 bg-rose-50 text-rose-800',
    ring: 'focus-within:ring-rose-300',
    icon: '↑',
  },
];

export function RiskScoreStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<RiskLevel | null>(null);
  const [rationale, setRationale] = useState('');

  const canSubmit = level !== null && !submitting;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-ink-900">
        {t('sim.kyc.steps.risk_score.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        {t('sim.kyc.steps.risk_score.description')}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = level === opt.value;
          return (
            <label
              key={opt.value}
              className={
                'flex cursor-pointer flex-col gap-2 rounded border p-4 transition-colors focus-within:ring-2 ' +
                opt.ring +
                ' ' +
                (active ? opt.accent : 'border-ink-200 bg-white hover:bg-ink-50')
              }
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl font-bold text-ink-700 shadow-sm"
                >
                  {opt.icon}
                </span>
                <input
                  type="radio"
                  name="risk"
                  className="accent-brand-600"
                  checked={active}
                  onChange={() => setLevel(opt.value)}
                />
              </div>
              <div className="text-base font-semibold">{t(opt.labelKey)}</div>
            </label>
          );
        })}
      </div>

      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder={t('sim.kyc.steps.risk_score.rationale_placeholder')}
        rows={3}
        className="mt-4 w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
      />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ risk: level, rationale })}
          className="inline-flex items-center gap-2 rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.run.submit')}
        </button>
      </div>
    </div>
  );
}
