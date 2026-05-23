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

// ──────────────────────────────────────────────────────────────────────────
// HintPanel — reference theme (Phase 7).
//
// Right-side slide-over presenting an AI-generated hint for the current
// simulator step. API surface and state machine are unchanged — only the
// visual treatment was rebased onto reference tokens.
// ──────────────────────────────────────────────────────────────────────────

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
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(10, 14, 31, 0.32)' }}
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col"
            style={{
              background: 'var(--surface)',
              borderLeft: '1px solid var(--line)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-sans)',
              boxShadow: 'var(--shadow-lg)',
            }}
            role="dialog"
            aria-label={t('sim.run.hint')}
          >
            <header
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="grid h-8 w-8 place-items-center"
                  style={{
                    background: 'var(--cobalt)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--r-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    boxShadow: 'var(--shadow-cobalt)',
                  }}
                >
                  AI
                </div>
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t('sim.run.hint')}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('sim.back')}
                data-clicky-target="close, dismiss, hide, hint, back, exit"
                data-clicky-hint="Close the hint panel and return to the scenario."
                className="grid place-items-center transition-colors"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--r-sm)',
                  background: 'transparent',
                  color: 'var(--mute)',
                  border: 0,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.color = 'var(--ink)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--mute)';
                }}
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
                  className="inline-flex items-center gap-2"
                  role="status"
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    color: 'var(--mute)',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <span className="sr-only">{t('sim.run.hint_loading')}</span>
                  <span aria-hidden="true" className="flex items-end gap-1">
                    {[0, 0.15, 0.3].map((delay) => (
                      <motion.span
                        key={delay}
                        className="block h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--cobalt)' }}
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
                  style={{
                    background: 'var(--bad-tint)',
                    border: '1px solid rgba(200, 53, 28, 0.2)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 14px',
                    fontSize: 13,
                    color: 'var(--bad)',
                  }}
                >
                  {error}
                </div>
              )}

              {hint && !loading && (
                <div className="space-y-4">
                  <p
                    style={{
                      fontSize: 15.5,
                      fontWeight: 500,
                      lineHeight: 1.55,
                      color: 'var(--cobalt-deep)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {hint.hint}
                  </p>
                  {hint.rationale && (
                    <p
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: 'var(--mute)',
                      }}
                    >
                      {hint.rationale}
                    </p>
                  )}
                  {hint.citations.length > 0 && (
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        paddingTop: 16,
                      }}
                    >
                      <p
                        style={{
                          marginBottom: 8,
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--mute-2)',
                        }}
                      >
                        {t('sim.run.hint_citations')}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {hint.citations.map((cite) => (
                          <li
                            key={cite}
                            style={{
                              borderRadius: '999px',
                              padding: '4px 10px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: 'var(--ink-2)',
                              background: 'var(--cobalt-tint)',
                              border: '1px solid var(--cobalt-tint-2)',
                            }}
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
