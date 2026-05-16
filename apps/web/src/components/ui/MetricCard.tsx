import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: { value: number; period?: string } | null;
  hint?: string;
  accentColor?: string;
}

function formatDelta(d: number): string {
  const arrow = d > 0 ? '↗' : d < 0 ? '↘' : '→';
  const sign = d > 0 ? '+' : '';
  return `${arrow} ${sign}${d.toFixed(1)}%`;
}

export function MetricCard({
  label,
  value,
  icon,
  delta,
  hint,
  accentColor = 'rgba(45, 107, 254, 0.1)',
}: MetricCardProps) {
  const deltaTone =
    delta == null
      ? null
      : delta.value > 0
        ? 'bg-success-50 text-success-700'
        : delta.value < 0
          ? 'bg-danger-50 text-danger-700'
          : 'bg-slate-100 text-slate-600';

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-600"
              style={{ backgroundColor: accentColor }}
            >
              {icon}
            </span>
          )}
          <span className="text-sm font-medium text-slate-500">{label}</span>
        </div>
        {delta && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${deltaTone}`}>
            {formatDelta(delta.value)}
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tightest tabular text-slate-900">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </motion.article>
  );
}
