/**
 * Shared visual constants for the Skills feature: gap severity → color mapping,
 * matrix bucket boundaries, and a small helper to resolve a skill's display
 * name (i18n key first, then the taxonomy `nameKey`, then the id as a last
 * resort). Centralising this keeps all the charts/cards/legends in sync.
 */
import type { TFunction } from 'i18next';
import type { SkillNodeFull } from '../../lib/api';

/** Default ceiling used to normalize XP when the taxonomy node omits one. */
export const DEFAULT_TARGET_XP = 1000;

export type GapBucket = 'met' | 'low' | 'medium' | 'high';

/** Bucket a single (xp, target) pair. The thresholds match the visual legend. */
export function bucketForRatio(xp: number, target: number): GapBucket {
  if (target <= 0) return 'met';
  const ratio = xp / target;
  if (ratio >= 1) return 'met';
  if (ratio >= 0.7) return 'low';
  if (ratio >= 0.4) return 'medium';
  return 'high';
}

/** Tailwind color classes for each gap bucket, used by the heatmap & chips. */
export const BUCKET_BG: Record<GapBucket, string> = {
  met: 'bg-emerald-500',
  low: 'bg-lime-400',
  medium: 'bg-amber-400',
  high: 'bg-rose-500',
};

export const BUCKET_BG_SOFT: Record<GapBucket, string> = {
  met: 'bg-emerald-100',
  low: 'bg-lime-100',
  medium: 'bg-amber-100',
  high: 'bg-rose-100',
};

export const BUCKET_TEXT: Record<GapBucket, string> = {
  met: 'text-emerald-800',
  low: 'text-lime-800',
  medium: 'text-amber-800',
  high: 'text-rose-800',
};

/** Map severity (from the API SkillGap) to the same bucket the heatmap uses. */
export function severityToBucket(s: 'low' | 'medium' | 'high'): GapBucket {
  return s;
}

/**
 * Resolve a friendly display name for a skill id. Order of preference:
 *   1. `skills.names.<id>` from the i18n catalogue
 *   2. the taxonomy `nameKey` (also tried as an i18n key)
 *   3. the bare id, capitalized
 */
export function resolveSkillName(
  t: TFunction,
  skillId: string,
  node: SkillNodeFull | undefined,
): string {
  const localKey = `skills.names.${skillId}`;
  const local = t(localKey);
  if (local !== localKey) return local;
  if (node?.nameKey) {
    const fromNode = t(node.nameKey);
    if (fromNode !== node.nameKey) return fromNode;
    return node.nameKey;
  }
  if (skillId.length === 0) return skillId;
  return skillId.charAt(0).toUpperCase() + skillId.slice(1).replace(/_/g, ' ');
}

/** Pluck the targetXp from a taxonomy node, with a sane fallback. */
export function nodeTarget(node: SkillNodeFull | undefined): number {
  return node?.targetXp ?? DEFAULT_TARGET_XP;
}

/** Compute initials for an employee or string name (max 2 chars). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  const a = first.charAt(0);
  const b = last.charAt(0);
  return (a + b).toUpperCase();
}

/** Stable color for an avatar from a string id. Deterministic, no randomness. */
export function avatarHue(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const palettes = [
    'from-brand-500 to-brand-700',
    'from-indigo-500 to-indigo-700',
    'from-emerald-500 to-emerald-700',
    'from-amber-500 to-amber-700',
    'from-rose-500 to-rose-700',
    'from-cyan-500 to-cyan-700',
  ] as const;
  return palettes[Math.abs(hash) % palettes.length] ?? palettes[0];
}
