import { useTranslation } from 'react-i18next';
import { readState, type StepProps } from './stepTypes';

interface Hit {
  list: string;
  match: string;
  reason: string;
  kind: 'sanctions' | 'pep';
}

export function SanctionsCheckStep({ run, submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const state = readState(run);
  const person = state.person;

  const hits: Hit[] = [];
  if (state.sanctionsHit?.hit) {
    hits.push({
      list: state.sanctionsHit.list ?? 'OFAC',
      match: person?.fullName ?? '—',
      reason: state.sanctionsHit.reason ?? t('sim.kyc.steps.sanctions_check.hit_sanctions'),
      kind: 'sanctions',
    });
  }
  if (state.pepHit?.isPep) {
    hits.push({
      list: 'PEP',
      match: person?.fullName ?? '—',
      reason: state.pepHit.role ?? t('sim.kyc.steps.sanctions_check.pep_label'),
      kind: 'pep',
    });
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-ink-900">
        {t('sim.kyc.steps.sanctions_check.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        {t('sim.kyc.steps.sanctions_check.description')}
      </p>

      <div className="mt-5 overflow-hidden rounded border border-ink-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-700">
              <th className="px-4 py-2">{t('sim.kyc.steps.sanctions_check.list')}</th>
              <th className="px-4 py-2">{t('sim.kyc.steps.sanctions_check.match')}</th>
              <th className="px-4 py-2">{t('sim.kyc.steps.sanctions_check.reason')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 bg-white">
            {hits.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-ink-500">
                  {t('sim.kyc.steps.sanctions_check.no_hits')}
                </td>
              </tr>
            ) : (
              hits.map((hit, idx) => (
                <tr key={`${hit.list}-${idx}`} className="hover:bg-ink-50">
                  <td className="px-4 py-2">
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ' +
                        (hit.kind === 'sanctions'
                          ? 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-amber-300 bg-amber-50 text-amber-800')
                      }
                    >
                      {hit.list}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-900">{hit.match}</td>
                  <td className="px-4 py-2 text-ink-700">{hit.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ decision: 'pass' })}
          className="inline-flex min-w-[120px] items-center justify-center rounded border border-emerald-700 bg-emerald-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.kyc.steps.sanctions_check.decision_pass')}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ decision: 'block' })}
          className="inline-flex min-w-[120px] items-center justify-center rounded border border-rose-700 bg-rose-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.kyc.steps.sanctions_check.decision_block')}
        </button>
      </div>
    </div>
  );
}
