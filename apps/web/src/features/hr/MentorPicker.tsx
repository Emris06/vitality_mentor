import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { Employee } from '@vitality/shared';
import { hrApi, HrHttpError, type MatchCandidate } from '../../lib/api';

interface MentorPickerProps {
  newcomerId: string;
  /** Map of employeeId → Employee, used to render name/department when match
   *  payload only has mentorId. Optional; falls back to the mentorId. */
  employeesById?: Record<string, Employee>;
  onClose: () => void;
  onAssigned: (mentorId: string) => void;
}

function toneFor(score: number): string {
  if (score >= 85) return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  return 'bg-ink-100 text-ink-700 ring-1 ring-ink-200';
}

/**
 * Modal dialog showing top-5 suggested mentors. Uses a plain fixed overlay —
 * no portal library. ESC and backdrop click both close. Assigning triggers the
 * parent callback so the surrounding dashboard can refetch its slice.
 *
 * TODO(i18n): match reasons come from the backend as English strings. Once
 * the backend supports localized reason codes, swap to t(reason).
 */
export function MentorPicker({
  newcomerId,
  employeesById,
  onClose,
  onAssigned,
}: MentorPickerProps) {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  // Load suggestions on mount.
  useEffect(() => {
    let cancelled = false;
    setCandidates(null);
    setError(null);
    void (async () => {
      try {
        const result = await hrApi.match(newcomerId);
        if (cancelled) return;
        const sorted = [...result].sort((a, b) => b.score - a.score).slice(0, 5);
        setCandidates(sorted);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof HrHttpError ? err.message : 'match_failed');
        setCandidates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [newcomerId]);

  // Close on ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sorted = useMemo(() => candidates ?? [], [candidates]);

  const handleAssign = async (mentorId: string) => {
    setAssigning(mentorId);
    setError(null);
    try {
      await hrApi.assign(newcomerId, mentorId);
      onAssigned(mentorId);
      onClose();
    } catch (err) {
      setError(err instanceof HrHttpError ? err.message : 'assign_failed');
      setAssigning(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm md:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={t('hr.mentor_picker.title')}
      >
        <motion.div
          key="panel"
          className="w-full max-w-2xl rounded-t-2xl bg-white p-6 shadow-xl md:rounded-2xl"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">{t('hr.mentor_picker.title')}</h2>
              <p className="mt-1 text-sm text-ink-600">{t('hr.mentor_picker.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              {t('hr.mentor_picker.cancel')}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {error}
            </div>
          )}

          <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {candidates === null && (
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-6 text-center text-sm text-ink-600">
                {t('hr.mentor_picker.loading')}
              </div>
            )}

            {candidates && sorted.length === 0 && (
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-6 text-center text-sm text-ink-600">
                {t('hr.mentor_picker.no_candidates')}
              </div>
            )}

            {sorted.map((c, idx) => {
              const emp = employeesById?.[c.mentorId];
              const name = emp?.fullName ?? c.mentorId;
              const department = emp?.department;
              const score = Math.round(c.score);
              return (
                <motion.div
                  key={c.mentorId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut', delay: idx * 0.04 }}
                  className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink-900">{name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${toneFor(score)}`}
                          title={t('hr.mentor_picker.score') ?? undefined}
                        >
                          {score}
                        </span>
                      </div>
                      {department && (
                        <p className="mt-1 text-xs uppercase tracking-wide text-ink-500">{department}</p>
                      )}
                      {c.reasons.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-600">
                          {c.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAssign(c.mentorId)}
                      disabled={assigning !== null}
                      className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {assigning === c.mentorId ? '…' : t('hr.mentor_picker.assign')}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
