import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { useClickyEnabled } from '../clicky/ClickyProvider';
import { useClickyAgent } from '../clicky/useClickyAgent';
import { ClickyVoiceOverlay } from '../clicky/ClickyVoiceOverlay';

// ChatPage is lazy so its tree (SSE + STT/TTS) is only loaded when the user
// actually opens the floating panel via the FAB.
const ChatPage = lazy(() =>
  import('../chat/ChatPage').then((m) => ({ default: m.ChatPage })),
);

// ──────────────────────────────────────────────────────────────────────────
// InternShell — reference-design shell (v4).
//
// Layout matches reference/Mentora prototype exactly:
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ 220px white sidebar │ topbar (52px) / page / children           │
//   └──────────────────────────────────────────────────────────────────┘
//
// Sidebar: brand mark + wordmark, nav sections, synth-tag, user chip.
// Topbar: breadcrumbs | search | PTT hint | locale chip.
// Main: paper background, 1240px max-width, page title with serif em.
// Shell mounts Clicky PTT + voice overlay (intern surface only).
// ──────────────────────────────────────────────────────────────────────────

interface CurrentScenarioCta {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  clickyTarget?: string;
  clickyHint?: string;
}

export interface MentoraNavItem {
  to?: string;
  labelKey: string;
  icon: ReactNode;
  matchExact?: boolean;
  comingSoon?: boolean;
  badge?: 'dot';
  clickyTarget?: string;
  clickyHintKey?: string;
}

const DEFAULT_INTERN_NAV: MentoraNavItem[] = [
  {
    to: '/intern',
    labelKey: 'nav.home',
    icon: <IconHome />,
    matchExact: true,
    clickyTarget: 'home, dashboard, today, intern',
    clickyHintKey: 'clicky.hint.nav.home',
  },
  {
    to: '/simulator',
    labelKey: 'nav.scenarios',
    icon: <IconBoard />,
    clickyTarget: 'scenarios, simulator, catalog, browse, lab',
    clickyHintKey: 'clicky.hint.nav.scenarios',
  },
  {
    to: '/quests',
    labelKey: 'nav.quests',
    icon: <IconCheckBoard />,
    clickyTarget: 'quests, tasks, todo',
  },
  {
    to: '/chat',
    labelKey: 'nav.chat',
    icon: <IconChat />,
    clickyTarget: 'chat, ai, mentor, ask, bank, question',
    clickyHintKey: 'clicky.hint.nav.chat',
  },
  {
    to: '/messages',
    labelKey: 'nav.messages',
    icon: <IconMessage />,
    badge: 'dot',
    clickyTarget: 'messages, inbox, mail',
  },
  {
    to: '/resources',
    labelKey: 'nav.resources',
    icon: <IconBook />,
    clickyTarget: 'resources, docs, library, sop',
  },
];

