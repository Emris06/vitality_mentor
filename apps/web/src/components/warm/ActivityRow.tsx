import type { ReactNode } from 'react';

interface Props {
  /** The full leading element — usually a styled avatar block. Consumers
   *  control its tone (e.g. `<span className="av-sky grid h-9 w-9 ...">OH</span>`)
   *  so different avatar treatments (initials, gradient asterisk for Clicky,
   *  HR/mentor person, etc.) can coexist without an enum here. */
  leading: ReactNode;
  /** The activity sentence — typically a `<p>` with bold actor + plain verb +
   *  bold/colored object. Layout is up to the consumer. */
  children: ReactNode;
  /** Relative or absolute time string. Already localized by the consumer. */
  timestamp: string;
}

export function ActivityRow({ leading, children, timestamp }: Props) {
  return (
    <li className="flex items-start gap-3">
      <div className="shrink-0">{leading}</div>
      <div className="min-w-0 flex-1 text-sm">
        {children}
        <p className="mt-1 text-[11px] text-[var(--muted-warm)]">{timestamp}</p>
      </div>
    </li>
  );
}
