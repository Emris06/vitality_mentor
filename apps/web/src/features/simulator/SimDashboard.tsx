import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { DEFAULT_LOCALE, isLocale, type Locale, type ScenarioId } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { InternShell } from '../workspace/InternShell';
import { WarmCard } from '../../components/warm/WarmCard';

// ──────────────────────────────────────────────────────────────────────────
// Scenario catalog — the intern's "all scenarios" view.
//
// Wraps in InternShell (warm) since `/simulator` is an intern surface in
// `buildWorkspaceSections`. Picking a scenario routes into the Direction A
// run pages — the mode-shift happens on click, not on this page.
// ──────────────────────────────────────────────────────────────────────────

const SCENARIO_PATH: Record<ScenarioId, string> = {
  kyc: 'kyc',
  'open-account': 'open-account',
  deposit: 'deposit',
  transfer: 'transfer',
};

const LAST_RUN_KEYS: Record<ScenarioId, string> = {
  kyc: 'vitality.lastKycRunId',
  'open-account': 'vitality.lastOpenAccountRunId',
  deposit: 'vitality.lastDepositRunId',
  transfer: 'vitality.lastTransferRunId',
};

interface ScenarioCard {
  id: ScenarioId;
  enabled: boolean;
  nameKey: string;
  taglineKey: string;
  durationKey?: string;
  disabledKey?: string;
  iconTone: 'mentora' | 'emerald' | 'violet' | 'rose';
  emoji: string;
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'kyc',
    enabled: true,
    nameKey: 'sim.scenarios.kyc.name',
    taglineKey: 'sim.scenarios.kyc.tagline',
    durationKey: 'sim.scenarios.kyc.duration',
    iconTone: 'mentora',
    emoji: '📋',
  },
  {
    id: 'open-account',
    enabled: true,
    nameKey: 'sim.scenarios.open_account.name',
    taglineKey: 'sim.scenarios.open_account.tagline',
    durationKey: 'sim.scenarios.open_account.duration',
    iconTone: 'emerald',
    emoji: '💳',
  },
  {
    id: 'deposit',
    enabled: true,
    nameKey: 'sim.scenarios.deposit.name',
    taglineKey: 'sim.scenarios.deposit.tagline',
    durationKey: 'sim.scenarios.deposit.duration',
    iconTone: 'violet',
    emoji: '💰',
  },
  {
    id: 'transfer',
    enabled: true,
    nameKey: 'sim.scenarios.transfer.name',
    taglineKey: 'sim.scenarios.transfer.tagline',
    durationKey: 'sim.scenarios.transfer.duration',
    iconTone: 'rose',
    emoji: '↔',
  },
];

const ICON_BG: Record<ScenarioCard['iconTone'], string> = {
  mentora: 'bg-mentora-50 text-mentora-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
};

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
      setStarting(id);
      setStartError(null);
      try {
        const run = await simApi.startRun(id, locale);
        try {
          window.localStorage.setItem(LAST_RUN_KEYS[id], run.id);
        } catch {
          // ignore storage failure (e.g. private mode)
        }
        navigate(`/simulator/${SCENARIO_PATH[id]}/${run.id}`);
      } catch (err) {
        const message =
          err instanceof SimHttpError ? err.message : t('sim.run.load_error');
        setStartError(message);
        setStarting(null);
      }
    },
    [locale, navigate, t],
  );

  const userName = profile?.fullName ?? 'Intern';
  const firstName = userName.split(/\s+/)[0] ?? userName;

  return (
    <InternShell
      enableClicky
      userName={userName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('sim.dashboard_title')}
    >
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="max-w-2xl text-[15px] leading-relaxed text-[var(--ink-warm-2)]"
      >
        {t('sim.dashboard_subtitle')}
      </motion.p>

      {startError && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
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
              transition={{ duration: 0.3, ease: 'easeOut', delay: 0.04 * idx }}
              whileHover={scenario.enabled ? { y: -2 } : undefined}
              data-clicky-target={`${scenario.id}, scenario, ${t(scenario.nameKey).toLowerCase()}`}
              data-clicky-hint={
                scenario.enabled
                  ? `Start the "${t(scenario.nameKey)}" scenario with synthetic data.`
                  : `"${t(scenario.nameKey)}" — coming soon.`
              }
              aria-disabled={disabled}
              className={
                'block text-left ' +
                (scenario.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-70')
              }
            >
              <WarmCard className="p-6 transition hover:shadow-card-warm">
                <div className="flex items-start gap-4">
                  <div
                    className={
                      'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl ' +
                      ICON_BG[scenario.iconTone]
                    }
                  >
                    {scenario.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-extrabold text-[var(--ink-warm)]">
                        {t(scenario.nameKey)}
                      </h2>
                      {!scenario.enabled && scenario.disabledKey && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                          {t(scenario.disabledKey)}
                        </span>
                      )}
                      {scenario.enabled && scenario.durationKey && (
                        <span className="rounded-full bg-mentora-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-mentora-600">
                          {t(scenario.durationKey)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-warm-2)]">
                      {t(scenario.taglineKey)}
                    </p>
                    {scenario.enabled && (
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-mentora-600 transition-all group-hover:gap-3">
                        {isStarting ? t('sim.run.loading_run') : t('sim.start')}
                        <svg
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
              </WarmCard>
            </motion.button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        {t('sim.kyc.banner_synthetic')}
      </div>
    </InternShell>
  );
}
