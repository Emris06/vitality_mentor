import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type ScenarioId,
  type ScenarioMistake,
  type ScenarioRun,
} from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import { ChromeShell, type StepDef } from './ChromeShell';
import { HintPanel } from './HintPanel';
import type { StepProps } from './kyc/steps/stepTypes';

// ──────────────────────────────────────────────────────────────────────────
// Generic scenario runner. Same shape as the original KYC page (loading,
// submitting, toasts, results, hint panel) but parameterized so we don't
// fork the file four times. Each scenario page is a thin wrapper around
// this component.
// ──────────────────────────────────────────────────────────────────────────

export interface ScenarioRunPageProps {
  scenarioId: ScenarioId;
  steps: StepDef[];
  stepComponents: Record<string, ComponentType<StepProps>>;
  /** localStorage key used to remember the last run for refresh resume. */
  lastRunKey: string;
  /** Where the "back" arrow points (the simulator dashboard, usually). */
  backRoute?: string;
}

interface ToastItem {
  id: number;
  message: string;
}

export function ScenarioRunPage({
  scenarioId,
  steps,
  stepComponents,
  lastRunKey,
  backRoute = '/simulator',
}: ScenarioRunPageProps) {
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

  useEffect(() => {
    if (!runId) return;
    try {
      window.localStorage.setItem(lastRunKey, runId);
    } catch {
      // ignore
    }
  }, [runId, lastRunKey]);

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
        } else if (result.mistake) {
          const m = result.mistake;
          const translated = i18n.exists(m.messageKey)
            ? t(m.messageKey)
            : m.messageKey || m.code;
          pushToast(translated);
        }
      } catch (err) {
        const message =
          err instanceof SimHttpError ? err.message : t('sim.run.submit_error');
        pushToast(message);
      } finally {
        setSubmitting(false);
      }
    },
    [i18n, pushToast, run, runId, t],
  );

  const handleRetry = useCallback(async () => {
    try {
      const fresh = await simApi.startRun(scenarioId, locale);
      try {
        window.localStorage.setItem(lastRunKey, fresh.id);
      } catch {
        // ignore
      }
      navigate(`/simulator/${scenarioId}/${fresh.id}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof SimHttpError ? err.message : t('sim.run.load_error');
      pushToast(message);
    }
  }, [scenarioId, locale, navigate, lastRunKey, pushToast, t]);

  if (loadError) {
    return (
      <main className="grid min-h-full place-items-center bg-ink-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-700">{loadError}</p>
          <Link
            to={backRoute}
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
  const StepComponent = run.currentStepId ? stepComponents[run.currentStepId] : null;

  return (
    <>
      <ChromeShell
        steps={steps}
        currentStepId={run.currentStepId}
        completedStepIds={completedStepIds}
        score={run.score}
        onOpenHint={scored ? undefined : () => setHintOpen(true)}
      >
        {scored ? (
          <ResultsView run={run} onRetry={() => void handleRetry()} backRoute={backRoute} />
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
  backRoute: string;
}

function ResultsView({ run, onRetry, backRoute }: ResultsViewProps) {
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
        <p className={`font-display text-6xl tabular ${scoreClass}`}>{score}</p>
        <p className="text-sm text-ink-600">{t('sim.run.score_of_100')}</p>
      </div>

      {mistakes.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
            {t('sim.run.mistakes')}
          </h3>
          <ul className="space-y-2">
            {mistakes.map((m, i) => (
              <li
                key={`${m.stepId}-${i}`}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <span className="font-mono text-xs text-amber-700">{m.stepId}</span>
                <span className="ml-2">{m.messageKey || m.code}</span>
                <span className="ml-2 text-xs text-amber-600">−{m.penalty}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700"
        >
          {t('sim.run.try_again')}
        </button>
        <Link
          to={backRoute}
          className="rounded-full border border-ink-200 bg-white px-5 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
        >
          {t('sim.back')}
        </Link>
      </div>
    </div>
  );
}
