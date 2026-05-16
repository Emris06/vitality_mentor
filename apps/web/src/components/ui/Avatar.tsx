type Size = 'xs' | 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: Size;
  className?: string;
}

const SIZE_MAP: Record<Size, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
}

// Deterministic hue from name so an avatar's color is stable per user.
function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const cls = [
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white',
    SIZE_MAP[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (src) {
    return <img src={src} alt={name} className={[cls, 'object-cover'].join(' ')} />;
  }

  const hue = hueFromName(name);
  return (
    <span
      className={cls}
      style={{
        backgroundColor: `hsl(${hue}, 70%, 92%)`,
        color: `hsl(${hue}, 50%, 32%)`,
      }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
