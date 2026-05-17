import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { LocalePicker } from '../../components/LocalePicker';

// ──────────────────────────────────────────────────────────────────────────
// ChromeShell — Direction A (technical) wrapper for any scenario run page.
//
// The mode-shift between the warm InternShell and this technical chrome is
// the design's whole thesis: gamification surrounds serious bank work, it
// does not replace it.
//
//   ┌────────────────────────────────────────────────────────────────────┐
//   │  ● ● ●  ABC ▸ KYC ▸ Sanctions          SYN-XXX · step 2/4 · UZ/RU │  ← chrome bar
//   ├────────────────────────────────────────────────────────────────────┤
//   │ [steps  ] [    main work area              ] [synthetic rail]     │
//   └────────────────────────────────────────────────────────────────────┘
//
// Typography: Inter (font-tech) with JetBrains Mono (font-mono-tech) for
// IDs, codes, and quantitative data. Corners are 4–8px (rounded-md).
// Status pills use emerald/amber/rose-50 tinted backgrounds.
// ──────────────────────────────────────────────────────────────────────────

export interface StepDef {
  id: string;
  titleKey: string;
}

interface ChromeShellProps {
  steps: StepDef[];
  currentStepId: string | null;
  completedStepIds: string[];
  /** Optional final score — shown in the chrome bar when present. */
  score?: number;
  /** Short run identifier rendered in the chrome bar header.
   *  e.g. "SYN-849-2207". Truncated automatically if longer. */
  runIdShort?: string;
  /** Mono breadcrumb shown in the chrome bar.
   *  e.g. "ABC ▸ KYC ▸ Sanctions". Defaults to the scenario family. */
  breadcrumb?: string;
  children: ReactNode;
  onOpenHint?: () => void;
}

export function ChromeShell({
  steps,
  currentStepId,
  completedStepIds,
  score,
  runIdShort,
  breadcrumb,
  children,
  onOpenHint,
}: ChromeShellProps) {
  const { t } = useTranslation();
  const totalSteps = steps.length;
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  const stepNumber = currentIdx === -1 ? completedStepIds.length : currentIdx + 1;
  const currentTitle =
    currentIdx >= 0 && steps[currentIdx] ? t(steps[currentIdx]!.titleKey) : '';
  const fullCrumb =
    breadcrumb ??
    (currentTitle ? `ABC ▸ KYC ▸ ${currentTitle}` : 'ABC ▸ KYC');

  return (
    <main className="min-h-screen bg-zinc-100 font-tech text-zinc-900">
      {/* ── Chrome bar (Direction A) ──────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5 text-[12px] text-zinc-500">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/intern"
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label={t('sim.back')}
            data-clicky-target="back, exit, leave, home, dashboard, quit"
            data-clicky-hint="Leave the simulator and return to your dashboard. Your progress is saved."
          >
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
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
          </div>
          <span className="text-zinc-300" aria-hidden="true">
            |
          </span>
          <span className="truncate font-mono-tech text-[12px] text-zinc-600">
            {fullCrumb}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="hidden font-mono-tech text-zinc-500 sm:inline">
            {runIdShort ?? 'SYN-849-2207'} · step {Math.max(stepNumber, 1)}/{totalSteps}
          </span>
          {score !== undefined && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono-tech text-emerald-700">
              {t('sim.run.score')} {score}
            </span>
          )}
          <LocalePicker />
        </div>
      </header>

      {/* Mobile warning */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 md:hidden">
        {t('sim.best_on_desktop')}
      </div>

      <div className="mx-auto flex max-w-[1320px] gap-5 px-5 py-5 md:px-6 md:py-6">
        {/* ── Left: step rail ─────────────────────────────────────── */}
        <aside className="hidden w-[220px] shrink-0 md:block">
          <div className="rounded-md bg-white p-3 ring-1 ring-zinc-200">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {t('sim.kyc.header_label')}
            </div>
            <ol className="space-y-1">
              {steps.map((step, idx) => {
                const isCompleted = completedStepIds.includes(step.id);
                const isCurrent = step.id === currentStepId;
                const title = t(step.titleKey);
                return (
                  <li
                    key={step.id}
                    data-clicky-target={`${step.id}, ${title.toLowerCase()}, step ${idx + 1}, ${
                      isCurrent ? 'current, here, now' : isCompleted ? 'done, completed' : 'next, later, upcoming'
                    }`}
                    data-clicky-hint={
                      isCurrent
                        ? `You are on step ${idx + 1}: ${title}. Complete it to move on.`
                        : isCompleted
                          ? `Step ${idx + 1} (${title}) is done.`
                          : `Step ${idx + 1}: ${title}. Locked until you finish the current step.`
                    }
                    className={
                      'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition ' +
                      (isCurrent
                        ? 'bg-mentora-50 text-mentora-600 ring-1 ring-mentora-600/30'
                        : isCompleted
                          ? 'text-zinc-700'
                          : 'text-zinc-400')
                    }
                  >
                    <span
                      className={
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono-tech text-[10px] font-semibold ' +
                        (isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-mentora-600 text-white'
                            : 'bg-zinc-200 text-zinc-500')
                      }
                      aria-hidden="true"
                    >
                      {isCompleted ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-2.5 w-2.5"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span className="truncate font-medium">{title}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* ── Center: work area ───────────────────────────────────── */}
        <section className="min-w-0 flex-1">
          <div className="rounded-md bg-white ring-1 ring-zinc-200">{children}</div>
        </section>

        {/* ── Right: synthetic rail ───────────────────────────────── */}
        <aside className="hidden w-[220px] shrink-0 xl:block">
          <div className="sticky top-[60px] space-y-3">
            <div className="rounded-md bg-white p-3 ring-1 ring-zinc-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {t('sim.kyc.header_label')}
              </div>
              <div className="mt-2 font-mono-tech text-[13px] text-zinc-700">
                step {Math.max(stepNumber, 1)} / {totalSteps}
              </div>
            </div>
            <div className="rounded-md bg-amber-50 p-3 ring-1 ring-amber-200">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Synthetic
              </div>
              <p className="text-[11px] leading-snug text-amber-900">
                {t('sim.kyc.banner_synthetic')}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Floating hint button ─────────────────────────────────── */}
      {onOpenHint && (
        <button
          type="button"
          onClick={onOpenHint}
          data-clicky-target="hint, help, stuck, idea, tip, ai"
          data-clicky-hint="Stuck? This button opens an AI hint scoped to your current step."
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-mentora-600 px-5 py-3 text-sm font-semibold text-white shadow-card-warm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/40"
        >
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
