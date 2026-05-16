import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import {
  ErpShell,
  IconBook,
  IconChart,
  IconPeople,
  IconRocket,
  IconShield,
} from './ErpShell';
import { buildWorkspaceSections } from './navigation';

interface KpiCard {
  label: string;
  value: string;
  delta: string;
}

const KPI_CARDS: KpiCard[] = [
  { label: 'Total Staff', value: '250', delta: '+12 vs last quarter' },
  { label: 'Applications', value: '200', delta: '+0.2% vs last quarter' },
  { label: 'Total Projects', value: '38', delta: '+4% vs last quarter' },
  { label: 'Departments', value: '8', delta: 'No change' },
];

const PAYMENT_ROWS = [
  { id: '01', subject: 'Request for FARS for October 2022', date: '25/10/2025', status: 'Pending' },
  { id: '02', subject: 'Project proposal fee', date: '19/10/2025', status: 'Approved' },
  { id: '03', subject: 'Request for FARS for October 2022', date: '10/10/2025', status: 'Approved' },
  { id: '04', subject: 'Project proposal fee', date: '03/10/2025', status: 'Pending' },
];

const BUDGET_ROWS = [
  { id: '01', budget: '00211235', planned: '$1,400,000', actual: '$1,380,000', date: '25/10/2025' },
  { id: '02', budget: '36211235', planned: '$400,000', actual: '$500,000', date: '22/10/2025' },
  { id: '03', budget: '00214465', planned: '$2,000,000', actual: '$1,400,000', date: '20/10/2025' },
  { id: '04', budget: '00214465', planned: '$800,000', actual: '$1,800,000', date: '20/10/2025' },
];

