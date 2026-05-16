import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface SidebarSection {
  label?: string;
  items: SidebarItemDef[];
}

export interface SidebarItemDef {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
  end?: boolean;
}

interface SidebarProps {
  brand: ReactNode;
  sections: SidebarSection[];
  footer?: ReactNode;
}

export function Sidebar({ brand, sections, footer }: SidebarProps) {
  return (
    <aside className="hidden h-screen w-[244px] shrink-0 flex-col border-r border-ink-200 bg-[var(--sidebar)] md:flex">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">{brand}</div>

      <nav className="flex-1 overflow-y-auto scrollarea px-3 py-2">
        {sections.map((section, i) => (
          <div key={i} className="mb-4">
            {section.label && (
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                {section.label}
              </p>
            )}
            <ul>
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarItem {...item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {footer && <div className="border-t border-slate-200 p-3">{footer}</div>}
    </aside>
  );
}

export function SidebarItem({ to, icon, label, badge, end }: SidebarItemDef) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group relative my-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-100 text-brand-700'
            : 'text-ink-700 hover:bg-white/90 hover:text-ink-900',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={isActive ? 'text-brand-600' : 'text-ink-500 group-hover:text-ink-700'}
          >
            {icon}
          </span>
          <span className="flex-1">{label}</span>
          {badge}
          {isActive && (
            <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />
          )}
        </>
      )}
    </NavLink>
  );
}
