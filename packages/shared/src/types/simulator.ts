import type { Locale } from './locale';

export type ScenarioId = 'kyc' | 'open-account' | 'deposit' | 'transfer';

export type ScenarioStatus = 'not_started' | 'in_progress' | 'scored' | 'aborted';

export interface ScenarioStepDef {
  id: string;
  titleKey: string;
  hintKey?: string;
  required: boolean;
}

export interface ScenarioRun {
  id: string;
  scenarioId: ScenarioId;
  userId: string;
  locale: Locale;
  status: ScenarioStatus;
  currentStepId: string | null;
  startedAt: string;
  finishedAt?: string;
  score?: number;
  mistakes?: ScenarioMistake[];
  /** Scenario-specific jsonb state (synthetic fixtures, step progress). */
  state?: Record<string, unknown>;
}

export interface ScenarioMistake {
  stepId: string;
  code: string;
  messageKey: string;
  penalty: number;
}

export interface AiHintRequest {
  runId: string;
  stepId: string;
  locale: Locale;
  context: Record<string, unknown>;
}

export interface AiHintResponse {
  hint: string;
  rationale: string;
  citations: string[];
}
