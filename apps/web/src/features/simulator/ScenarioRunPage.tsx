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
      <main className="grid min-h-screen place-items-center bg-zinc-100 px-6 py-12 font-tech">
        <div className="w-full max-w-md rounded-md bg-white p-6 text-center ring-1 ring-rose-200">
          <p className="text-sm text-rose-700">{loadError}</p>
          <Link
            to={backRoute}
            className="mt-4 inline-block rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
          >
            {t('sim.back')}
          </Link>
        </div>
      </main>
    );
  }

  if (!run || !runId) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 px-6 py-12 font-tech">
        <p className="text-sm text-zinc-600">{t('sim.run.loading_run')}</p>
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
        runIdShort={shortenRunId(runId)}
        onOpenHint={scored ? undefined : () => setHintOpen(true)}
      >
        {scored ? (
          <ResultsView
            run={run}
            steps={steps}
            onRetry={() => void handleRetry()}
            backRoute={backRoute}
          />
        ) : StepComponent ? (
          <StepComponent run={run} submitting={submitting} onSubmit={(p) => void handleSubmit(p)} />
        ) : (
          <div className="p-6 text-sm text-zinc-500">{t('sim.run.loading_run')}</div>
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

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 font-tech">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              role="alert"
              className="pointer-events-auto rounded-md bg-rose-600 px-4 py-3 text-sm font-medium text-white shadow-card-warm-sm"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function shortenRunId(id: string): string {
  const hex = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  if (hex.length < 8) return 'SYN-' + hex;
  return `SYN-${hex.slice(0, 3)}-${hex.slice(3, 7)}`;
}

interface ResultsViewProps {
  run: ScenarioRun;
  steps: StepDef[];
  onRetry: () => void;
  backRoute: string;
}

function ResultsView({ run, steps, onRetry, backRoute }: ResultsViewProps) {
  const { t, i18n } = useTranslation();
  const score = run.score ?? 0;
  const mistakes: ScenarioMistake[] = run.mistakes ?? [];

  const critical = mistakes.filter((m) => m.penalty >= 20);
  const minor = mistakes.filter((m) => m.penalty < 20);

  let scoreClass = 'text-emerald-600';
  if (score < 60) scoreClass = 'text-rose-600';
  else if (score < 85) scoreClass = 'text-amber-600';

  function stepTitle(stepId: string): string {
    const def = steps.find((s) => s.id === stepId);
    return def ? t(def.titleKey) : stepId;
  }

  function translateMistake(m: ScenarioMistake): string {
    return i18n.exists(m.messageKey) ? t(m.messageKey) : (m.messageKey || m.code);
  }

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-2 border-b border-zinc-100 pb-6 text-center">
        <p className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          {t('sim.run.finished')}
        </p>
        <p className={'font-mono-tech text-6xl font-bold ' + scoreClass}>{score}</p>
        <p className="text-sm text-zinc-600">
          {mistakes.length === 0
            ? t('sim.run.no_mistakes')
            : t('sim.run.mistake_count', { count: mistakes.length })}
        </p>
      </div>

      {critical.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-rose-600">
            {t('sim.run.critical_mistakes', { count: critical.length })}
          </h3>
          <ul className="space-y-2">
            {critical.map((m, idx) => (
              <li
                key={`${m.stepId}-${m.code}-${idx}`}
                className="rounded-md bg-rose-50 px-3 py-3 ring-1 ring-rose-200"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-600 font-mono-tech text-[10px] font-bold text-white">
                    !
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-rose-900">{translateMistake(m)}</p>
                    <p className="mt-0.5 text-xs text-rose-600">
                      <span className="font-medium">{stepTitle(m.stepId)}</span>
                      <span className="mx-1.5 text-rose-400">·</span>
                      <span className="font-mono-tech">-{m.penalty} pts</span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {minor.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            {t('sim.run.minor_mistakes', { count: minor.length })}
          </h3>
          <ul className="space-y-2">
            {minor.map((m, idx) => (
              <li
                key={`${m.stepId}-${m.code}-${idx}`}
                className="rounded-md bg-amber-50 px-3 py-3 ring-1 ring-amber-200"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500 font-mono-tech text-[10px] font-bold text-white">
                    ·
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-900">{translateMistake(m)}</p>
                    <p className="mt-0.5 text-xs text-amber-600">
                      <span className="font-medium">{stepTitle(m.stepId)}</span>
                      <span className="mx-1.5 text-amber-400">·</span>
                      <span className="font-mono-tech">-{m.penalty} pts</span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mistakes.length > 0 && (
        <p className="mt-4 text-center text-xs text-zinc-500">
          {t('sim.run.review_with_mentor')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          data-clicky-target="retry, again, restart, run"
          data-clicky-hint="Start a fresh run with new synthetic data."
          className="inline-flex items-center gap-2 rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
        >
          {t('sim.run.retry')}
        </button>
        <Link
          to={backRoute}
          className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
        >
          {t('sim.back')}
        </Link>
      </div>
    </div>
  );
}
