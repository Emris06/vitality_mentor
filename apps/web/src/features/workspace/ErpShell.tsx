import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LocalePicker } from '../../components/LocalePicker';

export interface ErpNavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  badge?: string;
}

export interface ErpNavSection {
  label?: string;
  items: ErpNavItem[];
}

interface ErpShellProps {
  title: string;
  subtitle: string;
  userName: string;
  userRole: string;
  sections: ErpNavSection[];
  children: ReactNode;
  rightPanel?: ReactNode;
  topActions?: ReactNode;
  homeHref?: string;
  searchPlaceholder?: string;
}

interface WorkspaceItem {
  id: string;
  type: 'task' | 'note' | 'reminder';
  title: string;
  createdAt: string;
  done: boolean;
}

interface InboxEvent {
  id: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
}

const WORKSPACE_ITEMS_KEY = 'vitality.workspace.items';
const INBOX_EVENTS_KEY = 'vitality.workspace.inbox';

export function ErpShell({
  title,
  subtitle,
  userName,
  userRole,
  sections,
  children,
  rightPanel,
  topActions,
  homeHref = '/',
  searchPlaceholder = 'Search...',
}: ErpShellProps) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<WorkspaceItem['type']>('task');
  const [createTitle, setCreateTitle] = useState('');
  const [items, setItems] = useState<WorkspaceItem[]>(() => readWorkspaceItems());
  const [inboxOpen, setInboxOpen] = useState(false);
  const [events, setEvents] = useState<InboxEvent[]>(() => readInboxEvents());

  const navCommands = useMemo(() => {
    const flat = sections.flatMap((section) => section.items);
    const unique = new Map<string, ErpNavItem>();
    for (const item of flat) {
      if (!unique.has(item.to)) unique.set(item.to, item);
    }
    return Array.from(unique.values());
  }, [sections]);

  const commands = useMemo(() => {
    const nav = navCommands.map((item) => ({
      id: `nav-${item.to}`,
      label: item.label,
      hint: item.to,
      run: () => navigate(item.to),
    }));
    return [
      ...nav,
      {
        id: 'create-task',
        label: 'Create task',
        hint: 'Personal workspace item',
        run: () => {
          setCreateType('task');
          setCreateOpen(true);
        },
      },
      {
        id: 'create-note',
        label: 'Create note',
        hint: 'Personal workspace item',
        run: () => {
          setCreateType('note');
          setCreateOpen(true);
        },
      },
      {
        id: 'open-inbox',
        label: 'Open notifications',
        hint: 'Startup feed and alerts',
        run: () => setInboxOpen(true),
      },
    ];
  }, [navCommands, navigate]);

  const filteredCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => {
      return (
        command.label.toLowerCase().includes(q) ||
        command.hint.toLowerCase().includes(q)
      );
    });
  }, [commands, paletteQuery]);

  const unreadCount = events.filter((event) => event.unread).length;
  const openItems = items.filter((item) => !item.done).length;

  useEffect(() => {
    persistJson(WORKSPACE_ITEMS_KEY, items);
  }, [items]);

  useEffect(() => {
    persistJson(INBOX_EVENTS_KEY, events);
  }, [events]);

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (ev.key === 'Escape') {
        setPaletteOpen(false);
        setCreateOpen(false);
        setInboxOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) setPaletteQuery('');
  }, [paletteOpen]);

  function createItem() {
    const title = createTitle.trim();
    if (title.length < 2) return;
    setItems((prev) => [
      {
        id: makeId(),
        type: createType,
        title,
        createdAt: new Date().toISOString(),
        done: false,
      },
      ...prev,
    ]);
    setCreateTitle('');
    setCreateOpen(false);
  }

  function toggleDone(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  }

  function markAllRead() {
    setEvents((prev) => prev.map((event) => ({ ...event, unread: false })));
  }

  return (
    <div className="min-h-full bg-[#dbe7f0] p-2 md:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1500px] overflow-hidden rounded-[26px] border border-slate-300 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] md:min-h-[calc(100vh-2.5rem)]">
        <aside className="hidden w-[252px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="flex items-center gap-3 px-5 pb-4 pt-5">
            <Link to={homeHref} className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
              AI
            </Link>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{title}</p>
              <p className="truncate text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {sections.map((section, idx) => (
              <div key={`${section.label ?? 'sec'}-${idx}`} className="mb-4">
                {section.label && (
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={`${item.to}-${item.label}`}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}>
                              {item.icon}
                            </span>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {item.badge}
                              </span>
                            )}
                            {isActive && <span className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-brand-600" />}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="border-t border-slate-200 px-3 py-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Workspace
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>Open items</span>
                <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700">
                  {openItems}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {items.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleDone(item.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:border-brand-200"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <span className={item.done ? 'line-through opacity-60' : ''}>{item.title}</span>
                  </button>
                ))}
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs text-slate-500">
                    No items yet. Use <span className="font-semibold">+ New</span>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="relative hidden max-w-xl flex-1 md:block">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 pr-20 text-left text-sm text-slate-900 transition-colors hover:border-slate-300"
              >
                {searchPlaceholder}
              </button>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" strokeLinecap="round" />
              </svg>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                Ctrl K
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                + New
              </button>
              <button
                type="button"
                onClick={() => setInboxOpen((prev) => !prev)}
                className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Notifications"
              >
                <IconBell />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {topActions}
              <LocalePicker />
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 md:flex">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                  {initials(userName)}
                </span>
                <div className="pr-1">
                  <p className="text-sm font-medium leading-tight text-slate-900">{userName}</p>
                  <p className="text-xs leading-tight text-slate-500">{userRole}</p>
                </div>
              </div>
            </div>
          </header>
          <div className="border-b border-slate-200 bg-gradient-to-r from-brand-50 via-white to-emerald-50 px-4 py-2.5 text-xs text-slate-700 md:px-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <PulseItem label="Product velocity" value="12 launches / month" tone="brand" />
              <PulseItem label="AI uptime" value="99.98%" tone="emerald" />
              <PulseItem label="Active learners" value="1,284" tone="amber" />
              <PulseItem label="Deploy queue" value="3 shipping today" tone="slate" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 bg-slate-100/80">
            <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            {rightPanel && (
              <aside className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-white p-4 xl:block">
                {rightPanel}
              </aside>
            )}
          </div>
        </div>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-slate-900/40 px-4 pt-[12vh]">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-3">
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Type a command or route..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-300 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => {
                    command.run();
                    setPaletteOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-800">{command.label}</span>
                  <span className="text-xs text-slate-500">{command.hint}</span>
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500">No matching command.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Create workspace item</h3>
            <p className="mt-1 text-sm text-slate-500">Track personal startup work directly in your panel.</p>
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                {(['task', 'note', 'reminder'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setCreateType(kind)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                      createType === kind
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Write a short title..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-300 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createItem}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {inboxOpen && (
        <div className="fixed right-4 top-20 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {events.map((event) => (
              <article key={event.id} className="rounded-xl px-3 py-2 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{event.title}</p>
                  <span className="text-[11px] text-slate-500">{event.time}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">{event.detail}</p>
                {event.unread && <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-600" />}
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PulseItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'emerald' | 'amber' | 'slate';
}) {
  const color =
    tone === 'brand'
      ? 'bg-brand-500'
      : tone === 'emerald'
        ? 'bg-emerald-500'
        : tone === 'amber'
          ? 'bg-amber-500'
          : 'bg-slate-500';
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`relative flex h-2.5 w-2.5`}>
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${color}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
      </span>
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function readWorkspaceItems(): WorkspaceItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORKSPACE_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 24);
  } catch {
    return [];
  }
}

function readInboxEvents(): InboxEvent[] {
  if (typeof window === 'undefined') return seedInboxEvents();
  try {
    const raw = window.localStorage.getItem(INBOX_EVENTS_KEY);
    if (!raw) return seedInboxEvents();
    const parsed = JSON.parse(raw) as InboxEvent[];
    if (!Array.isArray(parsed)) return seedInboxEvents();
    return parsed;
  } catch {
    return seedInboxEvents();
  }
}

function seedInboxEvents(): InboxEvent[] {
  return [
    {
      id: 'ev-1',
      title: 'Weekly product update',
      detail: 'New CRM widgets shipped to all role dashboards.',
      time: '2m',
      unread: true,
    },
    {
      id: 'ev-2',
      title: 'AI model refresh',
      detail: 'Assistant response quality improved for compliance prompts.',
      time: '1h',
      unread: true,
    },
    {
      id: 'ev-3',
      title: 'Team milestone',
      detail: 'Training completion crossed 85% this week.',
      time: '3h',
      unread: false,
    },
  ];
}

function persistJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initials(name: string): string {
  const chunks = name.trim().split(/\s+/).slice(0, 2);
  if (chunks.length === 0) return 'AI';
  return chunks.map((chunk) => chunk[0]?.toUpperCase() ?? '').join('') || 'AI';
}

export function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function IconRocket() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.5 16.5c-1.5 1.3-2 3-2 3s1.7-.5 3-2l4-4-1-1z" />
      <path d="M14 10l-4 4" />
      <path d="M9.5 14.5l-2 2" />
      <path d="M14.5 9.5l2-2" />
      <path d="M13 3s3.5-.4 6.3 2.3S21.7 12 21.7 12s-3.5.4-6.3-2.3S13 3 13 3z" />
      <circle cx="17.5" cy="6.5" r="1.5" />
    </svg>
  );
}

export function IconBook() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.6L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}
