import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Citation } from '@vitality/shared';

interface Props {
  citations: Citation[];
  assistantMessageId: string;
}

export function CitationList({ citations, assistantMessageId }: Props) {
  const { t } = useTranslation();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (citations.length === 0) return null;

  const toggle = (idx: number) => setOpenIdx((cur) => (cur === idx ? null : idx));

  return (
    <div className="mt-3 border-t border-ink-200 pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {t('chat.citations')}
      </p>
      <ul className="flex flex-wrap gap-2">
        {citations.map((c, i) => {
          const idx = i + 1;
          const open = openIdx === i;
          const chipId = `cite-${assistantMessageId}-${idx}`;
          return (
            <li key={c.chunkId} className="max-w-full">
              <button
                id={chipId}
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={open}
                aria-controls={`${chipId}-panel`}
                className={
                  'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                  (open
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/40')
                }
              >
                <span className="grid h-4 w-4 flex-none place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {idx}
                </span>
                <span className="truncate">{c.sourceDoc}</span>
                {c.page !== undefined && (
                  <span className="font-mono text-[10px] text-ink-500">
                    {t('chat.citation_page', { page: c.page })}
                  </span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`${chipId}-panel`}
                    role="region"
                    aria-labelledby={chipId}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="mt-2 overflow-hidden"
                  >
                    <div className="rounded-xl border border-ink-200 bg-ink-50 p-3 text-xs leading-relaxed text-ink-800">
                      <p className="whitespace-pre-wrap">{c.snippet}</p>
                      <p className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-500">
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-ink-700">
                          {c.lang.toUpperCase()}
                        </span>
                        <span>{c.sourceDoc}</span>
                        {c.page !== undefined && (
                          <span>· {t('chat.citation_page', { page: c.page })}</span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
