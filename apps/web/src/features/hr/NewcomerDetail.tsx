import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { ScenarioRun } from '@vitality/shared';
import { useAuth } from '../auth/AuthProvider';
import { hrApi, HrHttpError, type NewcomerDetailDto } from '../../lib/api';
import { DeadlineBadge } from './DeadlineBadge';
import { MentorPicker } from './MentorPicker';
import { InternShell } from '../workspace/InternShell';
import { buildMentoraNav } from '../workspace/mentoraNav';
import { WarmCard } from '../../components/warm/WarmCard';

// ──────────────────────────────────────────────────────────────────────────
// HR newcomer detail (`/hr/newcomers/:id`) — warm theme (Phase C).
//
// Same behavior as the prior ErpShell version:
//   - hrApi.getNewcomer(id) on mount, refetch on mentor change
//   - hrApi.unassign(id) wired to the unassign button
//   - MentorPicker modal preserved unchanged
//   - "Open run" deep-link → /simulator/kyc/:runId for KYC scenarios
// ──────────────────────────────────────────────────────────────────────────

export function NewcomerDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [data, setData] = useState<NewcomerDetailDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refetch = useCallback(async () => {
    setErr(null);
    try {
      const d = await hrApi.getNewcomer(id);
      setData(d);
    } catch (e) {
      setErr(e instanceof HrHttpError ? e.message : 'load_failed');
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleUnassign = useCallback(async () => {
    try {
      await hrApi.unassign(id);
      await refetch();
    } catch (e) {
      setErr(e instanceof HrHttpError ? e.message : 'unassign_failed');
    }
  }, [id, refetch]);

  const userName = profile?.fullName ?? 'HR Manager';
  const firstName = userName.split(/\s+/)[0] ?? userName;

  // Use the newcomer's full name as the page title once loaded; while loading,
  // fall back to the HR section title so the chrome doesn't flash empty.
  const pageTitle = data?.newcomer.fullName ?? t('hr.title');
  const subtitle = data?.newcomer.department
    ? `${data.newcomer.department}${data.newcomer.position ? ` · ${data.newcomer.position}` : ''}`
    : undefined;

  return (
    <InternShell
      userName={userName}
      userRole={t('auth.role_hr_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={pageTitle}
      navItems={buildMentoraNav('hr')}
      currentScenarioCta={{
        label: t('hr.newcomer_detail.back'),
        onClick: () => navigate('/hr'),
        clickyTarget: 'back, cohort, hr, dashboard, return',
        clickyHint: 'Return to the cohort dashboard.',
      }}
    >
      {err && (
        <div
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
          role="alert"
        >
          {err}
        </div>
      )}

      {!data ? (
        <div className="rounded-2xl bg-white px-6 py-8 text-center text-sm text-[var(--muted-warm)] ring-1 ring-zinc-100">
          <div className="mx-auto mb-3 h-1 w-24 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-mentora-600" />
          </div>
          {t('sim.run.loading_run')}
        </div>
      ) : (
        <>
          {/* Identity card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WarmCard className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  {subtitle && (
                    <p className="font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
                      {subtitle}
                    </p>
                  )}
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--ink-warm)]">
                    {data.newcomer.fullName}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-[var(--muted-warm)]">
                      {t('hr.newcomer_detail.started')}:{' '}
                      <span className="font-mono-tech font-bold text-[var(--ink-warm)]">
                        {formatDate(data.newcomer.startDate)}
                      </span>
                    </span>
                    <span className="text-[var(--muted-warm)]">
                      {t('hr.newcomer_detail.deadline')}:
                    </span>
                    <DeadlineBadge deadline={data.newcomer.onboardingDeadline} />
                  </div>
                </div>
              </div>
            </WarmCard>
          </motion.div>

          {/* Mentor card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <WarmCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                  {t('hr.newcomer_detail.current_mentor')}
                </h3>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    data-clicky-target={`${data.mentor ? 'reassign' : 'assign'}, mentor, pick, match`}
                    data-clicky-hint={
                      data.mentor
                        ? `Pick a different mentor for ${data.newcomer.fullName}.`
                        : `Assign a mentor to ${data.newcomer.fullName}.`
                    }
                    className="rounded-md bg-mentora-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
                  >
                    {data.mentor ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                  </button>
                  {data.mentor && (
                    <button
                      type="button"
                      onClick={() => void handleUnassign()}
                      data-clicky-target="unassign, remove, clear, mentor"
                      data-clicky-hint="Remove the current mentor from this newcomer. They'll be unassigned until you pick a new one."
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                    >
                      {t('hr.newcomers.unassign')}
                    </button>
                  )}
                </div>
              </div>
              {data.mentor ? (
                <div className="mt-3">
                  <p className="text-lg font-extrabold text-[var(--ink-warm)]">
                    {data.mentor.fullName}
                  </p>
                  {data.mentor.department && (
                    <p className="font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
                      {data.mentor.department}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {data.mentor.languages.map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-mentora-50 px-2 py-0.5 text-[11px] font-semibold text-mentora-700"
                      >
                        {l.toUpperCase()}
                      </span>
                    ))}
                    {data.mentor.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-rose-600">
                  {t('hr.newcomers.no_mentor')}
                </p>
              )}
            </WarmCard>
          </motion.div>

          {/* Recent runs */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <WarmCard className="overflow-hidden p-0">
              <div className="border-b border-zinc-100 px-6 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                  {t('hr.newcomer_detail.recent_runs')}
                </h3>
              </div>
              {data.recentRuns.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-[var(--muted-warm)]">
                  {t('hr.newcomer_detail.no_runs')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-cream-50 text-left font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{t('hr.newcomer_detail.scenario')}</th>
                        <th className="px-4 py-3 font-semibold">{t('hr.newcomer_detail.score')}</th>
                        <th className="px-4 py-3 font-semibold">{t('hr.newcomer_detail.date')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('hr.newcomer_detail.open_run')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentRuns.map((r) => (
                        <RunRow key={r.id} run={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </WarmCard>
          </motion.div>
        </>
      )}

      {pickerOpen && (
        <MentorPicker
          newcomerId={id}
          employeesById={data?.mentor ? { [data.mentor.id]: data.mentor } : undefined}
          onClose={() => setPickerOpen(false)}
          onAssigned={() => void refetch()}
        />
      )}
    </InternShell>
  );
}

function RunRow({ run }: { run: ScenarioRun }) {
  const isKyc = run.scenarioId === 'kyc';
  const score = run.score;
  const scoreClass =
    score === undefined
      ? 'text-[var(--muted-warm)]'
      : score >= 85
        ? 'bg-emerald-50 text-emerald-700'
        : score >= 60
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700';
  const shortId = run.id.slice(0, 8);
  return (
    <tr className="border-t border-zinc-100 hover:bg-cream-50">
      <td className="px-4 py-3 font-bold text-[var(--ink-warm)]">{run.scenarioId}</td>
      <td className="px-4 py-3">
        {score === undefined ? (
          <span className="font-mono-tech text-[var(--muted-warm)]">—</span>
        ) : (
          <span className={`inline-flex rounded-full px-2 py-0.5 font-mono-tech text-xs font-bold ${scoreClass}`}>
            {score}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono-tech text-[var(--ink-warm-2)]">
        {formatDate(run.finishedAt ?? run.startedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {isKyc ? (
          <Link
            to={`/simulator/kyc/${encodeURIComponent(run.id)}`}
            data-clicky-target={`open, run, ${shortId.toLowerCase()}, kyc, replay`}
            data-clicky-hint={`Open run ${shortId} in the KYC simulator chrome.`}
            className="inline-flex rounded-md bg-mentora-50 px-3 py-1 font-mono-tech text-xs font-bold text-mentora-700 transition hover:bg-mentora-100"
          >
            {shortId}
          </Link>
        ) : (
          <span className="font-mono-tech text-xs text-[var(--muted-warm)]">{shortId}</span>
        )}
      </td>
    </tr>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}
