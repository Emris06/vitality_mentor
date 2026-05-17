import type { ReactNode } from 'react';
import { WarmCard } from './WarmCard';

export type StatTone = 'mentora' | 'coral' | 'amber' | 'emerald';

interface Props {
  label: string;
  /** The big number. ReactNode so consumers can append small inline suffixes
   *  like `<>3 <span className="text-sm font-medium ...">days</span></>`. */
  value: ReactNode;
  /** Optional small text aligned to the baseline of `value`. Used by the
   *  Level card to show "420 / 600 XP" next to the level number. */
  valueSuffix?: ReactNode;
  /** Emoji or icon rendered inside the toned icon chip. */
  icon: ReactNode;
  tone: StatTone;
  subline?: ReactNode;
  /** 0–100. When set, renders a thin progress bar below the value row. */
  progress?: number;
}

const TONE: Record<StatTone, string> = {
  mentora: 'bg-mentora-50 text-mentora-600',
  coral: 'bg-coral-100 text-coral-600',
  amber: 'bg-amber-100 text-amber-600',
  emerald: 'bg-emerald-100 text-emerald-600',
};

export function StatCard({
  label,
  value,
  valueSuffix,
  icon,
  tone,
  subline,
  progress,
}: Props) {
  const pct = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));
  return (
    <WarmCard small className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${TONE[tone]}`}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className="text-2xl font-extrabold text-[var(--ink-warm)]">{value}</div>
        {valueSuffix !== undefined && (
          <div className="text-xs text-[var(--muted-warm)]">{valueSuffix}</div>
        )}
      </div>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-mentora-600 to-mentora-400"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {subline !== undefined && (
        <div className="mt-1 text-xs text-[var(--muted-warm)]">{subline}</div>
      )}
    </WarmCard>
  );
}
