export type AvatarTone = 'amber' | 'rose' | 'sky' | 'em' | 'viol' | 'orng';

interface Props {
  initials: string;
  name: string;
  /** Numeric level shown as "Lv N" under the name. */
  level: number;
  /** Maps to one of the `.av-*` color-block classes from index.css. */
  tone: AvatarTone;
}

const AV_CLASS: Record<AvatarTone, string> = {
  amber: 'av-amber',
  rose: 'av-rose',
  sky: 'av-sky',
  em: 'av-em',
  viol: 'av-viol',
  orng: 'av-orng',
};

export function CohortTile({ initials, name, level, tone }: Props) {
  return (
    <div className="rounded-2xl bg-cream-50 p-3 text-center ring-1 ring-zinc-100">
      <span
        className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${AV_CLASS[tone]}`}
      >
        {initials}
      </span>
      <div className="mt-2 text-[12px] font-bold text-[var(--ink-warm)]">{name}</div>
      <div className="text-[11px] text-[var(--muted-warm)]">Lv {level}</div>
    </div>
  );
}