interface Props {
  userName: string;
  userRole: string;
  greeting: string;
  pageTitle: string;
  pageSubtitle?: string;
  dateRange?: string;
  searchPlaceholder?: string;
  currentScenarioCta?: CurrentScenarioCta;
  navItems?: MentoraNavItem[];
  /** Kept for compatibility — ignored in new layout (content flows inline). */
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
  navItems,
  children,
}: Props) {
  const { t } = useTranslation();
  const [ptt, setPtt] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const placeholder = searchPlaceholder ?? t('intern.shell.search_placeholder');

  useClickyEnabled();
  const agent = useClickyAgent();

  const initials = computeInitials(userName);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        height: '100vh',
        background: 'var(--paper)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--ink)',
        overflow: 'hidden',
      }}
    >
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '0 6px', height: '28px' }}>
          <Link to="/intern" aria-label="Mentora" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
            <div className="brand-mark" aria-hidden="true">
              <i /><i />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--ink)' }}>
              mento<em style={{ color: 'var(--cobalt)', fontStyle: 'normal' }}>ra</em>
            </span>
          </Link>
        </div>

        {/* Nav — Обучение */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div className="nav-title">Обучение</div>
          {(navItems ?? DEFAULT_INTERN_NAV).slice(0, 4).map((item, idx) => (
            <NavItem key={`${item.labelKey}-${idx}`} item={item} t={t} />
          ))}
        </nav>

        {/* Nav — Личное */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div className="nav-title">Личное</div>
          {(navItems ?? DEFAULT_INTERN_NAV).slice(4).map((item, idx) => (
            <NavItem key={`${item.labelKey}-${idx}`} item={item} t={t} />
          ))}
          <NavItem
            item={{
              to: '/me',
              labelKey: 'nav.profile',
              icon: <IconProfile />,
              clickyTarget: 'profile, me, my, account, xp, badges',
              clickyHintKey: 'clicky.hint.nav.profile',
            }}
            t={t}
          />
        </nav>

        {/* Footer */}
        <div className="sidebar-foot">
          <span className="synth-tag" style={{ display: 'inline-flex' }}>
            Синтетические данные
          </span>
          <div className="user-chip">
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #F4B860, #D7693B)' }}>
              {initials}
            </div>
            <div className="user-meta">
              <b>{userName}</b>
              <span>{userRole}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Workspace ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <header className="topbar">
          {/* Breadcrumbs */}
          <nav className="crumbs">
            <span>{t('auth.role_intern_name')}</span>
            <span className="sep">/</span>
            <b>{pageTitle}</b>
          </nav>

          {/* Search */}
          <div
            className="search"
            data-clicky-target="search, find, look, lookup, query"
            data-clicky-hint={t('clicky.hint.topbar.search')}
            role="search"
            tabIndex={0}
          >
            <SearchIcon style={{ width: '14px', height: '14px', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{placeholder}</span>
            <kbd>⌘K</kbd>
          </div>

          {/* PTT hint */}
          <PttHint ptt={ptt} />

          {/* Locale chip */}
          <LocaleChip />

          {/* Account */}
          <button
            type="button"
            aria-label={t('intern.shell.account_label')}
            data-clicky-target="account, profile, me, sign out, logout"
            data-clicky-hint={t('clicky.hint.topbar.account')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '5px 10px 5px 7px',
              borderRadius: '999px',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <span
              className="avatar"
              style={{ width: '22px', height: '22px', fontSize: '10px', background: 'linear-gradient(135deg, #F4B860, #D7693B)' }}
            >
              {initials}
            </span>
            <span style={{ fontWeight: 500 }}>{userName}</span>
            <ChevronDownIcon style={{ width: '14px', height: '14px', color: 'var(--mute-2)' }} />
          </button>
        </header>

        {/* Main content */}
        <main
          className="scrollarea screen-in"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '28px 32px 48px' }}>
            {/* Page heading */}
            <div style={{ marginBottom: '22px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <p className="h-eyebrow">{greeting}</p>
                <h1 className="h1">
                  {pageTitle.includes(' ') ? (
                    <>
                      {pageTitle.split(' ').slice(0, -1).join(' ')}{' '}
                      <em>{pageTitle.split(' ').slice(-1)[0]}</em>
                    </>
                  ) : (
                    <em>{pageTitle}</em>
                  )}
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {dateRange && (
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '5px 10px', borderRadius: '999px',
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      fontSize: '12.5px', color: 'var(--mute)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <CalendarIcon style={{ width: '13px', height: '13px' }} />
                    {dateRange}
                  </span>
                )}
                {currentScenarioCta && (
                  <button
                    type="button"
                    onClick={currentScenarioCta.onClick}
                    disabled={currentScenarioCta.disabled}
                    data-clicky-target={currentScenarioCta.clickyTarget}
                    data-clicky-hint={currentScenarioCta.clickyHint}
                    className="btn btn-primary"
                    style={{ borderRadius: '999px', height: '36px', padding: '0 16px', fontSize: '13px' }}
                  >
                    {currentScenarioCta.label}
                  </button>
                )}
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>

      {/* Chat FAB */}
      {!chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)}>
          <span className="fab-dot" />
          <ChatIconInline />
          Спросить базу знаний
        </button>
      )}
      {chatOpen && (
        <Suspense fallback={null}>
          <ChatPage mode="panel" onClose={() => setChatOpen(false)} />
        </Suspense>
      )}

      <ClickyVoiceOverlay agent={agent} onPttChange={setPtt} />
    </div>
  );
}

