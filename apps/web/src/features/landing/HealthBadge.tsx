import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthResponse } from '@vitality/shared';
import { fetchHealth } from '../../lib/api';
import { StatusPill, type StatusTone } from '../../components/ui/StatusPill';

const STATUS_TONE: Record<HealthResponse['status'], StatusTone> = {
  ok: 'success',
  degraded: 'warn',
  down: 'danger',
};

/**
 * Compact health badge — used as a small dev/debug widget in the page footer.
 * Polls /api/health once on mount; surfaces overall status + per-check latency.
 */
export function HealthBadge() {
  const { t } = useTranslation();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; data: HealthResponse }
    | { kind: 'error'; error: string }
  >({ kind: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then((data) => setState({ kind: 'ready', data }))
      .catch((err: unknown) => {
        if ((err as { name?: string }).name !== 'AbortError') {
          setState({ kind: 'error', error: (err as Error).message });
        }
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 shadow-card">
      <span className="uppercase tracking-wider text-slate-400">{t('landing.health_title')}</span>
      {state.kind === 'loading' && <span>{t('landing.health_loading')}</span>}
      {state.kind === 'error' && (
        <StatusPill tone="danger" dot>
          {t('landing.health_error')}
        </StatusPill>
      )}
      {state.kind === 'ready' && (
        <>
          <StatusPill tone={STATUS_TONE[state.data.status]} dot>
            {t(`health.${state.data.status}`)}
          </StatusPill>
          <span className="hidden tabular text-slate-400 md:inline">
            {state.data.checks.map((c) => c.name).join(' · ')}
          </span>
        </>
      )}
    </div>
  );
}
