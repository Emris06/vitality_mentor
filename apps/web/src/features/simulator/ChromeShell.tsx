import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { LocalePicker } from '../../components/LocalePicker';

export interface StepDef {
  id: string;
  titleKey: string;
}

interface ChromeShellProps {
  steps: StepDef[];
  currentStepId: string | null;
  completedStepIds: string[];
  score?: number;
  children: ReactNode;
  onOpenHint?: () => void;
}

export function ChromeShell({
  steps,
  currentStepId,
  completedStepIds,
  score,
  children,
  onOpenHint,
}: ChromeShellProps) {
  const { t } = useTranslation();
  const totalSteps = steps.length;
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  const stepNumber = currentIdx === -1 ? completedStepIds.length : currentIdx + 1;

  return (
    <main className="flex h-full min-h-screen flex-col bg-ink-100 text-ink-900">
      {/* Top toolbar — production-banking chrome */}
      <header className="flex h-11 shrink-0 items-center justify-between bg-brand-700 px-3 text-white shadow">
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/simulator"
            className="grid h-7 w-7 place-items-center rounded border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label={t('sim.back')}
          >
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
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </Link>
          <span className="font-semibold tracking-tight">{t('sim.kyc.header_label')}</span>
          <span className="hidden md:inline-block text-white/40">|</span>
          <span className="hidden md:inline-block text-xs text-white/80">
            {t('sim.run.step_of', { current: Math.max(stepNumber, 1), total: totalSteps })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs">
            <span className="uppercase tracking-wide text-white/70">{t('sim.run.score')}</span>
            <span className="font-semibold tabular-nums">{score ?? 0}</span>
          </div>
          <LocalePicker />
        </div>
      </header>

      {/* Mobile warning */}
      <div className="md:hidden border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {t('sim.best_on_desktop')}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left steps panel */}
        <aside className="border-b border-ink-300 bg-white px-3 py-3 md:w-64 md:shrink-0 md:border-b-0 md:border-r md:py-5">
          <ol className="flex gap-2 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible">
            {steps.map((step, idx) => {
              const isCompleted = completedStepIds.includes(step.id);
              const isCurrent = step.id === currentStepId;
              const stateClasses = isCurrent
                ? 'bg-brand-50 text-brand-800 border-brand-200'
                : isCompleted
                  ? 'bg-white text-ink-700 border-ink-200'
                  : 'bg-white text-ink-400 border-ink-200';
              return (
                <li
                  key={step.id}
                  className={
                    'flex items-center gap-2 rounded border px-2.5 py-2 text-xs md:text-sm whitespace-nowrap md:whitespace-normal ' +
                    stateClasses
                  }
                >
                  <span
                    className={
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums ' +
                      (isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-brand-600 text-white'
                          : 'bg-ink-200 text-ink-600')
                    }
                    aria-hidden="true"
                  >
                    {isCompleted ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="truncate">{t(step.titleKey)}</span>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Main work area */}
        <section className="min-w-0 flex-1 px-3 py-4 md:px-6 md:py-6">
          <div className="rounded border border-ink-300 bg-white shadow-sm">{children}</div>
        </section>

        {/* Right rail — synthetic data banner pinned */}
        <aside className="hidden md:block w-72 shrink-0 border-l border-ink-300 bg-white px-4 py-5">
          <div className="sticky top-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-wide">
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>Synthetic</span>
            </div>
            <p className="leading-snug">{t('sim.kyc.banner_synthetic')}</p>
          </div>
        </aside>
      </div>

      {/* Floating hint button */}
      {onOpenHint && (
        <button
          type="button"
          onClick={onOpenHint}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
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
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.8.6 1 1.6 1 2.3v1h6v-1c0-.7.2-1.7 1-2.3A7 7 0 0 0 12 2z" />
          </svg>
          {t('sim.run.hint')}
        </button>
      )}
    </main>
  );
}
