import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Locale, SUPPORTED_LOCALES } from '@vitality/shared';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import { homeRouteFor, isUserRole, type UserRole } from './types';
import { AuthLayout } from './AuthLayout';
import { RolePicker } from './RolePicker';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS =
  'w-full rounded-2xl bg-white px-3.5 py-2.5 text-sm text-[var(--ink-warm)] ring-1 ring-zinc-200 placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:bg-zinc-50 disabled:text-zinc-400';
const PRIMARY_BUTTON =
  'inline-flex w-full items-center justify-center gap-2 rounded-full bg-mentora-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mentora-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mentora-600/30 disabled:cursor-not-allowed disabled:bg-zinc-300';

type FieldKey = 'fullName' | 'email' | 'password' | 'role';
type FieldErrors = Partial<Record<FieldKey, string>>;

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
      setFormError(result.error);
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
        <div className="mt-8 rounded-3xl bg-white shadow-card-warm-sm ring-1 ring-zinc-100">
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
            className="inline-flex items-center gap-0.5 rounded-full bg-white p-1 ring-1 ring-zinc-200"
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
                    'rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                    isActive
                      ? 'bg-[var(--ink-warm)] text-white shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-[var(--ink-warm)]',
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

        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting && (
            <span
              aria-hidden
              className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          )}
          <span>{submitting ? t('auth.signup_submitting') : t('auth.signup_submit')}</span>
        </button>

        <p className="text-xs text-[var(--muted-warm)]">{t('auth.signup_terms')}</p>

        <p className="text-sm text-[var(--ink-warm-2)]">
          {t('auth.signup_have_account')}{' '}
          <Link
            to="/signin"
            className="font-semibold text-mentora-700 transition hover:text-mentora-800"
          >
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
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink-warm)]">
        {t('auth.signup_title')}
      </h1>
      <p className="mt-2 text-sm text-[var(--ink-warm-2)]">{t('auth.signup_subtitle')}</p>
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
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-[var(--ink-warm)]"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--muted-warm)]">{hint}</p>}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
