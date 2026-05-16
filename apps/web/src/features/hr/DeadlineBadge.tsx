import { useTranslation } from 'react-i18next';

interface DeadlineBadgeProps {
  /** ISO date string for the onboarding deadline. */
  deadline: string;
  /** Optional class extension. */
  className?: string;
}

function diffInDays(target: Date, now: Date): number {
  // Normalize to UTC midnight for stable day arithmetic across timezones.
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((a - b) / MS_PER_DAY);
}

/**
 * Compact pill showing how many days are left before the deadline. Uses
 * i18next plural keys so Russian and Uzbek render correctly. Color shifts
 * from emerald → amber → rose as the deadline approaches and passes.
 */
export function DeadlineBadge({ deadline, className }: DeadlineBadgeProps) {
  const { t } = useTranslation();
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return (
      <span className={`rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500 ${className ?? ''}`}>
        —
      </span>
    );
  }

  const days = diffInDays(parsed, new Date());

  if (days === 0) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ${className ?? ''}`}
      >
        {t('hr.deadline.due_today')}
      </span>
    );
  }

  if (days < 0) {
    const overdue = Math.abs(days);
    return (
      <span
        className={`inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800 ${className ?? ''}`}
      >
        {t('hr.deadline.overdue', { count: overdue })}
      </span>
    );
  }

  const tone =
    days <= 3
      ? 'bg-amber-100 text-amber-800'
      : days <= 7
        ? 'bg-brand-50 text-brand-700'
        : 'bg-emerald-50 text-emerald-700';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone} ${className ?? ''}`}
    >
      {t('hr.deadline.days_left', { count: days })}
    </span>
  );
}
