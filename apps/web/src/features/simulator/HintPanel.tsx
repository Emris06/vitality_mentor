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
            className="fixed inset-0 z-40 bg-zinc-900/30"
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white font-tech shadow-card-warm ring-1 ring-zinc-200"
            role="dialog"
            aria-label={t('sim.run.hint')}
          >
            <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-mentora-600 font-mono-tech text-xs font-bold text-white">
                  AI
                </div>
                <h2 className="text-base font-semibold text-zinc-900">{t('sim.run.hint')}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('sim.back')}
                data-clicky-target="close, dismiss, hide, hint, back, exit"
                data-clicky-hint="Close the hint panel and return to the scenario."
                className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
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
                  className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200"
                  role="status"
                >
                  <span className="sr-only">{t('sim.run.hint_loading')}</span>
                  <span aria-hidden="true" className="flex items-end gap-1">
                    {[0, 0.15, 0.3].map((delay) => (
                      <motion.span
                        key={delay}
                        className="block h-1.5 w-1.5 rounded-full bg-mentora-600"
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
                  className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
                >
                  {error}
                </div>
              )}

              {hint && !loading && (
                <div className="space-y-4">
                  <p className="text-base font-semibold leading-relaxed text-mentora-700">
                    {hint.hint}
                  </p>
                  {hint.rationale && (
                    <p className="text-sm leading-relaxed text-zinc-700">{hint.rationale}</p>
                  )}
                  {hint.citations.length > 0 && (
                    <div className="border-t border-zinc-200 pt-4">
                      <p className="mb-2 font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t('sim.run.hint_citations')}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {hint.citations.map((cite) => (
                          <li
                            key={cite}
                            className="rounded-full bg-zinc-50 px-2.5 py-1 font-mono-tech text-xs text-zinc-700 ring-1 ring-zinc-200"
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
