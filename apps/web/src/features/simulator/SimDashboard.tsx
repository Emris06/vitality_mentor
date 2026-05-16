import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { DEFAULT_LOCALE, isLocale, type Locale, type ScenarioId } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { ErpShell } from '../workspace/ErpShell';
import { buildWorkspaceSections } from '../workspace/navigation';

const LAST_RUN_KEY = 'vitality.lastKycRunId';

interface ScenarioCard {
  id: ScenarioId;
  enabled: boolean;
  nameKey: string;
  taglineKey: string;
  durationKey?: string;
  disabledKey?: string;
  accent: string;
  emoji: string;
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'kyc',
    enabled: true,
    nameKey: 'sim.scenarios.kyc.name',
    taglineKey: 'sim.scenarios.kyc.tagline',
    durationKey: 'sim.scenarios.kyc.duration',
    accent: 'from-brand-600 to-brand-800',
    emoji: 'KYC',
  },
  {
    id: 'open-account',
    enabled: false,
    nameKey: 'sim.scenarios.open_account.name',
    taglineKey: 'sim.scenarios.open_account.tagline',
    disabledKey: 'sim.scenarios.open_account.disabled',
    accent: 'from-ink-400 to-ink-600',
    emoji: 'ACC',
  },
  {
    id: 'deposit',
    enabled: false,
    nameKey: 'sim.scenarios.deposit.name',
    taglineKey: 'sim.scenarios.deposit.tagline',
    disabledKey: 'sim.scenarios.deposit.disabled',
    accent: 'from-ink-400 to-ink-600',
    emoji: 'DEP',
  },
  {
    id: 'transfer',
    enabled: false,
    nameKey: 'sim.scenarios.transfer.name',
    taglineKey: 'sim.scenarios.transfer.tagline',
    disabledKey: 'sim.scenarios.transfer.disabled',
    accent: 'from-ink-400 to-ink-600',
    emoji: 'TRF',
  },
];

export function SimDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState<ScenarioId | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  const handleStart = useCallback(
    async (id: ScenarioId) => {
      if (id !== 'kyc') return;
      setStarting(id);
      setStartError(null);
      try {
        const run = await simApi.startRun(id, locale);
        try {
          window.localStorage.setItem(LAST_RUN_KEY, run.id);
        } catch {
          // ignore storage failure (e.g. private mode)
        }
        navigate(`/simulator/kyc/${run.id}`);
      } catch (err) {
        const message =
          err instanceof SimHttpError ? err.message : t('sim.run.load_error');
        setStartError(message);
        setStarting(null);
      }
    },
    [locale, navigate, t],
  );

  const roleLabel =
    profile?.role === 'hr'
      ? t('auth.role_hr_name')
      : profile?.role === 'intern'
        ? t('auth.role_intern_name')
        : t('auth.role_employee_name');

  return (
    <ErpShell
      title={t('sim.dashboard_title')}
      subtitle={t('app.name')}
      userName={profile?.fullName ?? 'Team Member'}
      userRole={roleLabel}
      sections={buildWorkspaceSections(profile?.role ?? null)}
      searchPlaceholder="Search scenarios, steps, and simulation runs"
    >
      <section className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
            {t('sim.dashboard_title')}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">{t('sim.dashboard_subtitle')}</p>
        </motion.div>

        {startError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {startError}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {SCENARIOS.map((scenario, idx) => {
            const isStarting = starting === scenario.id;
            const disabled = !scenario.enabled || isStarting;
            return (
              <motion.button
                key={scenario.id}
                type="button"
                disabled={disabled}
                onClick={() => void handleStart(scenario.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 * idx }}
                whileHover={scenario.enabled ? { y: -2 } : undefined}
                className={
                  'group relative overflow-hidden rounded-2xl border bg-white p-6 text-left shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-300 ' +
                  (scenario.enabled
                    ? 'border-ink-200 hover:shadow-md cursor-pointer'
                    : 'border-ink-200 opacity-70 cursor-not-allowed')
                }
                aria-disabled={disabled}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={
                      'grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-xs font-bold tracking-wide text-white ' +
                      scenario.accent
                    }
                  >
                    {scenario.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink-900">{t(scenario.nameKey)}</h2>
                      {!scenario.enabled && scenario.disabledKey && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-600">
                          {t(scenario.disabledKey)}
                        </span>
                      )}
                      {scenario.enabled && scenario.durationKey && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand-700">
                          {t(scenario.durationKey)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-600">{t(scenario.taglineKey)}</p>
                    {scenario.enabled && (
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 group-hover:gap-3 transition-all">
                        {isStarting ? t('sim.run.loading_run') : t('sim.start')}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-10 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('sim.kyc.banner_synthetic')}
        </p>
      </section>
    </ErpShell>
  );
}
