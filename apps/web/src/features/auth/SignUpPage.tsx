import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Locale, SUPPORTED_LOCALES } from '@vitality/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import { homeRouteFor, isUserRole, type UserRole } from './types';
import { AuthLayout } from './AuthLayout';
import { RolePicker } from './RolePicker';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-300 focus:bg-white focus:outline-none focus-visible:shadow-focus';

type FieldKey = 'fullName' | 'email' | 'password' | 'role';
type FieldErrors = Partial<Record<FieldKey, string>>;

function mapSupabaseError(message: string | undefined): string {
  if (!message) return 'auth.error_generic';
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('user already')) {
    return 'auth.error_email_taken';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'auth.error_invalid_credentials';
  }
  if (message === 'supabase_not_configured') return 'auth.error_supabase_not_configured';
  return 'auth.error_generic';
}

export function SignUpPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();
  const configured = isSupabaseConfigured();

  const initialRole = useMemo<UserRole | null>(() => {
    const candidate = searchParams.get('role');
    return candidate && isUserRole(candidate) && candidate !== 'admin' ? candidate : null;
  }, [searchParams]);

  const initialLanguage: Locale = useMemo(() => {
    const resolved = (i18n.resolvedLanguage ?? 'en') as Locale;
    return (SUPPORTED_LOCALES as readonly string[]).includes(resolved) ? resolved : 'en';
  }, [i18n.resolvedLanguage]);

  const [role, setRole] = useState<UserRole | null>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<Locale>(initialLanguage);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.fullName = 'auth.error_required';
    if (!email.trim()) next.email = 'auth.error_required';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'auth.error_invalid_email';
    if (!password) next.password = 'auth.error_required';
    else if (password.length < 8 || !/\d/.test(password)) {
      next.password = 'auth.error_weak_password';
    }
    if (!role) next.role = 'auth.error_required';
    return next;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0 || !role) return;

    setSubmitting(true);
    const result = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
      language,
    });
    if (result.error) {
      setFormError(mapSupabaseError(result.error));
      setSubmitting(false);
      return;
    }
    setSuccessFlash(true);
    // Short visual confirmation, then route to the role home. If the session
    // isn't immediately available (e.g., email confirmation required), the
    // landing route still works and RequireAuth will catch downstream.
    setTimeout(() => {
      navigate(homeRouteFor(role), { replace: true });
    }, 700);
  }

  if (!configured) {
    return (
      <AuthLayout>
        <Header />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-card">
          <EmptyState
            title={t('auth.signup_title')}
            description={t('auth.error_supabase_not_configured')}
          />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Header />

      <form noValidate onSubmit={onSubmit} className="mt-8 space-y-6">
        <Fieldset
          label={t('auth.signup_role_label')}
          error={errors.role ? t(errors.role) : undefined}
        >
          <RolePicker value={role} onChange={setRole} disabled={submitting} />
        </Fieldset>

        <Fieldset
          label={t('auth.field_full_name')}
          htmlFor="fullName"
          error={errors.fullName ? t(errors.fullName) : undefined}
        >
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT_CLASS}
            disabled={submitting}
          />
        </Fieldset>

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

        <Fieldset
          label={t('auth.field_password')}
          htmlFor="password"
          hint={t('auth.field_password_hint')}
          error={errors.password ? t(errors.password) : undefined}
        >
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
            disabled={submitting}
          />
        </Fieldset>

        <Fieldset label={t('auth.field_language')}>
          <div
            role="group"
            aria-label={t('auth.field_language')}
            className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5"
          >
            {SUPPORTED_LOCALES.map((code) => {
              const isActive = language === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setLanguage(code)}
                  disabled={submitting}
                  className={[
                    'rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors',
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                  ].join(' ')}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </Fieldset>

        {formError && (
          <StatusPill tone="danger" dot className="w-full justify-center px-3 py-2">
            {t(formError)}
          </StatusPill>
        )}

        {successFlash && !formError && (
          <StatusPill tone="success" dot className="w-full justify-center px-3 py-2">
            {t('auth.success_signup')}
          </StatusPill>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          {submitting ? t('auth.signup_submitting') : t('auth.signup_submit')}
        </Button>

        <p className="text-xs text-slate-500">{t('auth.signup_terms')}</p>

        <p className="text-sm text-slate-600">
          {t('auth.signup_have_account')}{' '}
          <Link to="/signin" className="font-medium text-brand-600 hover:text-brand-700">
            {t('auth.signup_signin_link')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
        {t('auth.signup_title')}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{t('auth.signup_subtitle')}</p>
    </div>
  );
}

interface FieldsetProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function Fieldset({ label, htmlFor, hint, error, children }: FieldsetProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger-600">{error}</p>}
    </div>
  );
}
