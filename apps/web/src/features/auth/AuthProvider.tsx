import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { mapSupabaseError } from './errors';
import { type AuthProfile, type UserRole, isUserRole } from './types';

interface AuthContextValue {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInMagicLink: (email: string) => Promise<{ error?: string }>;
  signUp: (input: SignUpInput) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  language?: 'en' | 'ru' | 'uz';
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromUser(user: User | null): AuthProfile | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const app = (user.app_metadata ?? {}) as Record<string, unknown>;
  const rawRole = app.role ?? meta.role ?? null;
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: (meta.full_name as string | undefined) ?? null,
    role: isUserRole(rawRole) ? rawRole : null,
    isMentor: Boolean(meta.is_mentor),
    department: (meta.department as string | undefined) ?? null,
    languages: Array.isArray(meta.languages) ? (meta.languages as string[]) : [],
    avatarUrl: (meta.avatar_url as string | undefined) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const supabase = configured ? getSupabase() : null;

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const profile = profileFromUser(user);

    return {
      ready,
      configured,
      session,
      user,
      profile,
      async signIn(email, password) {
        if (!supabase) return { error: mapSupabaseError('supabase_not_configured') };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (import.meta.env.DEV) console.error('[auth] signIn', error.message, error.status);
          return { error: mapSupabaseError(error.message, error.status) };
        }
        return {};
      },
      async signInMagicLink(email) {
        if (!supabase) return { error: mapSupabaseError('supabase_not_configured') };
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo:
              typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
          },
        });
        if (error) {
          if (import.meta.env.DEV) console.error('[auth] magic link', error.message, error.status);
          return { error: mapSupabaseError(error.message, error.status) };
        }
        return {};
      },
      async signUp({ email, password, fullName, role, language }) {
        if (!supabase) return { error: mapSupabaseError('supabase_not_configured') };
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role, languages: language ? [language] : [] },
          },
        });
        if (error) {
          if (import.meta.env.DEV) console.error('[auth] signUp', error.message, error.status);
          return { error: mapSupabaseError(error.message, error.status) };
        }
        return {};
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        setSession(null);
      },
      async refreshProfile() {
        // No-op for now — when a `profiles` API endpoint lands, fetch and
        // merge the row here. Profile derives from JWT metadata in the
        // meantime, so signUp/signIn already populate it.
      },
    };
  }, [configured, ready, session, supabase]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be called inside <AuthProvider>');
  return ctx;
}
