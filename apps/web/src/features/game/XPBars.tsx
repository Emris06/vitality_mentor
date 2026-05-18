import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { XpBySkill } from './types';

interface XPBarsProps {
  xpBySkill: XpBySkill;
}

/**
 * Pure horizontal bar chart of XP per skill, sorted descending. Bars animate
 * from width:0 to their percentage on mount. The implicit ceiling is the max
 * of (highest skill, 100) so the leading bar is always full and short bars
 * still feel meaningful early in onboarding.
 */
export function XPBars({ xpBySkill }: XPBarsProps) {
  const { t } = useTranslation();

  const rows = useMemo(() => {
    const entries = Object.entries(xpBySkill).filter(([, v]) => Number.isFinite(v));
    entries.sort((a, b) => b[1] - a[1]);
    const ceiling = Math.max(...entries.map(([, v]) => v), 100);
    return entries.map(([skill, xp]) => ({
      skill,
      xp,
      pct: Math.max(0, Math.min(100, (xp / ceiling) * 100)),
    }));
  }, [xpBySkill]);

  if (rows.length === 0) {
    return (
      <>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('game.xp_bars.title')}
        </h3>
        <p className="mt-3 text-sm text-[var(--muted-warm)]">{t('game.xp_bars.empty')}</p>
      </>
    );
  }

  return (
    <>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
        {t('game.xp_bars.title')}
      </h3>
      <ul className="mt-4 space-y-3">
        {rows.map((row, idx) => (
          <li key={row.skill}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono-tech font-bold uppercase tracking-wider text-[var(--ink-warm-2)]">
                {row.skill}
              </span>
              <span className="font-mono-tech tabular-nums text-[var(--muted-warm)]">
                {row.xp.toLocaleString()} XP
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-mentora-600 to-mentora-400"
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.7, delay: 0.05 * idx, ease: 'easeOut' }}
                aria-label={`${row.skill} ${row.xp} XP`}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