export function EmployeeDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const welcomeName = useMemo(() => profile?.fullName ?? 'Team Member', [profile?.fullName]);

  return (
    <ErpShell
      title="Employee Workspace"
      subtitle="Operations Dashboard"
      userName={welcomeName}
      userRole={t('auth.role_employee_name')}
      sections={buildWorkspaceSections(profile?.role ?? null)}
      searchPlaceholder="Search vouchers, payroll, and staff records"
      rightPanel={<EmployeeRightRail />}
      topActions={
        <div className="hidden items-center gap-2 lg:flex">
          <button type="button" className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">Sep 11 - Oct 10</button>
          <button type="button" className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">Monthly</button>
          <button type="button" className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">Filter</button>
          <button type="button" className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">Export</button>
        </div>
      }
    >
      <section className="space-y-4">
        <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
          <h1 className="font-display text-3xl text-ink-900">Welcome {welcomeName}</h1>
          <p className="mt-1 text-sm text-ink-600">Today is Saturday, 11th November 2025</p>
        </article>

        <div className="grid gap-3 lg:grid-cols-4">
          {KPI_CARDS.map((card) => (
            <article key={card.label} className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
              <p className="text-xs uppercase tracking-[0.08em] text-ink-500">{card.label}</p>
              <p className="mt-2 font-display text-3xl tabular text-ink-900">{card.value}</p>
              <p className="mt-2 text-xs text-success-600">{card.delta}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">Staff applications</h2>
              <span className="text-ink-500">...</span>
            </div>
            <div className="mx-auto mb-5 grid h-48 w-48 place-items-center rounded-full border-[10px] border-brand-500/80">
              <div className="grid h-36 w-36 place-items-center rounded-full border-[8px] border-warn-500/80">
                <div className="grid h-24 w-24 place-items-center rounded-full border-[6px] border-sky-500/80 text-center">
                  <p className="font-display text-3xl tabular text-ink-900">200</p>
                  <p className="text-xs text-ink-600">Applications</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <StatPill label="Pending" value="100" tone="brand" />
              <StatPill label="Approved" value="60" tone="success" />
              <StatPill label="Rejected" value="40" tone="warn" />
            </div>
          </article>

          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">Annual payroll summary</h2>
              <span className="text-ink-500">...</span>
            </div>
            <div className="space-y-3">
              {[550, 520, 430, 610, 500].map((v, i) => (
                <div key={i} className="grid grid-cols-[42px_1fr_42px] items-center gap-2">
                  <p className="text-[11px] text-ink-500">{['30 Sep', '10 Oct', '20 Oct', '30 Oct', '10 Nov'][i]}</p>
                  <div className="h-4 rounded bg-ink-100">
                    <div className="h-4 rounded bg-gradient-to-r from-brand-600 via-warn-500 to-brand-300" style={{ width: `${Math.min(100, Math.round(v / 6.5))}%` }} />
                  </div>
                  <p className="text-right text-[11px] tabular text-ink-700">{v}k</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">Total income</h2>
              <span className="text-ink-500">...</span>
            </div>
            <p className="font-display text-4xl tabular text-ink-900">$11,800,000</p>
            <p className="mt-1 text-sm text-success-600">+21% vs last month</p>
            <div className="mt-5 h-40 rounded-lg bg-gradient-to-t from-brand-100 via-brand-50 to-white p-3">
              <div className="relative h-full w-full">
                <div className="absolute bottom-5 left-[38%] rounded-md bg-orange-500 px-2 py-1 text-xs font-semibold text-white">$3,400,849</div>
                <svg viewBox="0 0 100 40" className="absolute bottom-0 h-28 w-full text-brand-500">
                  <polyline fill="rgba(59,130,246,0.18)" stroke="none" points="0,38 25,35 45,27 70,16 100,3 100,40 0,40" />
                  <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,38 25,35 45,27 70,16 100,3" />
                </svg>
              </div>
            </div>
          </article>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">Payment vouchers</h2>
              <span className="text-ink-500">...</span>
            </div>
            <TableBlock
              headers={['S/N', 'Subject', 'Date', 'Status']}
              rows={PAYMENT_ROWS.map((row) => [row.id, row.subject, row.date, row.status])}
            />
          </article>

          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">Budget history</h2>
              <span className="text-ink-500">...</span>
            </div>
            <TableBlock
              headers={['S/N', 'Budget No.', 'Budgeted', 'Actual', 'Date']}
              rows={BUDGET_ROWS.map((row) => [row.id, row.budget, row.planned, row.actual, row.date])}
            />
          </article>
        </div>
      </section>
    </ErpShell>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'success' | 'warn';
}) {
  const toneClass =
    tone === 'brand'
      ? 'text-brand-700 bg-brand-50'
      : tone === 'success'
        ? 'text-success-700 bg-success-50'
        : 'text-warn-700 bg-warn-50';
  return (
    <div className={`rounded-md px-2 py-2 text-center ${toneClass}`}>
      <p className="font-display text-lg tabular">{value}</p>
      <p className="text-[11px]">{label}</p>
    </div>
  );
}

function TableBlock({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-ink-200">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row[0]}-${idx}`} className="border-t border-ink-100">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 text-ink-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeRightRail() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <h3 className="font-display text-lg text-ink-900">Quick access</h3>
        <div className="mt-3 space-y-2">
          <QuickLink to="/chat" icon={<IconBook />} label="AI Assistant" />
          <QuickLink to="/skills" icon={<IconChart />} label="Skills Hub" />
          <QuickLink to="/simulator" icon={<IconRocket />} label="Scenario Lab" />
          <QuickLink to="/me" icon={<IconPeople />} label="My Progress" />
        </div>
      </section>
      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <h3 className="font-display text-lg text-ink-900">Today schedule</h3>
        <div className="mt-3 space-y-2 text-sm text-ink-700">
          <p>09:00 Staff meeting</p>
          <p>11:30 Payroll check</p>
          <p>15:00 Mentor sync</p>
        </div>
      </section>
      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <h3 className="font-display text-lg text-ink-900">Team pulse</h3>
        <div className="mt-3 space-y-2 text-sm text-ink-700">
          <p>12 onboarding tasks finished today</p>
          <p>AI response p95: 1.7s</p>
          <p>3 simulator runs awaiting review</p>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span>›</span>
    </Link>
  );
}
