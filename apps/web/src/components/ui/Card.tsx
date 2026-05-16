import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'plain' | 'hoverable' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-7',
} as const;

export function Card({
  children,
  variant = 'plain',
  padding = 'md',
  className,
  ...rest
}: CardProps) {
  const base =
    'rounded-lg border border-ink-200 bg-white shadow-card transition-all duration-200 ease-out';
  const variantClass =
    variant === 'hoverable'
      ? 'hover:-translate-y-0.5 hover:shadow-card-hover hover:border-ink-300'
      : variant === 'subtle'
        ? 'border-transparent bg-ink-50/70'
        : '';
  return (
    <div
      {...rest}
      className={[base, variantClass, PADDING_MAP[padding], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <header
      className={['mb-4 flex items-start justify-between gap-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div>
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
