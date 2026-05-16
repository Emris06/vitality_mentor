import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { homeRouteFor, type UserRole } from './types';

interface RequireAuthProps {
  children: ReactNode;
  /** When set, redirect to the user's own home if their role isn't in the list. */
  roles?: UserRole[];
}

/**
 * Route guard. Behavior depends on configuration:
 *
 *  - Supabase NOT configured  → pass-through. The dev cookie identifies a
 *    session-less user. Useful for the early dev loop.
 *  - Supabase configured, no session  → redirect to /signin (preserving the
 *    intended destination via `state.from`).
 *  - Session exists, role mismatch  → redirect to the user's own home route.
 *  - Auth ready + session + role match  → render children.
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { ready, configured, session, profile } = useAuth();
  const location = useLocation();

  if (!configured) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center text-sm text-slate-400">…</div>
    );
  }

  if (!session) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  if (roles && roles.length > 0 && profile?.role && !roles.includes(profile.role)) {
    return <Navigate to={homeRouteFor(profile.role)} replace />;
  }

  return <>{children}</>;
}
