import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface IllustrationGreetingProps {
  greeting: string;
  name: string;
  note?: string;
  action?: ReactNode;
  /** Optional SVG (or any ReactNode) shown on the right; defaults to BankIllustration. */
  illustration?: ReactNode;
  className?: string;
}

export function IllustrationGreeting({
  greeting,
  name,
  note,
  action,
  illustration,
  className,
}: IllustrationGreetingProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={[
        'relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-7 shadow-card',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm text-slate-500">{greeting}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {name}
          </h2>
          {note && <p className="mt-3 max-w-md text-sm text-slate-600">{note}</p>}
          {action && <div className="mt-5">{action}</div>}
        </div>
        <div className="relative hidden md:flex md:items-center md:justify-end">
          {illustration ?? <BankIllustration />}
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Lightweight inline SVG illustration used as a default decoration in the
 * greeting card. Stylized bank columns + a checkmark — minimal, brand-tinted,
 * and free (avoids shipping a raster asset).
 */
export function BankIllustration() {
  return (
    <svg
      width="240"
      height="160"
      viewBox="0 0 240 160"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className="drop-shadow-sm"
    >
      <rect x="20" y="40" width="200" height="100" rx="10" fill="#fff" stroke="#D9E5FF" />
      <path d="M120 24l86 28H34l86-28z" fill="#2D6BFE" />
      <rect x="48" y="70" width="14" height="46" rx="2" fill="#D9E5FF" />
      <rect x="76" y="70" width="14" height="46" rx="2" fill="#D9E5FF" />
      <rect x="104" y="70" width="14" height="46" rx="2" fill="#D9E5FF" />
      <rect x="132" y="70" width="14" height="46" rx="2" fill="#D9E5FF" />
      <rect x="160" y="70" width="14" height="46" rx="2" fill="#D9E5FF" />
      <rect x="32" y="124" width="176" height="6" rx="2" fill="#2D6BFE" />
      <circle cx="194" cy="38" r="14" fill="#10B981" />
      <path d="m188 38 4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
