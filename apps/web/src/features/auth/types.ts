import type { User } from '@supabase/supabase-js';

export type UserRole = 'hr' | 'employee' | 'intern' | 'admin';

export const USER_ROLES: UserRole[] = ['hr', 'employee', 'intern', 'admin'];

export interface AuthProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole | null;
  isMentor: boolean;
  department: string | null;
  languages: string[];
  avatarUrl: string | null;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as string[]).includes(value);
}

/** Read role from Supabase JWT user metadata (set at sign-up). */
export function roleFromUser(user: User | null | undefined): UserRole | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const app = (user.app_metadata ?? {}) as Record<string, unknown>;
  const raw = app.role ?? meta.role ?? null;
  return isUserRole(raw) ? raw : null;
}

export function homeRouteFor(role: UserRole | null): string {
  switch (role) {
    case 'hr':
    case 'admin':
      return '/hr';
    case 'intern':
      return '/simulator';
    case 'employee':
      return '/chat';
    default:
      return '/';
  }
}
