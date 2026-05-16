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

export function homeRouteFor(role: UserRole | null): string {
  switch (role) {
    case 'hr':
    case 'admin':
      return '/hr';
    case 'intern':
      return '/intern';
    case 'employee':
      return '/employee';
    default:
      return '/';
  }
}
