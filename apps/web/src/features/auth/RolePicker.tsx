import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserRole } from './types';

interface RolePickerProps {
  value: UserRole | null;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  className?: string;
}

type PickableRole = Extract<UserRole, 'hr' | 'employee' | 'intern'>;

interface RoleSpec {
  role: PickableRole;
  /** Inline style tint used on the icon chip — kept regardless of active state. */
  iconTint: CSSProperties;
  /** SVG icon rendered inside the chip. */
  icon: ReactNode;
}

const ROLE_SPECS: RoleSpec[] = [
  {
    role: 'hr',
    iconTint: { backgroundColor: 'rgba(45, 107, 254, 0.10)', color: '#1F4FB8' },
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M16.5 10.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M2.5 19c.4-3.2 3.2-5.5 6.5-5.5s6.1 2.3 6.5 5.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M14.5 19c.3-2.4 2.5-4.1 5-4.1 1.4 0 2.7.5 3.6 1.3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    role: 'employee',
    iconTint: { backgroundColor: 'rgba(124, 58, 237, 0.12)', color: '#5B21B6' },
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="3"
          y="7"
          width="18"
          height="13"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M3 12.5c2.6 1.3 5.7 2 9 2s6.4-.7 9-2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    role: 'intern',
    iconTint: { backgroundColor: 'rgba(20, 184, 166, 0.14)', color: '#0F766E' },
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4 2.5 9 12 14l9.5-5L12 4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M6 11v4.5c0 1.7 2.7 3 6 3s6-1.3 6-3V11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M21.5 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * Three-card role selector used on the sign-up page. Keyboard-accessible
 * (Tab to focus, Space/Enter to select) with explicit `aria-pressed` semantics.
 *
 * The cards keep neutral white backgrounds with an inline-tinted icon chip per
 * role so the picker reads as a single segmented group rather than three
 * mismatched buttons. The active card gets the brand ring + faint brand fill.
 */
export function RolePicker({ value, onChange, disabled, className }: RolePickerProps) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('auth.signup_role_label')}
      className={['grid gap-3 md:grid-cols-3', className].filter(Boolean).join(' ')}
    >
      {ROLE_SPECS.map(({ role, iconTint, icon }) => {
        const isActive = value === role;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={[
              'group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
              'focus-visible:shadow-focus focus-visible:outline-none',
              isActive
                ? 'border-brand-300 bg-brand-50/50 ring-2 ring-brand-500 ring-offset-1 ring-offset-white'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            ].join(' ')}
          >
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
              style={iconTint}
            >
              {icon}
            </span>
            <span className="font-display text-sm font-semibold text-slate-900">
              {t(`auth.role_${role}_name`)}
            </span>
            <span className="text-xs leading-snug text-slate-500">
              {t(`auth.role_${role}_desc`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
