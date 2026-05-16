import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { simApi, SimHttpError } from '../../../lib/api';

const LAST_RUN_KEY = 'vitality.lastKycRunId';

/**
 * Visiting `/simulator/kyc` (without a runId) creates a fresh KYC run and
 * redirects to `/simulator/kyc/:runId`. Used as the CTA from the dashboard.
 */
export function KycRunBootstrap() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const run = await simApi.startRun('kyc', locale);
        if (cancelled) return;
        try {
          window.localStorage.setItem(LAST_RUN_KEY, run.id);
        } catch {
          // ignore storage failure
        }
        navigate(`/simulator/kyc/${run.id}`, { replace: true });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof SimHttpError ? err.message : t('sim.run.load_error');
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, navigate, t]);

  return (
    <main className="grid min-h-full place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-sm">
        {!error ? (
          <p className="text-sm text-ink-600">{t('sim.run.loading_run')}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
            <Link
              to="/simulator"
              className="inline-block rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
            >
              {t('sim.back')}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
