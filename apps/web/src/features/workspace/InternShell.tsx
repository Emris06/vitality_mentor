import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { useClickyEnabled } from '../clicky/ClickyProvider';
import { useClickyAgent } from '../clicky/useClickyAgent';
import { ClickyVoiceOverlay } from '../clicky/ClickyVoiceOverlay';
import { MentoraMark } from '../../components/warm/MentoraMark';

// ──────────────────────────────────────────────────────────────────────────
// InternShell — warm-theme application shell for the intern surface.
//
// Mirrors reference/mockups/06-intern-dashboard-merged.html. New shell;
// `ErpShell` is untouched and still used by HR + Mentor screens.
//
// Layout:
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ navy sidebar │ cream main: topbar / title row / 8+4 grid         │
//   └──────────────────────────────────────────────────────────────────┘
//
// Mounts Clicky push-to-talk + cursor follow for the duration of the route.
// ──────────────────────────────────────────────────────────────────────────

interface CurrentScenarioCta {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Comma-separated keywords for the in-page Clicky agent to find this button. */
  clickyTarget?: string;
  clickyHint?: string;
}

interface Props {
  userName: string;
  /** Localized role label (e.g. "Intern", "Стажёр", "Stajyor"). */
  userRole: string;
  greeting: string;
  pageTitle: string;
  /** e.g. "May 13 — May 17, 2026". The shell stays out of formatting decisions. */
  dateRange?: string;
  searchPlaceholder?: string;
  currentScenarioCta?: CurrentScenarioCta;
  rightPanel?: ReactNode;
  children: ReactNode;
}

