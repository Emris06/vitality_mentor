import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { useClicky, useClickyEnabled } from '../clicky/ClickyProvider';
import { useClickyAgent } from '../clicky/useClickyAgent';
import { speak } from '../clicky/tts';

export interface UseScenarioClickyOpts {
  stepHints: Record<string, string>;
  enabled?: boolean;
}

/**
 * Shared Clicky + TTS wiring for ScenarioRunPage-based simulator flows.
 */
export function useScenarioClicky(opts: UseScenarioClickyOpts) {
  const { stepHints, enabled = true } = opts;
  const { i18n } = useTranslation();
  const locale: Locale = (() => {
    const r = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(r) ? r : DEFAULT_LOCALE;
  })();

  useClickyEnabled(enabled);
  const agent = useClickyAgent({ enabled });
  const { setSpeaking } = useClicky();

  const onStepSuccess = useCallback(
    (nextStepId: string | null | undefined) => {
      const nextHint = nextStepId
        ? (stepHints[nextStepId] ?? 'Next step is up.')
        : 'All steps done. Let me show you the score.';
      speak(`Nice. ${nextHint}`, {
        locale,
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [locale, setSpeaking, stepHints],
  );

  const onStepMistake = useCallback(
    (message: string) => {
      speak(`Not quite. ${message}. Try again, you can't break anything.`, {
        locale,
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [locale, setSpeaking],
  );

  return { agent, onStepSuccess, onStepMistake };
}
