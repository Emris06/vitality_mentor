import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { DEFAULT_LOCALE, isLocale, type Locale, type ScenarioId } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { InternShell } from '../workspace/InternShell';

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
  emoji: string;
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'kyc',
    enabled: true,
    nameKey: 'sim.scenarios.kyc.name',
    taglineKey: 'sim.scenarios.kyc.tagline',
    durationKey: 'sim.scenarios.kyc.duration',
    emoji: '📋',
  },
  {
    id: 'open-account',
    enabled: true,
    nameKey: 'sim.scenarios.open_account.name',
    taglineKey: 'sim.scenarios.open_account.tagline',
    durationKey: 'sim.scenarios.open_account.duration',
    emoji: '💳',
  },
  {
    id: 'deposit',
    enabled: true,
    nameKey: 'sim.scenarios.deposit.name',
    taglineKey: 'sim.scenarios.deposit.tagline',
    durationKey: 'sim.scenarios.deposit.duration',
    emoji: '💰',
  },
  {
    id: 'transfer',
    enabled: true,
    nameKey: 'sim.scenarios.transfer.name',
    taglineKey: 'sim.scenarios.transfer.tagline',
    durationKey: 'sim.scenarios.transfer.duration',
    emoji: '↔',
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
      setStarting(id);
      setStartError(null);
      try {
        const run = await simApi.startRun(id, locale);
        try {
          window.localStorage.setItem(LAST_RUN_KEYS[id], run.id);
        } catch {
          // ignore storage failure
        }
        navigate(`/simulator/${id}/${run.id}`);
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
      userName={userName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('sim.dashboard_title')}
    >
      <p
        style={{
          color: 'var(--mute)',
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 560,
          marginBottom: 24,
        }}
      >
        {t('sim.dashboard_subtitle')}
      </p>

      {startError && (
        <div
          role="alert"
          style={{
            background: 'var(--bad-tint)',
            border: '1px solid rgba(200,53,28,0.2)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--bad)',
            marginBottom: 16,
          }}
        >
          {startError}
        </div>
      )}

      <div className="scenarios">
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
              data-clicky-target={`${scenario.id}, scenario, ${t(scenario.nameKey).toLowerCase()}`}
              data-clicky-hint={
                scenario.enabled
                  ? `Start the "${t(scenario.nameKey)}" scenario with synthetic data.`
                  : `"${t(scenario.nameKey)}" — coming soon.`
              }
              aria-disabled={disabled}
              className={`scenario${!scenario.enabled ? ' locked' : ''}`}
              style={{ textAlign: 'left', width: '100%' }}
            >
              <div className="scenario-glyph">{scenario.emoji}</div>

              <div>
                <div className="scenario-name">{t(scenario.nameKey)}</div>
                <p className="scenario-desc" style={{ margin: 0 }}>{t(scenario.taglineKey)}</p>
              </div>

              <div className="scenario-foot">
                {scenario.durationKey && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--cobalt-tint)',
                      color: 'var(--cobalt)',
                      borderRadius: 4,
                      padding: '2px 7px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t(scenario.durationKey)}
                  </span>
                )}
                {!scenario.enabled && scenario.disabledKey && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--surface-2)',
                      color: 'var(--mute)',
                      borderRadius: 4,
                      padding: '2px 7px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t(scenario.disabledKey)}
                  </span>
                )}
                <span style={{ color: isStarting ? 'var(--mute)' : 'var(--cobalt)', fontWeight: 600 }}>
                  {isStarting ? '…' : '→'}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 20,
          background: 'var(--synth-tint)',
          border: '1px solid rgba(255,122,26,0.25)',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          fontSize: 13,
          color: '#7A4000',
        }}
      >
        {t('sim.kyc.banner_synthetic')}
      </div>
    </InternShell>
  );
}
