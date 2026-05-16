/**
 * Map Supabase Auth API errors to i18n keys under `auth.*`.
 * Falls back to `auth.error_generic` ("Something went wrong").
 */
export function mapSupabaseError(
  message: string | undefined,
  status?: number,
): string {
  if (!message && status === 429) return 'auth.error_rate_limited';
  if (!message) return 'auth.error_generic';

  if (message === 'supabase_not_configured') return 'auth.error_supabase_not_configured';

  const lower = message.toLowerCase();

  if (
    status === 429 ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('too many')
  ) {
    if (lower.includes('email')) return 'auth.error_email_rate_limited';
    return 'auth.error_rate_limited';
  }

  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'auth.error_invalid_credentials';
  }

  if (
    lower.includes('already registered') ||
    lower.includes('user already registered') ||
    lower.includes('email address is already')
  ) {
    return 'auth.error_email_taken';
  }

  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'auth.error_email_not_confirmed';
  }

  if (
    lower.includes('invalid api key') ||
    lower.includes('invalid jwt') ||
    lower.includes('no api key') ||
    lower.includes('apikey')
  ) {
    return 'auth.error_supabase_key_invalid';
  }

  if (lower.includes('signup') && lower.includes('disabled')) {
    return 'auth.error_signup_disabled';
  }

  if (lower.includes('email') && lower.includes('invalid')) {
    return 'auth.error_invalid_email';
  }

  if (lower.includes('password') && (lower.includes('weak') || lower.includes('at least'))) {
    return 'auth.error_weak_password';
  }

  if (lower.includes('confirmation') && lower.includes('email')) {
    return 'auth.error_confirmation_email';
  }

  return 'auth.error_generic';
}
