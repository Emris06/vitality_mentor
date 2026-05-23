import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { simApi, SimHttpError } from '../../../lib/api';

const LAST_RUN_KEY = 'vitality.lastDepositRunId';

export function DepositRunBootstrap() {
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
        const run = await simApi.startRun('deposit', locale);
        if (cancelled) return;
        try {
          window.localStorage.setItem(LAST_RUN_KEY, run.id);
        } catch {
          // ignore storage failure
        }
        navigate(`/simulator/deposit/${run.id}`, { replace: true });
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
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-6 py-12 font-tech">
      <div
        className={
          'w-full max-w-md rounded-md bg-white p-6 text-center ring-1 ' +
          (error ? 'ring-rose-200' : 'ring-zinc-200')
        }
      >
        {!error ? (
          <div className="space-y-3">
            <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-mentora-600" />
            </div>
            <p className="font-mono-tech text-[12px] text-zinc-600">
              {t('sim.run.loading_run')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
            <Link
              to="/simulator"
              className="inline-block rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
            >
              {t('sim.back')}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
