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

  // The three canonical lists banks check against, with their current status.
  const lists = [
    {
      id: 'un',
      label: 'UN consolidated',
      hit: hits.some((h) => h.list === 'UN'),
    },
    {
      id: 'ofac',
      label: 'OFAC SDN',
      hit: hits.some((h) => h.list === 'OFAC'),
    },
    {
      id: 'cbu',
      label: t('sim.kyc.steps.sanctions_check.list'),
      hit: hits.length > 0 && !hits.some((h) => h.list === 'UN' || h.list === 'OFAC'),
    },
  ];

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-[var(--ink)]">
        {t('sim.kyc.steps.sanctions_check.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--mute)]">
        {t('sim.kyc.steps.sanctions_check.description')}
      </p>

      {/* Lists summary — matches mockup 06 lines 331–348. */}
      <div
        className="mt-5 rounded-[var(--r-md)] ring-1 ring-[var(--line)]"
        data-clicky-target="sanctions, lists, screening, un, ofac, cbu"
        data-clicky-hint={t('clicky.hint.kyc.sanctions')}
      >
        {lists.map((entry, idx) => (
          <div
            key={entry.id}
            data-clicky-target={`${entry.id}, sanctions, list, ${entry.label.toLowerCase()}`}
            data-clicky-hint={
              entry.id === 'cbu'
                ? t('clicky.hint.kyc.sanctions_cbu')
                : entry.hit
                  ? `${entry.label}: potential match — read the row before continuing.`
                  : `${entry.label}: clean — no match for this client.`
            }
            className={
              'flex items-center justify-between px-3 py-2.5 text-sm ' +
              (idx > 0 ? 'border-t border-[var(--line)] ' : '') +
              (entry.hit ? 'bg-[var(--warn-tint)] ring-1 ring-inset ring-[var(--warn-ref)]' : '')
            }
          >
            <div className="flex items-center gap-3">
              <span
                className={
                  'font-mono text-[11px] ' +
                  (entry.hit ? 'text-[var(--warn-ref)]' : 'text-[var(--mute-2)]')
                }
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="font-medium text-[var(--ink)]">{entry.label}</span>
            </div>
            {entry.hit ? (
              <span className="rounded-full bg-[var(--warn-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn-ref)]">
                1 potential
              </span>
            ) : (
              <span className="rounded-full bg-[var(--good-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--good)]">
                No match
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Match detail table — only when there ARE hits. Matches the dense
          banking-software table aesthetic. */}
      {hits.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-[var(--r-md)] ring-1 ring-[var(--line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] text-left font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
                <th className="px-4 py-2 font-semibold">
                  {t('sim.kyc.steps.sanctions_check.list')}
                </th>
                <th className="px-4 py-2 font-semibold">
                  {t('sim.kyc.steps.sanctions_check.match')}
                </th>
                <th className="px-4 py-2 font-semibold">
                  {t('sim.kyc.steps.sanctions_check.reason')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-white">
              {hits.map((hit, idx) => (
                <tr key={`${hit.list}-${idx}`} className="hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-2">
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                        (hit.kind === 'sanctions'
                          ? 'bg-[var(--bad-tint)] text-[var(--bad)]'
                          : 'bg-[var(--warn-tint)] text-[var(--warn-ref)]')
                      }
                    >
                      {hit.list}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[var(--ink)]">{hit.match}</td>
                  <td className="px-4 py-2 text-[var(--mute)]">{hit.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ decision: 'pass' })}
          data-clicky-target="pass, continue, ok, clear, next, sanctions"
          data-clicky-hint="Pass sanctions screening. Only when the lists came back clean."
          className="inline-flex min-w-[120px] items-center justify-center rounded-[var(--r-md)] bg-[var(--good)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--good)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.kyc.steps.sanctions_check.decision_pass')}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ decision: 'block' })}
          data-clicky-target="block, escalate, reject, sanctions, hit"
          data-clicky-hint="Block the client. Use this only when there's a real sanctions or PEP hit."
          className="inline-flex min-w-[120px] items-center justify-center rounded-[var(--r-md)] bg-[var(--bad)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--bad)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.kyc.steps.sanctions_check.decision_block')}
        </button>
      </div>
    </div>
  );
}
