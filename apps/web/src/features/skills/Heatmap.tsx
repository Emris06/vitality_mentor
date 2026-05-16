import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { Employee } from '@vitality/shared';
import type { SkillNodeFull, TeamGapMatrixCell } from '../../lib/api';
import {
  BUCKET_BG,
  bucketForRatio,
  initialsOf,
  nodeTarget,
  resolveSkillName,
} from './skillsTheme';

/**
 * Sticky-header, sticky-first-column heatmap. Rows = employees, columns =
 * skills. Cells are colored by the gap bucket. A click on a cell pins a small
 * tooltip near the bottom; click again (or any other cell) to swap.
 *
 * Deliberately plain `grid` + Tailwind: no chart lib, fast even with hundreds
 * of cells.
 */
interface HeatmapProps {
  employees: Employee[];
  skills: SkillNodeFull[];
  cells: TeamGapMatrixCell[];
}

interface HoveredCell {
  employeeId: string;
  skillId: string;
  xp: number;
  target: number;
}

export function Heatmap({ employees, skills, cells }: HeatmapProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<HoveredCell | null>(null);

  const lookup = useMemo(() => {
    const m = new Map<string, TeamGapMatrixCell>();
    for (const c of cells) m.set(`${c.employeeId}|${c.skillId}`, c);
    return m;
  }, [cells]);

  const skillById = useMemo(() => {
    const m = new Map<string, SkillNodeFull>();
    for (const s of skills) m.set(s.id, s);
    return m;
  }, [skills]);

  const employeeById = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  if (employees.length === 0 || skills.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white px-4 py-12 text-center text-sm text-ink-500">
        {t('skills.matrix.empty')}
      </div>
    );
  }

  // Each column is 96px on md+, 72px on mobile. First column is sticky.
  const colWidthClass = 'w-[96px] md:w-[104px]';
  const firstColClass = 'sticky left-0 z-20 w-[180px] md:w-[220px] bg-white';

  return (
    <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="border-b border-ink-200 px-4 py-2 text-[11px] text-ink-500 md:hidden">
        {t('skills.matrix.hint')}
      </div>
      <div className="relative max-h-[70vh] overflow-auto">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={`${firstColClass} sticky top-0 z-30 border-b border-ink-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500`}>
                &nbsp;
              </th>
              {skills.map((s) => (
                <th
                  key={s.id}
                  className={`${colWidthClass} sticky top-0 z-10 border-b border-ink-200 bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500`}
                  title={resolveSkillName(t, s.id, s)}
                >
                  <div className="truncate">{resolveSkillName(t, s.id, s)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e, rowIdx) => (
              <tr key={e.id} className="group">
                <th className={`${firstColClass} border-b border-ink-100 px-3 py-2 text-left`}>
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white">
                      {initialsOf(e.fullName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink-900">{e.fullName}</p>
                      {e.position && (
                        <p className="truncate text-[10px] text-ink-500">{e.position}</p>
                      )}
                    </div>
                  </div>
                </th>
                {skills.map((s, colIdx) => {
                  const cell = lookup.get(`${e.id}|${s.id}`);
                  const target = cell?.target ?? nodeTarget(s);
                  const xp = cell?.xp ?? 0;
                  const bucket = bucketForRatio(xp, target);
                  const isHovered =
                    hover && hover.employeeId === e.id && hover.skillId === s.id;
                  return (
                    <td
                      key={s.id}
                      className={`${colWidthClass} border-b border-ink-100 p-1.5`}
                      onMouseEnter={() =>
                        setHover({ employeeId: e.id, skillId: s.id, xp, target })
                      }
                      onMouseLeave={() => setHover(null)}
                      onClick={() =>
                        setHover((h) =>
                          h && h.employeeId === e.id && h.skillId === s.id
                            ? null
                            : { employeeId: e.id, skillId: s.id, xp, target },
                        )
                      }
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.18,
                          delay: Math.min(0.4, 0.005 * (rowIdx * skills.length + colIdx)),
                        }}
                        className={`h-7 w-full cursor-pointer rounded-md ${BUCKET_BG[bucket]} ${
                          isHovered ? 'ring-2 ring-ink-900/30' : ''
                        }`}
                        title={t('skills.matrix.tooltip.xp', { xp, target })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-200 px-4 py-3 text-[11px] text-ink-600">
        <LegendDot color="bg-emerald-500" label={t('skills.matrix.legend.met')} />
        <LegendDot color="bg-lime-400" label={t('skills.matrix.legend.low_gap')} />
        <LegendDot color="bg-amber-400" label={t('skills.matrix.legend.medium_gap')} />
        <LegendDot color="bg-rose-500" label={t('skills.matrix.legend.high_gap')} />
        {hover && (
          <span className="ml-auto rounded-full bg-ink-900 px-3 py-1 text-[11px] text-white">
            {employeeById.get(hover.employeeId)?.fullName ?? hover.employeeId}
            {' · '}
            {resolveSkillName(t, hover.skillId, skillById.get(hover.skillId))}
            {' · '}
            {t('skills.matrix.tooltip.xp', { xp: hover.xp, target: hover.target })}
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
