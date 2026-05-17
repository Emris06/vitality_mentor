import type { ReactNode } from 'react';

interface Props {
  /** When true, uses the smaller (20px radius + lighter shadow) variant.
   *  Default false → 24px radius + full 3-layer shadow. */
  small?: boolean;
  className?: string;
  children: ReactNode;
}

export function WarmCard({ small = false, className = '', children }: Props) {
  const base = small
    ? 'rounded-[20px] shadow-card-warm-sm'
    : 'rounded-3xl shadow-card-warm';
  return <div className={`bg-white ${base} ${className}`.trim()}>{children}</div>;
}