// ── NavItem ──────────────────────────────────────────────────────────────

function NavItem({
  item,
  t,
}: {
  item: MentoraNavItem;
  t: (key: string) => string;
}) {
  const location = useLocation();
  const label = t(item.labelKey);
  const active = !!item.to && (
    item.matchExact
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to)
  );

  const className = `nav-item${active ? ' active' : ''}${item.comingSoon ? ' opacity-40 cursor-not-allowed' : ''}`;

  const content = (
    <>
      <span className="nav-icon">{item.icon}</span>
      {label}
      {item.badge === 'dot' && (
        <span
          style={{
            marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--cobalt)', flexShrink: 0,
          }}
        />
      )}
    </>
  );

  if (item.to && !item.comingSoon) {
    return (
      <Link
        to={item.to}
        aria-label={label}
        data-clicky-target={item.clickyTarget}
        data-clicky-hint={item.clickyHintKey ? t(item.clickyHintKey) : undefined}
        className={className}
        style={{ textDecoration: 'none' }}
      >
        {content}
      </Link>
    );
  }
  return (
    <span
      aria-label={label}
      title={item.comingSoon ? `${label} — скоро` : label}
      data-clicky-target={item.clickyTarget}
      className={className}
    >
      {content}
    </span>
  );
}

// ── PTT hint (topbar right) ───────────────────────────────────────────────

function PttHint({ ptt }: { ptt: boolean }) {
  return (
    <div className={`ptt-hint${ptt ? ' live' : ''}`}>
      {ptt ? (
        <>
          <span style={{ fontWeight: 500 }}>Слушаю</span>
          <span className="wave">
            <i /><i /><i /><i /><i /><i />
          </span>
        </>
      ) : (
        <>
          <kbd>`</kbd>
          <span>Говорить с Клики</span>
        </>
      )}
    </div>
  );
}

// ── Locale chip ───────────────────────────────────────────────────────────

function LocaleChip() {
  const { i18n, t } = useTranslation();
  const raw = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const current: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const locales: readonly Locale[] = ['uz', 'ru', 'en'];
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '2px',
        padding: '3px', borderRadius: '999px',
        background: 'var(--surface-2)', border: '1px solid var(--line)',
      }}
      data-clicky-target="language, locale, uz, ru, en, switch, translate"
      data-clicky-hint={t('clicky.hint.topbar.locale')}
    >
      {locales.map((l) => {
        const active = l === current;
        return (
          <button
            key={l}
            type="button"
            onClick={() => void i18n.changeLanguage(l)}
            aria-pressed={active}
            style={{
              borderRadius: '999px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              border: 0,
              cursor: 'pointer',
              background: active ? 'var(--ink)' : 'transparent',
              color: active ? 'white' : 'var(--mute)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
}

// ── Icon exports (kept for existing callers) ──────────────────────────────

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 12 4l9 8" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
export function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 4v16" />
    </svg>
  );
}
export function IconCheckBoard() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
export function IconChat() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
export function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v12H7l-3 3z" />
    </svg>
  );
}
export function IconBook() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z" /><path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
export function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
export function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.6" /><path d="M15 20a4 4 0 0 1 7-2.6" />
    </svg>
  );
}
export function IconChart() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20v-5M3 20h19" />
    </svg>
  );
}

function CalendarIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
function SearchIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function ChevronDownIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ChatIconInline() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
