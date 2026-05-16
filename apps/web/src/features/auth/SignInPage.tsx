import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { homeRouteFor, roleFromUser } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-300 focus:bg-white focus:outline-none focus-visible:shadow-focus';

type Mode = 'password' | 'magic';
type FieldKey = 'email' | 'password';
type FieldErrors = Partial<Record<FieldKey, string>>;

interface LocationState {
  from?: string;
}

export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInMagicLink } = useAuth();
  const configured = isSupabaseConfigured();

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState<string | null>(null);

  function resolveLandingPath(role: ReturnType<typeof roleFromUser>): string {
    const state = (location.state ?? null) as LocationState | null;
    const from = state?.from;
    if (from && from !== '/signin' && from !== '/signup') return from;
    return homeRouteFor(role);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!email.trim()) nextErrors.email = 'auth.error_required';
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = 'auth.error_invalid_email';
    if (mode === 'password' && !password) nextErrors.password = 'auth.error_required';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    if (mode === 'password') {
      const result = await signIn(email.trim(), password);
      if (result.error) {
        setFormError(result.error);
        setSubmitting(false);
        return;
      }
      const supabase = getSupabase();
      const { data } = await (supabase?.auth.getSession() ?? Promise.resolve({ data: { session: null } }));
      const role = roleFromUser(data.session?.user);
      navigate(resolveLandingPath(role), { replace: true });
      return;
    }

    const result = await signInMagicLink(email.trim());
    if (result.error) {
      setFormError(result.error);
      setSubmitting(false);
      return;
    }
    setMagicSent(email.trim());
    setSubmitting(false);
  }

  if (!configured) {
    return (
      <AuthLayout>
        <Header />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-card">
          <EmptyState
            title={t('auth.signin_title')}
            description={t('auth.error_supabase_not_configured')}
          />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Header />

      {magicSent ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-card">
          <EmptyState
            title={t('auth.signin_title')}
            description={t('auth.signin_magic_link_sent', { email: magicSent })}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setMagicSent(null);
                  setMode('password');
                }}
              >
                {t('auth.signin_password_toggle')}
              </Button>
            }
          />
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="mt-8 space-y-6">
          <Fieldset
            label={t('auth.field_email')}
            htmlFor="email"
            error={errors.email ? t(errors.email) : undefined}
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
              disabled={submitting}
            />
          </Fieldset>

          {mode === 'password' && (
            <Fieldset
              label={t('auth.field_password')}
              htmlFor="password"
              error={errors.password ? t(errors.password) : undefined}
            >
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_CLASS}
                disabled={submitting}
              />
              <div className="pt-1">
                <span className="cursor-not-allowed text-xs text-slate-400">
                  {t('auth.signin_forgot')}
                </span>
              </div>
            </Fieldset>
          )}

          {formError && (
            <StatusPill tone="danger" dot className="w-full justify-center px-3 py-2">
              {t(formError)}
            </StatusPill>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            className="w-full"
          >
            {mode === 'password'
              ? submitting
                ? t('auth.signin_submitting')
                : t('auth.signin_submit')
              : submitting
                ? t('auth.signin_submitting')
                : t('auth.signin_magic_link_submit')}
          </Button>

          <div className="flex flex-col items-start gap-2 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'password' ? 'magic' : 'password');
                setErrors({});
                setFormError(null);
              }}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              {mode === 'password'
                ? t('auth.signin_magic_link_toggle')
                : t('auth.signin_password_toggle')}
            </button>
            <span>
              {t('auth.signin_no_account')}{' '}
              <Link
                to="/signup"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                {t('auth.signin_signup_link')}
              </Link>
            </span>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
        {t('auth.signin_title')}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{t('auth.signin_subtitle')}</p>
    </div>
  );
}

interface FieldsetProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}

function Fieldset({ label, htmlFor, error, children }: FieldsetProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-danger-600">{error}</p>}
    </div>
  );
}
