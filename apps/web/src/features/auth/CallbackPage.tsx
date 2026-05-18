import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import { homeRouteFor } from './types';

/**
 * Magic-link / OAuth landing route. Supabase auto-detects the session in the
 * URL hash (per `detectSessionInUrl: true`), so by the time this component
 * mounts the session is usually already populated. We still make a single
 * `getSession()` call to force the SDK to flush the hash and then hand off
 * to the role-aware home route.
 */
export function CallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ready, profile, session } = useAuth();

  useEffect(() => {
    if (!ready) return;
    const role = profile?.role ?? null;
    navigate(homeRouteFor(role), { replace: true });
  }, [ready, profile, session, navigate]);

  return (
    <main
      className="grid min-h-screen place-items-center font-jakarta text-[var(--ink-warm-2)]"
      style={{
        background:
          'radial-gradient(900px 500px at 88% -200px, rgba(32, 70, 255, 0.10), transparent 60%), ' +
          'radial-gradient(700px 400px at -10% 280px, rgba(255, 107, 74, 0.08), transparent 60%), ' +
          '#fbfaf7',
      }}
    >
      <div className="flex flex-col items-center gap-3 text-sm">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-mentora-500 border-r-transparent"
        />
        <span>{t('auth.signin_submitting')}</span>
      </div>
    </main>
  );
}
