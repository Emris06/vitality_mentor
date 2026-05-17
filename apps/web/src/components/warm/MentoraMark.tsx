// The Mentora asterisk-burst mark, extracted from reference/logo_name.jpg.
// 8 strokes radiating from a central gap at 0/45/90/...°. Sized by the
// enclosing class — `h-7 w-7` for nav, `h-5 w-5` for inline use.

interface Props {
  className?: string;
}

export function MentoraMark({ className = 'h-7 w-7 text-white' }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <line x1="16" y1="3" x2="16" y2="10" />
        <line x1="16" y1="22" x2="16" y2="29" />
        <line x1="3" y1="16" x2="10" y2="16" />
        <line x1="22" y1="16" x2="29" y2="16" />
        <line x1="6.5" y1="6.5" x2="11" y2="11" />
        <line x1="21" y1="21" x2="25.5" y2="25.5" />
        <line x1="6.5" y1="25.5" x2="11" y2="21" />
        <line x1="21" y1="11" x2="25.5" y2="6.5" />
      </g>
    </svg>
  );
}
