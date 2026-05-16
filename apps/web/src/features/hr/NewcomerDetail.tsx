import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { ScenarioRun } from '@vitality/shared';
import { useAuth } from '../auth/AuthProvider';
import { hrApi, HrHttpError, type NewcomerDetailDto } from '../../lib/api';
import { DeadlineBadge } from './DeadlineBadge';
import { MentorPicker } from './MentorPicker';
import { ErpShell } from '../workspace/ErpShell';
import { buildWorkspaceSections } from '../workspace/navigation';

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

  return (
    <ErpShell
      title={t('hr.title')}
      subtitle={t('hr.subtitle')}
      userName={profile?.fullName ?? 'HR Manager'}
      userRole={t('auth.role_hr_name')}
      sections={buildWorkspaceSections()}
      searchPlaceholder="Search by newcomer, mentor, or run id"
      topActions={
        <button
          type="button"
          onClick={() => navigate('/hr')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('hr.newcomer_detail.back')}
        </button>
      }
    >
      <section className="space-y-4">
        {err && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {err}
          </div>
        )}

        {!data ? (
          <p className="text-sm text-ink-500">…</p>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-ink-900">
                    {data.newcomer.fullName}
                  </h1>
                  {data.newcomer.department && (
                    <p className="mt-1 text-sm text-ink-500">
                      {data.newcomer.department}
                      {data.newcomer.position ? ` · ${data.newcomer.position}` : ''}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-ink-500">
                      {t('hr.newcomer_detail.started')}:{' '}
                      <span className="font-medium text-ink-800 tabular-nums">
                        {formatDate(data.newcomer.startDate)}
                      </span>
                    </span>
                    <span className="text-ink-500">
                      {t('hr.newcomer_detail.deadline')}:{' '}
                    </span>
                    <DeadlineBadge deadline={data.newcomer.onboardingDeadline} />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                  {t('hr.newcomer_detail.current_mentor')}
                </h2>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    {data.mentor ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                  </button>
                  {data.mentor && (
                    <button
                      type="button"
                      onClick={() => void handleUnassign()}
                      className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                    >
                      {t('hr.newcomers.unassign')}
                    </button>
                  )}
                </div>
              </div>
              {data.mentor ? (
                <div className="mt-3">
                  <p className="text-lg font-semibold text-ink-900">{data.mentor.fullName}</p>
                  {data.mentor.department && (
                    <p className="text-xs text-ink-500">{data.mentor.department}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {data.mentor.languages.map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                      >
                        {l.toUpperCase()}
                      </span>
                    ))}
                    {data.mentor.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-rose-600">{t('hr.newcomers.no_mentor')}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                {t('hr.newcomer_detail.recent_runs')}
              </h2>
              {data.recentRuns.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">{t('hr.newcomer_detail.no_runs')}</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-ink-100">
                  <table className="min-w-full text-sm">
                    <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="px-3 py-2">{t('hr.newcomer_detail.scenario')}</th>
                        <th className="px-3 py-2">{t('hr.newcomer_detail.score')}</th>
                        <th className="px-3 py-2">{t('hr.newcomer_detail.date')}</th>
                        <th className="px-3 py-2 text-right">{t('hr.newcomer_detail.open_run')}</th>
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
            </motion.div>
          </>
        )}
      </section>

      {pickerOpen && (
        <MentorPicker
          newcomerId={id}
          employeesById={data?.mentor ? { [data.mentor.id]: data.mentor } : undefined}
          onClose={() => setPickerOpen(false)}
          onAssigned={() => void refetch()}
        />
      )}
    </ErpShell>
  );
}

function RunRow({ run }: { run: ScenarioRun }) {
  const isKyc = run.scenarioId === 'kyc';
  return (
    <tr className="border-t border-ink-100">
      <td className="px-3 py-2 text-ink-900">{run.scenarioId}</td>
      <td className="px-3 py-2 text-ink-800 tabular-nums">
        {run.score !== undefined ? run.score : '—'}
      </td>
      <td className="px-3 py-2 text-ink-700 tabular-nums">
        {formatDate(run.finishedAt ?? run.startedAt)}
      </td>
      <td className="px-3 py-2 text-right">
        {isKyc ? (
          <Link
            to={`/simulator/kyc/${encodeURIComponent(run.id)}`}
            className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            {run.id.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-xs text-ink-500">{run.id.slice(0, 8)}</span>
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
