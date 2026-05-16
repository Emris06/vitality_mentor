import type { ReactNode } from 'react';

export type StatusTone = 'success' | 'warn' | 'danger' | 'neutral' | 'info' | 'brand';

interface StatusPillProps {
  tone?: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success-50 text-success-700', dot: 'bg-success-500' },
  warn: { pill: 'bg-warn-50 text-warn-700', dot: 'bg-warn-500' },
  danger: { pill: 'bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
  neutral: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
  info: { pill: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  brand: { pill: 'bg-brand-600 text-white', dot: 'bg-white' },
};

export function StatusPill({ tone = 'neutral', children, dot, className }: StatusPillProps) {
  const { pill, dot: dotClass } = TONES[tone];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        pill,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && <span className={['inline-block h-1.5 w-1.5 rounded-full', dotClass].join(' ')} />}
      {children}
    </span>
  );
}
