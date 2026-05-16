import { Fragment, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@vitality/shared';
import { CitationList } from './CitationList';

interface Props {
  message: ChatMessage;
}

// Splits `text` into a sequence of plain strings and citation refs like `[1]`.
// Only refs whose number is in `validRefs` become interactive badges.
function splitWithCitations(
  text: string,
  validRefs: Set<number>,
): Array<{ kind: 'text'; value: string } | { kind: 'ref'; n: number; raw: string }> {
  const out: Array<{ kind: 'text'; value: string } | { kind: 'ref'; n: number; raw: string }> = [];
  const re = /\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (!validRefs.has(n)) continue;
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    out.push({ kind: 'ref', n, raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

export function MessageBubble({ message }: Props) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  const validRefs = useMemo(() => {
    const set = new Set<number>();
    (message.citations ?? []).forEach((_, i) => set.add(i + 1));
    return set;
  }, [message.citations]);

  const parts = useMemo(
    () => splitWithCitations(message.content, validRefs),
    [message.content, validRefs],
  );

  const focusCitation = (n: number) => {
    const id = `cite-${message.id}-${n}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.focus();
      // Open the panel if it's currently collapsed.
      if (el.getAttribute('aria-expanded') === 'false') {
        el.click();
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={'flex w-full ' + (isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={'flex max-w-[85%] flex-col gap-1 md:max-w-[75%] ' + (isUser ? 'items-end' : 'items-start')}>
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          {isUser ? t('chat.you') : t('chat.assistant')}
        </span>
        <div
          className={
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ' +
            (isUser
              ? 'bg-brand-600 text-white'
              : 'border border-ink-200 bg-white text-ink-900')
          }
        >
          <p className="whitespace-pre-wrap break-words">
            {parts.length === 0 ? (
              <span className="text-ink-400">&nbsp;</span>
            ) : (
              parts.map((p, i) =>
                p.kind === 'text' ? (
                  <Fragment key={i}>{p.value}</Fragment>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => focusCitation(p.n)}
                    className={
                      'mx-0.5 inline-flex h-5 w-5 -translate-y-px items-center justify-center rounded-full text-[10px] font-bold transition-colors ' +
                      (isUser
                        ? 'bg-white/25 text-white hover:bg-white/40'
                        : 'bg-brand-100 text-brand-700 hover:bg-brand-200')
                    }
                    aria-label={`${t('chat.citations')} ${p.n}`}
                  >
                    {p.n}
                  </button>
                ),
              )
            )}
          </p>

          {!isUser && message.citations && message.citations.length > 0 && (
            <CitationList citations={message.citations} assistantMessageId={message.id} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
