import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface Props {
  onPick: (question: string) => void;
}

export function EmptyState({ onPick }: Props) {
  const { t } = useTranslation();
  const samples = t('chat.sample_questions', { returnObjects: true }) as unknown;
  const list: string[] = Array.isArray(samples)
    ? (samples as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-2xl text-center"
      >
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
          {t('chat.empty_title')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-600 md:text-base">
          {t('chat.empty_subtitle')}
        </p>
        {list.length > 0 && (
          <ul className="mt-7 grid gap-3 sm:grid-cols-3">
            {list.map((q, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onPick(q)}
                  className="group flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-ink-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 group-hover:bg-brand-100">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug text-ink-800">{q}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
