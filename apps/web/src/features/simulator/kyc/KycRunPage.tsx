import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type ScenarioMistake,
  type ScenarioRun,
} from '@vitality/shared';
import { simApi, SimHttpError } from '../../../lib/api';
import { ChromeShell, type StepDef } from '../ChromeShell';
import { HintPanel } from '../HintPanel';
import { useClicky, useClickyEnabled } from '../../clicky/ClickyProvider';
import { useClickyAgent } from '../../clicky/useClickyAgent';
import { ClickyVoiceOverlay } from '../../clicky/ClickyVoiceOverlay';
import { speak } from '../../clicky/tts';
import { IntakeStep } from './steps/IntakeStep';
import { VerifyDocumentsStep } from './steps/VerifyDocumentsStep';
import { SanctionsCheckStep } from './steps/SanctionsCheckStep';
import { RiskScoreStep } from './steps/RiskScoreStep';
import { DecisionStep } from './steps/DecisionStep';
import type { StepProps } from './steps/stepTypes';

const LAST_RUN_KEY = 'vitality.lastKycRunId';

const KYC_STEPS: StepDef[] = [
  { id: 'intake', titleKey: 'sim.kyc.steps.intake.title' },
  { id: 'verify_documents', titleKey: 'sim.kyc.steps.verify_documents.title' },
  { id: 'sanctions_check', titleKey: 'sim.kyc.steps.sanctions_check.title' },
  { id: 'risk_score', titleKey: 'sim.kyc.steps.risk_score.title' },
  { id: 'decision', titleKey: 'sim.kyc.steps.decision.title' },
];

// What Clicky should say at each step of the KYC flow. Short, action-first.
const CLICKY_STEP_HINTS: Record<string, string> = {
  intake:
    'Step 1: open the customer file. Just confirm the person on screen and click through to intake.',
  verify_documents:
    'Step 2: documents. Mark each one valid or flag the issue — fakes are in here on purpose.',
  sanctions_check:
    'Step 3: sanctions screening. Cross-check the name against the watchlist before approving.',
  risk_score:
    'Step 4: risk score. Pick the right band based on what you saw in the previous steps.',
  decision:
    'Final step: write your decision. Be specific — "approve" or "reject" alone is not enough.',
};

const STEP_COMPONENTS: Record<string, ComponentType<StepProps>> = {
  intake: IntakeStep,
  verify_documents: VerifyDocumentsStep,
  sanctions_check: SanctionsCheckStep,
  risk_score: RiskScoreStep,
  decision: DecisionStep,
};

interface ToastItem {
  id: number;
  message: string;
}

