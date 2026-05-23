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
    <div style={{ minHeight: '100%', padding: '8px', fontFamily: 'var(--font-sans)', background: 'var(--paper)' }} className="md:p-5">
      <div
        style={{
          margin: '0 auto',
          maxWidth: 1440,
          minHeight: 'calc(100vh - 1rem)',
          overflow: 'hidden',
          borderRadius: 20,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
        }}
        className="md:min-h-[calc(100vh-2.5rem)]"
      >
        <aside
          style={{
            width: 244,
            flexShrink: 0,
            borderRight: '1px solid var(--line)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
          className="hidden md:flex"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px' }}>
            <Link
              to={homeHref}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'var(--cobalt)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(32,70,255,0.35)',
              }}
            >
              AI
            </Link>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
              <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</p>
            </div>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
            {sections.map((section, idx) => (
              <div key={`${section.label ?? 'sec'}-${idx}`} style={{ marginBottom: 16 }}>
                {section.label && (
                  <p style={{ padding: '0 12px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 500, margin: 0 }}>
                    {section.label}
                  </p>
                )}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {section.items.map((item) => (
                    <li key={`${item.to}-${item.label}`}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '7px 10px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: isActive ? 500 : 400,
                          color: isActive ? 'var(--cobalt-ink)' : 'var(--ink)',
                          background: isActive ? 'var(--cobalt-tint)' : 'transparent',
                          textDecoration: 'none',
                          transition: 'background 0.12s, color 0.12s',
                          position: 'relative',
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <span style={{ color: isActive ? 'var(--cobalt)' : 'var(--mute)' }}>
                              {item.icon}
                            </span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            {item.badge && (
                              <span style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, padding: '1px 8px', fontSize: 10.5, fontWeight: 600, color: 'var(--ink)' }}>
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div style={{ borderTop: '1px solid var(--line)', padding: '12px' }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', margin: '0 0 8px', fontWeight: 500 }}>
                Workspace
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink)' }}>
                <span>Open items</span>
                <span style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                  {openItems}
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleDone(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      padding: '6px 8px',
                      fontSize: 12,
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.done ? 'var(--good)' : 'var(--synth)', flexShrink: 0 }} />
                    <span style={{ opacity: item.done ? 0.5 : 1, textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </span>
                  </button>
                ))}
                {items.length === 0 && (
                  <p style={{ border: '1px dashed var(--line-2)', borderRadius: 6, padding: '8px', fontSize: 11.5, color: 'var(--mute)' }}>
                    No items yet. Use <strong>+ New</strong>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <header
            style={{
              display: 'flex',
              height: 56,
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid var(--line)',
              background: 'var(--surface)',
              padding: '0 16px',
            }}
            className="md:px-6"
          >
            <div style={{ position: 'relative', flex: 1, maxWidth: 480, display: 'none' }} className="md:block">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                style={{
                  height: 36,
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  padding: '0 40px 0 36px',
                  textAlign: 'left',
                  fontSize: 13,
                  color: 'var(--mute)',
                  cursor: 'text',
                  transition: 'border-color 0.15s',
                }}
              >
                {searchPlaceholder}
              </button>
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--mute-2)', pointerEvents: 'none' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" strokeLinecap="round" />
              </svg>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--mute)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 5px', pointerEvents: 'none' }}>
                Ctrl K
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                style={{ borderRadius: 7, background: 'var(--cobalt)', padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                + New
              </button>
              <button
                type="button"
                onClick={() => setInboxOpen((prev) => !prev)}
                style={{ position: 'relative', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface)', padding: 7, color: 'var(--ink)', cursor: 'pointer' }}
                aria-label="Notifications"
              >
                <IconBell />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--bad)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {topActions}
              <LocalePicker />
              <div style={{ display: 'none', alignItems: 'center', gap: 8, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', padding: '4px 8px' }} className="md:flex">
                <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 7, background: 'var(--ink)', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  {initials(userName)}
                </span>
                <div style={{ paddingRight: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>{userName}</p>
                  <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, lineHeight: 1.3 }}>{userRole}</p>
                </div>
              </div>
            </div>
          </header>

          <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', padding: '8px 16px', fontSize: 11 }} className="md:px-6">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 20px' }}>
              <PulseItem label="Product velocity" value="12 launches / month" tone="brand" />
              <PulseItem label="AI uptime" value="99.98%" tone="emerald" />
              <PulseItem label="Active learners" value="1,284" tone="amber" />
              <PulseItem label="Deploy queue" value="3 shipping today" tone="slate" />
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--paper)' }}>
            <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 20 }} className="md:p-6">{children}</main>
            {rightPanel && (
              <aside style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--line)', background: 'var(--surface)', padding: 16, display: 'none' }} className="xl:block">
                {rightPanel}
              </aside>
            )}
          </div>
        </div>
      </div>

      {paletteOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'start', background: 'rgba(10,14,31,0.45)', padding: '12vh 16px 16px' }}>
          <div style={{ width: '100%', maxWidth: 640, overflow: 'hidden', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ borderBottom: '1px solid var(--line)', padding: 12 }}>
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Type a command or route..."
                style={{ width: '100%', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface-2)', padding: '8px 12px', fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'var(--font-sans)' }}
              />
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => { command.run(); setPaletteOpen(false); }}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', borderRadius: 7, padding: '8px 12px', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'var(--font-sans)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{command.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--mute)' }}>{command.hint}</span>
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <p style={{ padding: '16px 12px', fontSize: 13, color: 'var(--mute)' }}>No matching command.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', background: 'rgba(10,14,31,0.45)', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 440, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: 20, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>Create workspace item</h3>
            <p style={{ fontSize: 13, color: 'var(--mute)', margin: '0 0 16px' }}>Track personal startup work directly in your panel.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['task', 'note', 'reminder'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setCreateType(kind)}
                    style={{
                      borderRadius: 7,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      border: createType === kind ? 'none' : '1px solid var(--line)',
                      background: createType === kind ? 'var(--cobalt)' : 'var(--surface)',
                      color: createType === kind ? '#fff' : 'var(--ink)',
                    }}
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
                style={{ borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface-2)', padding: '8px 12px', fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'var(--font-sans)' }}
              />
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setCreateOpen(false)} style={{ borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface)', padding: '7px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={createItem} style={{ borderRadius: 7, background: 'var(--cobalt)', padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {inboxOpen && (
        <div style={{ position: 'fixed', right: 16, top: 72, zIndex: 50, width: 360, maxWidth: 'calc(100vw - 2rem)', overflow: 'hidden', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '12px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Notifications</h3>
            <button type="button" onClick={markAllRead} style={{ fontSize: 12, fontWeight: 500, color: 'var(--cobalt)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Mark all read
            </button>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
            {events.map((event) => (
              <article key={event.id} style={{ borderRadius: 7, padding: '8px 12px', cursor: 'default' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{event.title}</p>
                  <span style={{ fontSize: 11, color: 'var(--mute)', flexShrink: 0 }}>{event.time}</span>
                </div>
                <p style={{ marginTop: 2, fontSize: 12, color: 'var(--mute)', margin: '2px 0 0' }}>{event.detail}</p>
                {event.unread && <span style={{ marginTop: 4, display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--cobalt)' }} />}
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
  const dotColor =
    tone === 'brand'
      ? 'var(--cobalt)'
      : tone === 'emerald'
        ? 'var(--good)'
        : tone === 'amber'
          ? 'var(--synth)'
          : 'var(--mute)';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: dotColor, opacity: 0.4, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
        <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
      </span>
      <span style={{ color: 'var(--mute)' }}>{label}:</span>
      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
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
