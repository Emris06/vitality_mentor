interface ProgressBarProps {
  /** 0–100 */
  value: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * Thin progress bar used in tables and cards. Pure visual — no business logic.
 * Color steps with progress to keep the dashboard feel "alive".
 */
export function ProgressBar({ value, showLabel = true, className }: ProgressBarProps) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    safe >= 75
      ? 'bg-emerald-500'
      : safe >= 50
        ? 'bg-brand-600'
        : safe >= 25
          ? 'bg-amber-500'
          : 'bg-rose-500';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone}`}
          style={{ width: `${safe}%` }}
          aria-hidden="true"
        />
      </div>
      {showLabel && (
        <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-ink-600">
          {safe}%
        </span>
      )}
    </div>
  );
}
