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
      className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-900">{t('game.leaderboard.title')}</h3>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-ink-500">
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
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {t('game.errors.load_leaderboard')}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-ink-200">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wide text-ink-500">
            <tr>
              <th className="w-12 px-3 py-2 text-center">{t('game.leaderboard.headers.rank')}</th>
              <th className="px-3 py-2">{t('game.leaderboard.headers.name')}</th>
              <th className="px-3 py-2 text-right">{t('game.leaderboard.headers.xp')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSelf = currentUserId && row.userId === currentUserId;
              return (
                <tr
                  key={row.userId}
                  className={
                    'border-t border-ink-100 ' +
                    (isSelf ? 'bg-brand-50/60' : idx % 2 === 1 ? 'bg-ink-50/40' : '')
                  }
                >
                  <td className="px-3 py-2 text-center tabular-nums">
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={isSelf ? 'font-semibold text-brand-700' : 'text-ink-900'}>
                      {row.fullName}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="font-medium text-ink-900">{row.xp.toLocaleString()}</span>
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
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-ink-500">
                  {t('game.leaderboard.empty')}
                </td>
              </tr>
            )}
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-ink-400">
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
  return <span className="text-ink-600">{rank}</span>;
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
        'rounded-full px-3 py-1 text-[11px] font-medium transition-colors ' +
        (active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