export function KycRunPage() {
  const { t, i18n } = useTranslation();
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  const [run, setRun] = useState<ScenarioRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);

  // Clicky on. Voice agent + TTS handle all guidance — hold backtick, ask
  // out loud, Clicky moves to the right control and speaks the answer.
  useClickyEnabled();
  const agent = useClickyAgent();
  const { setSpeaking } = useClicky();

  // Persist last run id so a refresh resumes the same session.
  useEffect(() => {
    if (!runId) return;
    try {
      window.localStorage.setItem(LAST_RUN_KEY, runId);
    } catch {
      // ignore
    }
  }, [runId]);

  // Initial load of the run.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoadError(null);
    simApi
      .getRun(runId)
      .then((r) => {
        if (cancelled) return;
        setRun(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof SimHttpError
            ? (i18n.exists(err.message) ? t(err.message) : t('sim.run.load_error'))
            : t('sim.run.load_error');
        setLoadError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, t]);

  const pushToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((curr) => [...curr, { id, message }]);
    window.setTimeout(() => {
      setToasts((curr) => curr.filter((t2) => t2.id !== id));
    }, 4500);
  }, []);

  const handleSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!run || !runId || !run.currentStepId) return;
      const stepId = run.currentStepId;
      setSubmitting(true);
      try {
        const result = await simApi.submitStep(runId, stepId, payload);
        setRun(result.run);
        if (result.ok) {
          setCompletedStepIds((curr) =>
            curr.includes(stepId) ? curr : [...curr, stepId],
          );
          const nextHint = result.nextStepId
            ? (CLICKY_STEP_HINTS[result.nextStepId] ?? 'Next step is up.')
            : 'All steps done. Let me show you the score.';
          speak(`Nice. ${nextHint}`, {
            locale,
            onStart: () => setSpeaking(true),
            onEnd: () => setSpeaking(false),
            onError: () => setSpeaking(false),
          });
        } else if (result.mistake) {
          // Translate the mistake message key if i18n knows it, otherwise show the code.
          const m = result.mistake;
          const translated = i18n.exists(m.messageKey)
            ? t(m.messageKey)
            : m.messageKey || m.code;
          pushToast(translated);
          speak(`Not quite. ${translated}. Try again, you can't break anything.`, {
            locale,
            onStart: () => setSpeaking(true),
            onEnd: () => setSpeaking(false),
            onError: () => setSpeaking(false),
          });
        }
      } catch (err) {
        const message =
          err instanceof SimHttpError
            ? (i18n.exists(err.message) ? t(err.message) : t('sim.run.submit_error'))
            : t('sim.run.submit_error');
        pushToast(message);
      } finally {
        setSubmitting(false);
      }
    },
    [i18n, locale, pushToast, run, runId, setSpeaking, t],
  );

  const handleRetry = useCallback(async () => {
    try {
      const fresh = await simApi.startRun('kyc', locale);
      try {
        window.localStorage.setItem(LAST_RUN_KEY, fresh.id);
      } catch {
        // ignore
      }
      navigate(`/simulator/kyc/${fresh.id}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof SimHttpError ? err.message : t('sim.run.load_error');
      pushToast(message);
    }
  }, [locale, navigate, pushToast, t]);

  if (loadError) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', background: 'var(--surface-2)', padding: '48px 24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 24, textAlign: 'center', border: '1px solid rgba(200,53,28,0.2)' }}>
          <p style={{ fontSize: 13, color: 'var(--bad)', marginBottom: 16 }}>{loadError}</p>
          <Link to="/simulator" className="ref-btn">
            {t('sim.back')}
          </Link>
        </div>
      </main>
    );
  }

  if (!run || !runId) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', background: 'var(--surface-2)', fontFamily: 'var(--font-sans)' }}>
        <p style={{ fontSize: 13, color: 'var(--mute)' }}>{t('sim.run.loading_run')}</p>
      </main>
    );
  }

  const scored = run.status === 'scored';
  const StepComponent = run.currentStepId ? STEP_COMPONENTS[run.currentStepId] : null;

  return (
    <>
      <ChromeShell
        steps={KYC_STEPS}
        currentStepId={run.currentStepId}
        completedStepIds={completedStepIds}
        score={run.score}
        runIdShort={shortenRunId(runId)}
        onOpenHint={scored ? undefined : () => setHintOpen(true)}
      >
        {scored ? (
          <ResultsView run={run} onRetry={() => void handleRetry()} />
        ) : StepComponent ? (
          <div className="crm-card">
            <StepComponent run={run} submitting={submitting} onSubmit={(p) => void handleSubmit(p)} />
          </div>
        ) : (
          <div style={{ padding: 24, fontSize: 13, color: 'var(--mute)' }}>{t('sim.run.loading_run')}</div>
        )}
      </ChromeShell>

      {run.currentStepId && !scored && (
        <HintPanel
          open={hintOpen}
          onClose={() => setHintOpen(false)}
          runId={runId}
          stepId={run.currentStepId}
        />
      )}

      {/* Toast stack */}
      <div style={{ pointerEvents: 'none', position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 440, padding: '0 16px', fontFamily: 'var(--font-sans)' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              role="alert"
              style={{ pointerEvents: 'auto', borderRadius: 'var(--r-md)', background: 'var(--bad)', padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#fff', boxShadow: 'var(--shadow-md)' }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ClickyVoiceOverlay agent={agent} />
    </>
  );
}

// Shorten a UUID-shaped run id into a banking-ops style identifier the
// chrome bar can show without overflow. e.g. "abc12345-..." → "SYN-ABC-1234".
function shortenRunId(id: string): string {
  const hex = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  if (hex.length < 8) return 'SYN-' + hex;
  return `SYN-${hex.slice(0, 3)}-${hex.slice(3, 7)}`;
}

function gradeLabel(score: number): { text: string; color: string; bg: string } {
  if (score >= 95) return { text: 'S', color: '#0B8F5C', bg: '#E3F6EC' };
  if (score >= 85) return { text: 'A', color: '#0B8F5C', bg: '#E3F6EC' };
  if (score >= 75) return { text: 'B', color: '#2046FF', bg: '#ECF0FF' };
  if (score >= 60) return { text: 'C', color: '#C58200', bg: '#FFF4DC' };
  return { text: 'D', color: '#C8351C', bg: '#FCE9E4' };
}

interface ResultsViewProps {
  run: ScenarioRun;
  onRetry: () => void;
}

function ResultsView({ run, onRetry }: ResultsViewProps) {
  const { t, i18n } = useTranslation();
  const score = run.score ?? 0;
  const mistakes: ScenarioMistake[] = run.mistakes ?? [];
  const critical = mistakes.filter((m) => m.penalty >= 20);
  const grade = gradeLabel(score);
  const estimatedXp = Math.round(score * 1.5);
  const scoreColor = score >= 85 ? 'var(--good)' : score >= 60 ? 'var(--warn-ref)' : 'var(--bad)';

  function stepTitle(stepId: string): string {
    const def = KYC_STEPS.find((s) => s.id === stepId);
    return def ? t(def.titleKey) : stepId;
  }

  function translateMistake(m: ScenarioMistake): string {
    return i18n.exists(m.messageKey) ? t(m.messageKey) : (m.messageKey || m.code);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, marginBottom: 24, alignItems: 'start' }}>
        {/* Score hero */}
        <div className="score-hero">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)', margin: '0 0 10px' }}>
                {t('sim.run.finished')}
              </p>
              <div className="score-number" style={{ color: scoreColor }}>{score}</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: grade.bg, color: grade.color, fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>
              {grade.text}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 16 }}>
            {mistakes.length === 0 ? t('sim.run.no_mistakes') : t('sim.run.mistake_count', { count: mistakes.length })}
          </p>
          {[
            { label: 'Правильность', val: Math.min(100, score + 2), color: 'var(--good)' },
            { label: 'Скорость', val: Math.max(20, score - 10), color: 'var(--cobalt)' },
            { label: 'Комплаенс', val: critical.length === 0 ? 100 : Math.max(10, 100 - critical.length * 20), color: critical.length === 0 ? 'var(--good)' : 'var(--bad)' },
          ].map((row) => (
            <div key={row.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mute)', marginBottom: 4, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                <span>{row.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.val}</span>
              </div>
              <div className="bd-meter">
                <i style={{ width: `${row.val}%`, background: row.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* XP burst + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="xp-burst">
            <small>XP заработано</small>
            <div className="xp-num">{estimatedXp}<em>XP</em></div>
            <div className="xp-levelbar">
              <i style={{ width: `${Math.min(100, (estimatedXp % 500) / 5)}%` }} />
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 18 }}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 14 }}>Что дальше?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" onClick={onRetry} data-clicky-target="retry, again, restart, run, kyc" data-clicky-hint="Start a fresh KYC run with new synthetic data." className="ref-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {t('sim.run.retry')}
              </button>
              <Link to="/chat" data-clicky-target="chat, ai, mentor, ask, talk" data-clicky-hint="Open the AI mentor chat to ask follow-up questions." className="ref-btn" style={{ display: 'flex', justifyContent: 'center' }}>
                {t('sim.run.open_chat')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {mistakes.length > 0 && (
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 12 }}>
            {t('sim.run.mistake_count', { count: mistakes.length })}
          </p>
          {mistakes.map((m, idx) => (
            <div key={`${m.stepId}-${m.code}-${idx}`} className={`mistake-card${m.penalty >= 20 ? ' bad' : ''}`}>
              <b>{translateMistake(m)}</b>
              <p>
                {stepTitle(m.stepId)}
                <span style={{ margin: '0 6px', color: 'var(--mute-3)' }}>·</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>-{m.penalty} pts</span>
              </p>
            </div>
          ))}
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--mute)', textAlign: 'center' }}>
            {t('sim.run.review_with_mentor')}
          </p>
        </div>
      )}
    </div>
  );
}
