import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { KNOWN_BADGES, type Badge } from './types';

interface BadgeWallProps {
  badges: Badge[];
}

interface ResolvedBadge {
  id: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

/**
 * 5-tile badge wall (2-up mobile, 4-up md+). Each known badge renders once,
 * regardless of whether the backend included it in `badges` — locked tiles
 * are greyscaled with a 🔒 corner. Clicking a tile pops an inline modal with
 * description + earnedAt (or "Locked").
 */
export function BadgeWall({ badges }: BadgeWallProps) {
  const { t, i18n } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);

  const tiles = useMemo<ResolvedBadge[]>(() => {
    const earnedById = new Map(badges.map((b) => [b.id, b]));
    return KNOWN_BADGES.map((meta) => {
      const earned = earnedById.get(meta.id);
      return {
        id: meta.id,
        icon: earned?.icon ?? meta.icon,
        earned: Boolean(earned),
        earnedAt: earned?.earnedAt,
      };
    });
  }, [badges]);

  const open = openId ? tiles.find((t) => t.id === openId) ?? null : null;

  // Name/description fall back to the badge id when an i18n key is missing
  // so a brand-new badge ships with at least a readable label.
  const labelFor = (id: string, suffix: 'name' | 'description'): string => {
    const key = `game.badges.${id}.${suffix}`;
    const value = t(key);
    return value === key ? id.replace(/_/g, ' ') : value;
  };

  return (
    <>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
        {t('game.badges.title')}
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((tile, idx) => (
          <motion.button
            key={tile.id}
            type="button"
            onClick={() => setOpenId(tile.id)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.04 * idx }}
            className={
              'group relative flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all ' +
              (tile.earned
                ? 'bg-gradient-to-b from-mentora-50 to-white ring-1 ring-mentora-200 shadow-card-warm-sm hover:-translate-y-0.5'
                : 'bg-zinc-50 opacity-60 ring-1 ring-zinc-100 grayscale hover:opacity-80')
            }
            aria-label={labelFor(tile.id, 'name')}
            title={
              tile.earned
                ? labelFor(tile.id, 'name')
                : `${labelFor(tile.id, 'name')} · ${t('game.badges.locked')}`
            }
          >
            <span
              className={
                'text-4xl leading-none transition-transform ' +
                (tile.earned ? 'group-hover:scale-110' : '')
              }
              aria-hidden="true"
            >
              {tile.icon}
            </span>
            <span className="line-clamp-2 text-[11px] font-bold text-[var(--ink-warm)]">
              {labelFor(tile.id, 'name')}
            </span>
            {!tile.earned && (
              <span
                className="absolute right-1.5 top-1.5 text-[11px]"
                aria-hidden="true"
              >
                🔒
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenId(null)}
          >
            <motion.div
              key="modal"
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-card-warm"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start gap-4">
                <span
                  className={'text-5xl leading-none ' + (open.earned ? '' : 'opacity-60 grayscale')}
                  aria-hidden="true"
                >
                  {open.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-extrabold text-[var(--ink-warm)]">
                    {labelFor(open.id, 'name')}
                  </h4>
                  <p className="mt-1 text-sm text-[var(--ink-warm-2)]">
                    {labelFor(open.id, 'description')}
                  </p>
                  <p className="mt-3 font-mono-tech text-xs text-[var(--muted-warm)]">
                    {open.earned && open.earnedAt
                      ? t('game.badges.earned_on', { date: formatDate(open.earnedAt, i18n.resolvedLanguage) })
                      : t('game.badges.locked')}
                  </p>
                </div>
              </div>
              <div className="mt-5 text-right">
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                >
                  ×
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function formatDate(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale ?? 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
