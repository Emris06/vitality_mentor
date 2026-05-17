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

  // Clicky escorts the intern through every step of the simulator. The
  // fallback hint changes as run.currentStepId advances; one-shot hints
  // fire on submit success / mistake so Clicky reacts to the user's moves.
  useClickyEnabled('Read the step instructions, then act. Clicky will react as you move.');
  const { setFallback, pushHint } = useClicky();
  useEffect(() => {
    const stepId = run?.currentStepId;
    if (!stepId) return;
    setFallback(CLICKY_STEP_HINTS[stepId] ?? 'Follow the on-screen instructions.');
  }, [run?.currentStepId, setFallback]);

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
          err instanceof SimHttpError ? err.message : t('sim.run.load_error');
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
            : 'All steps done — let me show you the score.';
          pushHint(`Nice. ${nextHint}`, 4000);
        } else if (result.mistake) {
          // Translate the mistake message key if i18n knows it, otherwise show the code.
          const m = result.mistake;
          const translated = i18n.exists(m.messageKey)
            ? t(m.messageKey)
            : m.messageKey || m.code;
          pushToast(translated);
          pushHint(`Not quite — ${translated}. Try again, you can't break anything.`, 5000);
        }
      } catch (err) {
        const message =
          err instanceof SimHttpError ? err.message : t('sim.run.submit_error');
        pushToast(message);
      } finally {
        setSubmitting(false);
      }
    },
    [i18n, pushHint, pushToast, run, runId, t],
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
      <main className="grid min-h-full place-items-center bg-ink-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-700">{loadError}</p>
          <Link
            to="/simulator"
            className="mt-4 inline-block rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
          >
            {t('sim.back')}
          </Link>
        </div>
      </main>
    );
  }

  if (!run || !runId) {
    return (
      <main className="grid min-h-full place-items-center bg-ink-50 px-6 py-12">
        <p className="text-sm text-ink-600">{t('sim.run.loading_run')}</p>
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
        onOpenHint={scored ? undefined : () => setHintOpen(true)}
      >
        {scored ? (
          <ResultsView run={run} onRetry={() => void handleRetry()} />
        ) : StepComponent ? (
          <StepComponent run={run} submitting={submitting} onSubmit={(p) => void handleSubmit(p)} />
        ) : (
          <div className="p-6 text-sm text-ink-500">{t('sim.run.loading_run')}</div>
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

      {/* Toast stack — inline implementation, no external lib. */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              role="alert"
              className="pointer-events-auto rounded-lg border border-rose-300 bg-rose-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

interface ResultsViewProps {
  run: ScenarioRun;
  onRetry: () => void;
}

function ResultsView({ run, onRetry }: ResultsViewProps) {
  const { t } = useTranslation();
  const score = run.score ?? 0;
  const mistakes: ScenarioMistake[] = run.mistakes ?? [];

  let scoreClass = 'text-emerald-600';
  if (score < 60) scoreClass = 'text-rose-600';
  else if (score < 85) scoreClass = 'text-amber-600';

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-2 border-b border-ink-200 pb-6 text-center">
        <p className="text-xs uppercase tracking-wide text-ink-500">
          {t('sim.run.finished')}
        </p>
        <p className={'text-6xl font-bold tabular-nums ' + scoreClass}>{score}</p>
        <p className="text-sm text-ink-600">
          {mistakes.length === 0
            ? t('sim.run.no_mistakes')
            : t('sim.run.mistake_count', { count: mistakes.length })}
        </p>
      </div>

      {mistakes.length > 0 && (
        <ul className="mt-5 space-y-2">
          {mistakes.map((mistake, idx) => (
            <li
              key={`${mistake.stepId}-${mistake.code}-${idx}`}
              className="flex items-start gap-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white tabular-nums">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-rose-900">{mistake.messageKey || mistake.code}</p>
                <p className="text-xs text-rose-700">
                  <span className="font-mono">{mistake.stepId}</span>
                  <span className="mx-1">·</span>
                  <span className="tabular-nums">-{mistake.penalty}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          {t('sim.run.retry')}
        </button>
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 shadow-sm transition-colors hover:bg-ink-50"
        >
          {t('sim.run.open_chat')}
        </Link>
      </div>
    </div>
  );
}
