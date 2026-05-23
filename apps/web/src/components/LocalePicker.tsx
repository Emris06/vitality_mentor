import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type Locale } from '@vitality/shared';

/**
 * Reference-tokens segmented locale picker.
 * Active locale: cobalt-filled chip; inactive: muted text on transparent.
 * Container: surface-2 pill with --line border.
 */
export function LocalePicker() {
  const { t, i18n } = useTranslation();
  const active = (i18n.resolvedLanguage as Locale) ?? 'ru';

  return (
    <div
      role="group"
      aria-label={t('locale.label')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '3px',
        borderRadius: '999px',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
      }}
    >
      {SUPPORTED_LOCALES.map((lng) => {
        const isActive = active === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => void i18n.changeLanguage(lng)}
            aria-pressed={isActive}
            style={{
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              border: 0,
              cursor: 'pointer',
              background: isActive ? 'var(--cobalt)' : 'transparent',
              color: isActive ? '#FFFFFF' : 'var(--mute)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'background 0.12s, color 0.12s',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
}