export function InternShell({
  userName,
  userRole,
  greeting,
  pageTitle,
  dateRange,
  searchPlaceholder,
  currentScenarioCta,
  rightPanel,
  children,
}: Props) {
  const { t } = useTranslation();
  const placeholder = searchPlaceholder ?? t('intern.shell.search_placeholder');
  // Clicky is on for the duration of the intern surface. The cleanup on
  // unmount is wired by `useClickyEnabled`.
  useClickyEnabled();
  const agent = useClickyAgent();

  const initials = computeInitials(userName);

  return (
    <div
      className="min-h-screen font-jakarta text-[var(--ink-warm)]"
      style={{
        background:
          'radial-gradient(900px 500px at 88% -200px, rgba(32, 70, 255, 0.10), transparent 60%), ' +
          'radial-gradient(700px 400px at -10% 280px, rgba(255, 107, 74, 0.08), transparent 60%), ' +
          '#fbfaf7',
      }}
    >
      <div className="mx-auto flex max-w-[1480px]">
        <Sidebar />

        <main className="min-w-0 flex-1 px-7 py-6">
          <TopBar
            searchPlaceholder={placeholder}
            userName={userName}
            userRole={userRole}
            initials={initials}
          />

          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm text-[var(--ink-warm-2)]">{greeting}</div>
              <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">
                {pageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {dateRange && (
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm shadow-chip">
                  <CalendarIcon className="h-4 w-4 text-zinc-400" />
                  <span>{dateRange}</span>
                </div>
              )}
              {currentScenarioCta && (
                <button
                  type="button"
                  onClick={currentScenarioCta.onClick}
                  disabled={currentScenarioCta.disabled}
                  data-clicky-target={currentScenarioCta.clickyTarget}
                  data-clicky-hint={currentScenarioCta.clickyHint}
                  className="rounded-full bg-[var(--ink-warm)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {currentScenarioCta.label}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-12 gap-5">
            <section className="col-span-12 space-y-5 lg:col-span-8">
              {children}
            </section>
            {rightPanel && (
              <section className="col-span-12 space-y-5 lg:col-span-4">
                {rightPanel}
              </section>
            )}
          </div>
        </main>
      </div>

      <ClickyVoiceOverlay agent={agent} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Sidebar
// ───────────────────────────────────────────────────────────────────────

function Sidebar() {
  const { t } = useTranslation();
  const cs = t('nav.coming_soon');
  return (
    <aside
      className="sticky top-0 flex h-screen w-[84px] shrink-0 flex-col items-center justify-between py-5"
      style={{
        background: 'var(--sidebar-warm)',
        borderTopRightRadius: '28px',
        borderBottomRightRadius: '28px',
      }}
    >
      <div className="flex flex-col items-center gap-7">
        <Link
          to="/intern"
          className="grid h-10 w-10 place-items-center"
          aria-label="Mentora"
        >
          <MentoraMark className="h-7 w-7 text-white" />
        </Link>

        <nav
          className="flex flex-col items-center gap-1.5"
          aria-label={t('nav.home')}
        >
          <NavSlot
            to="/intern"
            label={t('nav.home')}
            icon={<IconHome />}
            matchExact
            clickyTarget="home, dashboard, today, intern"
            clickyHint={t('clicky.hint.nav.home')}
          />
          <NavSlot
            to="/simulator"
            label={t('nav.scenarios')}
            icon={<IconBoard />}
            clickyTarget="scenarios, simulator, catalog, browse, lab"
            clickyHint={t('clicky.hint.nav.scenarios')}
          />
          <NavSlot
            label={t('nav.quests')}
            icon={<IconCheckBoard />}
            comingSoon
            tooltip={`${t('nav.quests')} — ${cs}`}
            clickyTarget="quests, tasks, todo"
          />
          <NavSlot
            to="/chat"
            label={t('nav.chat')}
            icon={<IconChat />}
            clickyTarget="chat, ai, mentor, ask, bank, question"
            clickyHint={t('clicky.hint.nav.chat')}
          />
          <NavSlot
            label={t('nav.messages')}
            icon={<IconMessage />}
            comingSoon
            tooltip={`${t('nav.messages')} — ${cs}`}
            badge="dot"
            clickyTarget="messages, inbox, mail"
          />
          <NavSlot
            label={t('nav.resources')}
            icon={<IconBook />}
            comingSoon
            tooltip={`${t('nav.resources')} — ${cs}`}
            clickyTarget="resources, docs, library, sop"
          />
        </nav>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ClickySupportCard />
        <Link
          to="/me"
          aria-label={t('nav.profile')}
          title={t('nav.profile')}
          data-clicky-target="profile, me, my, account, xp, badges"
          data-clicky-hint={t('clicky.hint.nav.profile')}
          className="grid h-10 w-10 place-items-center text-white/50 transition hover:text-white"
        >
          <IconProfile />
        </Link>
      </div>
    </aside>
  );
}

interface NavSlotProps {
  to?: string;
  label: string;
  icon: ReactNode;
  matchExact?: boolean;
  comingSoon?: boolean;
  tooltip?: string;
  badge?: 'dot';
}

interface NavSlotPropsWithClicky extends NavSlotProps {
  clickyTarget?: string;
  clickyHint?: string;
}

function NavSlot({
  to,
  label,
  icon,
  matchExact = false,
  comingSoon = false,
  tooltip,
  badge,
  clickyTarget,
  clickyHint,
}: NavSlotPropsWithClicky) {
  const location = useLocation();
  const active = !!to && (matchExact ? location.pathname === to : location.pathname.startsWith(to));
  const baseClasses = 'group relative grid h-11 w-11 place-items-center rounded-2xl transition';
  const stateClasses = active
    ? 'bg-white/10 text-white'
    : comingSoon
      ? 'cursor-not-allowed text-white/25'
      : 'text-white/50 hover:bg-white/5 hover:text-white';

  const content = (
    <>
      {active && (
        <span className="absolute left-[-12px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-coral-600" />
      )}
      {icon}
      {badge === 'dot' && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral-600" />
      )}
    </>
  );

  if (to && !comingSoon) {
    return (
      <Link
        to={to}
        aria-label={label}
        title={label}
        data-clicky-target={clickyTarget}
        data-clicky-hint={clickyHint}
        className={`${baseClasses} ${stateClasses}`}
      >
        {content}
      </Link>
    );
  }
  return (
    <span
      aria-label={label}
      aria-disabled={comingSoon}
      title={tooltip ?? label}
      data-clicky-target={clickyTarget}
      data-clicky-hint={clickyHint ?? tooltip}
      className={`${baseClasses} ${stateClasses}`}
    >
      {content}
    </span>
  );
}

function ClickySupportCard() {
  return (
    <div className="relative w-[60px] text-center">
      <div className="relative mx-auto grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gradient-to-br from-coral-600 to-[#ff9670] shadow-[0_6px_18px_-6px_rgba(255,107,74,0.6)]">
        <MentoraMark className="h-7 w-7 text-white" />
        <span
          className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 ring-2"
          style={{ '--tw-ring-color': 'var(--sidebar-warm)' } as React.CSSProperties}
        >
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
        Clicky
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Top bar
// ───────────────────────────────────────────────────────────────────────

function TopBar({
  searchPlaceholder,
  userName,
  userRole,
  initials,
}: {
  searchPlaceholder: string;
  userName: string;
  userRole: string;
  initials: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4">
      <div className="relative max-w-[520px] flex-1">
        <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          data-clicky-target="search, find, look, lookup, query"
          data-clicky-hint={t('clicky.hint.topbar.search')}
          className="w-full rounded-full bg-white px-10 py-2.5 text-sm shadow-chip placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
        />
      </div>
      <div className="flex-1" />
      <LocaleChip />
      <button
        type="button"
        aria-label={t('intern.shell.account_label')}
        data-clicky-target="notifications, bell, alerts, inbox"
        data-clicky-hint={t('clicky.hint.topbar.notifications')}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow-chip"
      >
        <BellIcon className="h-5 w-5 text-[var(--ink-warm-2)]" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral-600" />
      </button>
      <button
        type="button"
        aria-label={t('intern.shell.account_label')}
        data-clicky-target="account, profile, me, sign out, logout"
        data-clicky-hint={t('clicky.hint.topbar.account')}
        className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-chip"
      >
        <span className="av-amber grid h-7 w-7 place-items-center rounded-full text-xs font-bold">
          {initials}
        </span>
        <span className="hidden text-sm font-semibold sm:inline">{userName}</span>
        <span className="hidden text-[11px] font-medium text-zinc-400 sm:inline">
          · {userRole}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-zinc-400" />
      </button>
    </div>
  );
}

function LocaleChip() {
  const { i18n, t } = useTranslation();
  const raw = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const current: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const locales: readonly Locale[] = ['uz', 'ru', 'en'];
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-white px-1.5 py-1 text-xs font-semibold shadow-chip"
      data-clicky-target="language, locale, uz, ru, en, switch, translate"
      data-clicky-hint={t('clicky.hint.topbar.locale')}
    >
      {locales.map((l) => {
        const active = l === current;
        return (
          <button
            key={l}
            type="button"
            onClick={() => {
              void i18n.changeLanguage(l);
            }}
            data-clicky-target={`${l}, ${l.toLowerCase()}, language, locale, switch`}
            data-clicky-hint={`Switch the interface to ${l.toUpperCase()}.`}
            className={`rounded-full px-2.5 py-1 transition ${
              active
                ? 'bg-[var(--ink-warm)] text-white'
                : 'text-zinc-500 hover:text-[var(--ink-warm)]'
            }`}
            aria-pressed={active}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
}

// ───────────────────────────────────────────────────────────────────────
// Icons (kept inline — small, monochrome, no external deps)
// ───────────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12 12 4l9 8" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function IconBoard() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 4v16" />
    </svg>
  );
}
function IconCheckBoard() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3 8-8" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function IconMessage() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h16v12H7l-3 3z" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function IconProfile() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0v5l1.5 3h-15L6 13z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
