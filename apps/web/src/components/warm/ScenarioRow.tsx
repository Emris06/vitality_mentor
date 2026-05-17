import type { ReactNode } from 'react';

export type ScenarioStatus = 'in_progress' | 'mastered' | 'not_started' | 'locked';
export type ScenarioIconTone = 'mentora' | 'emerald' | 'violet' | 'rose';

interface Props {
  icon: ReactNode;
  iconTone?: ScenarioIconTone;
  title: string;
  /** Sub-line under the title, e.g. "2 / 4 steps" or "Locked — finish KYC first". */
  steps: string;
  /** Module label in the second column, e.g. "Retail Ops". */
  module: string;
  /** 0–100. */
  progressPct: number;
  status: ScenarioStatus;
  onMenuClick?: () => void;
}

const ICON_BG: Record<ScenarioIconTone, string> = {
  mentora: 'bg-mentora-50',
  emerald: 'bg-emerald-50',
  violet: 'bg-violet-50',
  rose: 'bg-rose-50',
};

const STATUS_LABEL: Record<ScenarioStatus, string> = {
  // TODO: i18n in Phase 3 (intern.scenarios.status.*)
  in_progress: 'In progress',
  mastered: 'Mastered',
  not_started: 'Not started',
  locked: 'Locked',
};

const STATUS_PILL: Record<ScenarioStatus, string> = {
  in_progress: 'bg-amber-50 text-amber-700',
  mastered: 'bg-emerald-50 text-emerald-700',
  not_started: 'bg-mentora-50 text-mentora-600',
  locked: 'bg-zinc-100 text-zinc-500',
};

const PCT_TEXT: Record<ScenarioStatus, string> = {
  in_progress: 'text-mentora-600',
  mastered: 'text-emerald-600',
  not_started: 'text-[var(--muted-warm)]',
  locked: 'text-[var(--muted-warm)]',
};

export function ScenarioRow({
  icon,
  iconTone = 'mentora',
  title,
  steps,
  module,
  progressPct,
  status,
  onMenuClick,
}: Props) {
  const locked = status === 'locked';
  const pct = Math.min(100, Math.max(0, progressPct));
  return (
    <div className="grid grid-cols-[1.4fr_0.9fr_1fr_0.7fr_0.4fr] items-center gap-3 border-t border-zinc-100 px-6 py-3.5">
      <div className={`flex items-center gap-3 ${locked ? 'opacity-60' : ''}`}>
        <span
          className={`grid h-9 w-9 place-items-center rounded-2xl text-base ${ICON_BG[iconTone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-bold text-[var(--ink-warm)]">{title}</div>
          <div className="text-xs text-[var(--muted-warm)]">{steps}</div>
        </div>
      </div>
      <span
        className={`text-sm ${locked ? 'text-[var(--muted-warm)]' : 'text-[var(--ink-warm-2)]'}`}
      >
        {module}
      </span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          {pct > 0 && (
            <div
              className={`h-full rounded-full ${
                status === 'mastered'
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-mentora-600 to-mentora-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <span className={`text-xs font-bold ${PCT_TEXT[status]}`}>
          {locked ? '—' : `${pct}%`}
        </span>
      </div>
      <span
        className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_PILL[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
      <button
        type="button"
        onClick={onMenuClick}
        className="ml-auto grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"
        aria-label="More options"
      >
        ⋯
      </button>
    </div>
  );
}
