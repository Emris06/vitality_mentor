import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameApi, GameHttpError } from '../../lib/api';
import { KNOWN_SKILLS, type LeaderboardEntry } from './types';

interface LeaderboardProps {
  /** Highlight the current user's row when their id is known. */
  currentUserId?: string;
}

type SkillFilter = string | 'all';

/**
 * Top-N leaderboard with a skill filter pill row. Defaults to total XP.
 * Each row: rank, name, XP, optional 🔥 for ≥500 XP.
 */
export function Leaderboard({ currentUserId }: LeaderboardProps) {
  const { t } = useTranslation();
  const [skill, setSkill] = useState<SkillFilter>('all');
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selected: SkillFilter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gameApi.leaderboard<LeaderboardEntry[]>({
        limit: 10,
        skill: selected === 'all' ? undefined : selected,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof GameHttpError) setError(err.message);
      else setError('load_failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(skill);
  }, [skill, load]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('game.leaderboard.title')}
        </h3>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
            {t('game.leaderboard.skill_filter')}
          </span>
          <SkillPill active={skill === 'all'} onClick={() => setSkill('all')}>
            {t('game.leaderboard.skill_all')}
          </SkillPill>
          {KNOWN_SKILLS.map((s) => (
            <SkillPill key={s} active={skill === s} onClick={() => setSkill(s)}>
              {s.toUpperCase()}
            </SkillPill>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
          {t('game.errors.load_leaderboard')}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-zinc-100">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-50 text-left font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
            <tr>
              <th className="w-12 px-3 py-2 text-center font-semibold">
                {t('game.leaderboard.headers.rank')}
              </th>
              <th className="px-3 py-2 font-semibold">{t('game.leaderboard.headers.name')}</th>
              <th className="px-3 py-2 text-right font-semibold">
                {t('game.leaderboard.headers.xp')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSelf = currentUserId && row.userId === currentUserId;
              return (
                <tr
                  key={row.userId}
                  className={
                    'border-t border-zinc-100 ' +
                    (isSelf ? 'bg-mentora-50/60' : idx % 2 === 1 ? 'bg-cream-50' : '')
                  }
                >
                  <td className="px-3 py-2 text-center font-mono-tech tabular-nums">
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        isSelf
                          ? 'font-bold text-mentora-700'
                          : 'font-semibold text-[var(--ink-warm)]'
                      }
                    >
                      {row.fullName}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-tech tabular-nums">
                    <span className="font-bold text-[var(--ink-warm)]">
                      {row.xp.toLocaleString()}
                    </span>
                    {row.xp >= 500 && (
                      <span className="ml-1" aria-label="hot">
                        🔥
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-6 text-center text-sm text-[var(--muted-warm)]"
                >
                  {t('game.leaderboard.empty')}
                </td>
              </tr>
            )}
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-zinc-400">
                  …
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span aria-label="rank 1">🥇</span>;
  if (rank === 2) return <span aria-label="rank 2">🥈</span>;
  if (rank === 3) return <span aria-label="rank 3">🥉</span>;
  return <span className="text-[var(--ink-warm-2)]">{rank}</span>;
}

interface SkillPillProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function SkillPill({ active, onClick, children }: SkillPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-3 py-1 text-[11px] font-bold transition-colors ' +
        (active
          ? 'bg-mentora-600 text-white shadow-sm'
          : 'bg-white text-[var(--ink-warm-2)] ring-1 ring-zinc-200 hover:bg-mentora-50 hover:text-mentora-700')
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
