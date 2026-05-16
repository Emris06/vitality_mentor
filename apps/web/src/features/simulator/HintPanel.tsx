import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AiHintResponse } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';

interface HintPanelProps {
  open: boolean;
  onClose: () => void;
  runId: string;
  stepId: string | null;
}

export function HintPanel({ open, onClose, runId, stepId }: HintPanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<AiHintResponse | null>(null);

  // Refetch each time the panel opens for the current step.
  useEffect(() => {
    if (!open || !stepId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHint(null);
    simApi
      .getHint(runId, stepId)
      .then((result) => {
        if (!cancelled) setHint(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof SimHttpError ? err.message : t('chat.error_generic');
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, runId, stepId, t]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/30"
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-ink-300 bg-white shadow-2xl"
            role="dialog"
            aria-label={t('sim.run.hint')}
          >
            <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  AI
                </div>
                <h2 className="text-base font-semibold text-ink-900">{t('sim.run.hint')}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('sim.back')}
                className="rounded-full p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loading && (
                <div
                  className="inline-flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600 shadow-sm"
                  role="status"
                >
                  <span className="sr-only">{t('sim.run.hint_loading')}</span>
                  <span aria-hidden="true" className="flex items-end gap-1">
                    {[0, 0.15, 0.3].map((delay) => (
                      <motion.span
                        key={delay}
                        className="block h-1.5 w-1.5 rounded-full bg-brand-600"
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay,
                        }}
                      />
                    ))}
                  </span>
                  <span>{t('sim.run.hint_loading')}</span>
                </div>
              )}

              {error && !loading && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {error}
                </div>
              )}

              {hint && !loading && (
                <div className="space-y-4">
                  <p className="text-base font-semibold leading-relaxed text-brand-700">
                    {hint.hint}
                  </p>
                  {hint.rationale && (
                    <p className="text-sm leading-relaxed text-ink-700">{hint.rationale}</p>
                  )}
                  {hint.citations.length > 0 && (
                    <div className="border-t border-ink-200 pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {t('sim.run.hint_citations')}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {hint.citations.map((cite) => (
                          <li
                            key={cite}
                            className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs text-ink-700 tabular-nums"
                          >
                            {cite}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
