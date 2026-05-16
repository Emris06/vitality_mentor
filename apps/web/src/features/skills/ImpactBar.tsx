import { motion } from 'framer-motion';

/**
 * Renders a 0..1 impact score as a horizontal bar with a numeric badge on the
 * right. Pure presentation, no state.
 */
interface ImpactBarProps {
  /** Impact score in [0, 1]. Values outside the range are clamped. */
  value: number;
  /** Optional accessible label (defaults to "Impact"). */
  label?: string;
}

export function ImpactBar({ value, label = 'Impact' }: ImpactBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const tone =
    pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-brand-600' : pct >= 25 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="w-10 text-right text-[11px] font-medium tabular-nums text-ink-700">
        {Math.round(pct)}%
      </span>
    </div>
  );
}
