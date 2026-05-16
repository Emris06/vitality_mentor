import type { ReactNode } from 'react';
import { Avatar } from './Avatar';

interface TopBarProps {
  search?: ReactNode;
  notifications?: ReactNode;
  userName: string;
  userRole?: string;
  userAvatarSrc?: string | null;
  rightExtras?: ReactNode;
  onSignOut?: () => void;
}

export function TopBar({
  search,
  notifications,
  userName,
  userRole,
  userAvatarSrc,
  rightExtras,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
      <div className="flex-1">
        {search ?? (
          <div className="relative max-w-md">
            <input
              type="search"
              placeholder="Search…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus-visible:shadow-focus"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {rightExtras}

      {notifications ?? (
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 10-12 0v3a2 2 0 01-.6 1.6L4 17h5m6 0a3 3 0 11-6 0"
            />
          </svg>
        </button>
      )}

      <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
        <Avatar name={userName} src={userAvatarSrc ?? undefined} size="sm" />
        <div className="hidden md:block">
          <div className="text-sm font-medium leading-tight text-slate-900">{userName}</div>
          {userRole && <div className="text-xs leading-tight text-slate-500">{userRole}</div>}
        </div>
      </div>
    </header>
  );
}
