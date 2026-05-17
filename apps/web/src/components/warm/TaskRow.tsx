export type XpTone = 'mentora' | 'amber' | 'emerald';

interface Props {
  title: string;
  subline: string;
  xpAmount: number;
  xpTone?: XpTone;
  done?: boolean;
  onToggle?: () => void;
}

const XP_CLASS: Record<XpTone, string> = {
  mentora: 'bg-mentora-50 text-mentora-600',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
};

export function TaskRow({
  title,
  subline,
  xpAmount,
  xpTone = 'mentora',
  done = false,
  onToggle,
}: Props) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-cream-50 px-3 py-2.5 ring-1 ring-zinc-100">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={done}
        className={`mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-md text-[9px] font-bold transition ${
          done
            ? 'bg-emerald-500 text-white ring-2 ring-emerald-500'
            : 'ring-2 ring-zinc-300 hover:ring-zinc-400'
        }`}
      >
        {done && '✓'}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-bold ${
            done
              ? 'text-[var(--muted-warm)] line-through'
              : 'text-[var(--ink-warm)]'
          }`}
        >
          {title}
        </div>
        <div className="text-xs text-[var(--muted-warm)]">{subline}</div>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${XP_CLASS[xpTone]}`}
      >
        +{xpAmount} XP
      </span>
    </li>
  );
}
