import { useMemo } from 'react';
import type { SkillLevel } from '@vitality/shared';
import type { SkillNodeFull } from '../../lib/api';
import { nodeTarget } from './skillsTheme';

/**
 * Tiny SVG radar used in list rows. 7 axes max, sorted by `targetXp` descending
 * so the most-valuable skills always anchor the polygon. Missing skills draw
 * to 0 — that's intentional, the empty wedge visually flags the gap.
 *
 * We render pure SVG (no recharts) because recharts is too heavy for a 60×60
 * widget repeated dozens of times in a virtualized list.
 */
interface SkillsRadarMiniProps {
  size?: number;
  /** Up to 7 nodes are used; rest are ignored. */
  nodes: SkillNodeFull[];
  /** Current XP by skill id (sparse — missing → 0). */
  levels: SkillLevel[];
  /** Tailwind classes to override the fill/stroke. */
  className?: string;
}

export function SkillsRadarMini({
  size = 60,
  nodes,
  levels,
  className,
}: SkillsRadarMiniProps) {
  const points = useMemo(() => {
    const top = [...nodes]
      .sort((a, b) => nodeTarget(b) - nodeTarget(a))
      .slice(0, 7);
    const xpById = new Map(levels.map((l) => [l.skillId, l.xp]));
    const n = top.length || 7;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;
    return Array.from({ length: n }, (_, i) => {
      const node = top[i];
      const xp = node ? xpById.get(node.id) ?? 0 : 0;
      const target = node ? nodeTarget(node) : 1;
      const ratio = Math.max(0, Math.min(1, target > 0 ? xp / target : 0));
      // Start at -90deg so the first axis points up.
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + Math.cos(angle) * r * ratio;
      const y = cy + Math.sin(angle) * r * ratio;
      const ringX = cx + Math.cos(angle) * r;
      const ringY = cy + Math.sin(angle) * r;
      return { x, y, ringX, ringY };
    });
  }, [nodes, levels, size]);

  const polyPath = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const ringPath = points.map((p) => `${p.ringX.toFixed(1)},${p.ringY.toFixed(1)}`).join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <polygon points={ringPath} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" />
      <polygon
        points={polyPath}
        fill="rgba(29, 78, 216, 0.35)"
        stroke="#1d4ed8"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
