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
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <p className="mb-2 font-mono-tech text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
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
                  'inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ring-1 ' +
                  (open
                    ? 'bg-mentora-50 text-mentora-700 ring-mentora-200'
                    : 'bg-white text-[var(--ink-warm-2)] ring-zinc-200 hover:bg-mentora-50/40 hover:ring-mentora-200')
                }
              >
                <span className="grid h-4 w-4 flex-none place-items-center rounded-full bg-mentora-600 font-mono-tech text-[10px] font-bold text-white">
                  {idx}
                </span>
                <span className="truncate">{c.sourceDoc}</span>
                {c.page !== undefined && (
                  <span className="font-mono-tech text-[10px] text-[var(--muted-warm)]">
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
                    <div className="rounded-2xl bg-cream-50 p-3 text-xs leading-relaxed text-[var(--ink-warm)] ring-1 ring-zinc-100">
                      <p className="whitespace-pre-wrap">{c.snippet}</p>
                      <p className="mt-2 flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-wider text-[var(--muted-warm)]">
                        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--ink-warm-2)] ring-1 ring-zinc-200">
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
