import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSupabase } from '../../lib/supabase';
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
  const { profile } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    const go = async () => {
      if (supabase) {
        await supabase.auth.getSession();
      }
      if (cancelled) return;
      const target = profile?.role ? homeRouteFor(profile.role) : '/';
      navigate(target, { replace: true });
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, [navigate, profile]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-r-transparent"
        />
        <span>{t('auth.signin_submitting')}</span>
      </div>
    </main>
  );
}
