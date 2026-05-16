import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type Locale } from '@vitality/shared';

/**
 * Clean SaaS-style locale picker: a small segmented control of three letters.
 * Active locale gets the brand-blue filled chip; others are quiet text.
 */
export function LocalePicker() {
  const { t, i18n } = useTranslation();
  const active = (i18n.resolvedLanguage as Locale) ?? 'ru';

  return (
    <div
      role="group"
      aria-label={t('locale.label')}
      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-card"
    >
      {SUPPORTED_LOCALES.map((lng) => {
        const isActive = active === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => void i18n.changeLanguage(lng)}
            aria-pressed={isActive}
            className={[
              'rounded-md px-2.5 py-1 text-xs font-medium uppercase tracking-wide transition-colors',
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
            ].join(' ')}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
}
