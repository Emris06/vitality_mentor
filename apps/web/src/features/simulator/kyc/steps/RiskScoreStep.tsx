import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StepProps } from './stepTypes';

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskOption {
  value: RiskLevel;
  labelKey: string;
  activeRing: string;
  activeTone: string;
  icon: string;
  clickyTarget: string;
}

const OPTIONS: RiskOption[] = [
  {
    value: 'low',
    labelKey: 'sim.kyc.steps.risk_score.score_low',
    activeRing: 'ring-emerald-300',
    activeTone: 'bg-emerald-50 text-emerald-800',
    icon: '↓',
    clickyTarget: 'low, risk, ↓, score, green',
  },
  {
    value: 'medium',
    labelKey: 'sim.kyc.steps.risk_score.score_medium',
    activeRing: 'ring-amber-300',
    activeTone: 'bg-amber-50 text-amber-800',
    icon: '~',
    clickyTarget: 'medium, mid, risk, score, amber',
  },
  {
    value: 'high',
    labelKey: 'sim.kyc.steps.risk_score.score_high',
    activeRing: 'ring-rose-300',
    activeTone: 'bg-rose-50 text-rose-800',
    icon: '↑',
    clickyTarget: 'high, risk, ↑, score, red',
  },
];

export function RiskScoreStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<RiskLevel | null>(null);
  const [rationale, setRationale] = useState('');

  const canSubmit = level !== null && !submitting;

  return (
    <div
      className="p-6"
      data-clicky-target="risk, score, band, low, medium, high"
      data-clicky-hint={t('clicky.hint.kyc.risk_score')}
    >
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.kyc.steps.risk_score.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.kyc.steps.risk_score.description')}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = level === opt.value;
          return (
            <label
              key={opt.value}
              data-clicky-target={opt.clickyTarget}
              data-clicky-hint={`Mark the client as ${t(opt.labelKey)} risk.`}
              className={
                'flex cursor-pointer flex-col gap-2 rounded-md p-4 transition focus-within:ring-2 ' +
                opt.activeRing +
                ' ' +
                (active
                  ? `${opt.activeTone} ring-1 ring-inset`
                  : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50')
              }
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-md bg-white text-lg font-bold text-zinc-700 ring-1 ring-zinc-200"
                >
                  {opt.icon}
                </span>
                <input
                  type="radio"
                  name="risk"
                  className="accent-mentora-600"
                  checked={active}
                  onChange={() => setLevel(opt.value)}
                />
              </div>
              <div className="text-sm font-semibold">{t(opt.labelKey)}</div>
            </label>
          );
        })}
      </div>

      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder={t('sim.kyc.steps.risk_score.rationale_placeholder')}
        rows={3}
        data-clicky-target="rationale, reason, why, notes, textarea"
        data-clicky-hint="Briefly explain your reasoning — the system reads it for partial credit."
        className="mt-4 w-full resize-none rounded-md bg-white px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
      />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ risk: level, rationale })}
          data-clicky-target="submit, next, continue, risk, score, send"
          data-clicky-hint="Submits the risk score and your rationale."
          className="inline-flex items-center gap-2 rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.run.submit')}
        </button>
      </div>
    </div>
  );
}
