import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  listening: boolean;
  transcript: string;
}

export function LiveCaption({ listening, transcript }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (listening) {
      setVisible(true);
      return;
    }
    // Linger briefly after stop so the user can read the final caption.
    const id = window.setTimeout(() => setVisible(false), 800);
    return () => window.clearTimeout(id);
  }, [listening]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="live-caption"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          className="mx-auto w-full max-w-3xl px-4 md:px-6"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mb-1 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-1.5 text-xs text-brand-700">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
            </span>
            <span className="font-medium">
              {t('chat.voice.listening_prefix')}
            </span>
            {transcript && (
              <span className="truncate italic text-brand-900">
                {transcript}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
