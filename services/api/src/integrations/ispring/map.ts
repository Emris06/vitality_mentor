/**
 * Game-event → iSpring `SubmitResultInput` translation.
 *
 * Course-id scheme: `course.vit.<snake_case>`. The mock iSpring server seeds
 * these exact ids so a roundtrip works end-to-end out of the box. Add new
 * scenario→course mappings here when new simulators ship.
 *
 * Idempotency keys are *external* — they're the truth iSpring uses to dedupe.
 * For sim runs, runId is unique-per-attempt. For module completions, a user
 * can only complete a module once (modulo retakes that bump the moduleId),
 * so user+module is the right grain.
 */

import type { ModuleCompletedEvent, SimScoredEvent } from '../../gamification/events';
import type { SubmitResultInput } from './types';

const SIM_SCENARIO_TO_COURSE: Record<string, string> = {
  kyc: 'course.vit.kyc',
  'open-account': 'course.vit.open_account',
  deposit: 'course.vit.deposit',
  transfer: 'course.vit.transfer',
};

// Fallback for unmapped scenario ids — normalise (`open-account` → `open_account`).
function deriveCourseId(scenarioId: string): string {
  const mapped = SIM_SCENARIO_TO_COURSE[scenarioId];
  if (mapped) return mapped;
  const slug = scenarioId.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
  return `course.vit.${slug || 'unknown'}`;
}

export function mapSimScoredToResult(event: SimScoredEvent): SubmitResultInput {
  const score = clamp01_100(event.score);
  return {
    idempotencyKey: `sim:${event.runId}`,
    userId: event.userId,
    courseId: deriveCourseId(event.scenarioId),
    score,
    passed: score >= 60,
    completedAt: new Date().toISOString(),
    metadata: {
      kind: 'sim_scored',
      scenarioId: event.scenarioId,
      runId: event.runId,
      mistakes: event.mistakes ?? [],
    },
  };
}

export function mapModuleCompletedToResult(event: ModuleCompletedEvent): SubmitResultInput {
  const score = clamp01_100(event.score);
  return {
    idempotencyKey: `module:${event.moduleId}:${event.userId}`,
    userId: event.userId,
    // Training-module ids are already course-ish; if a module corresponds to a
    // dedicated iSpring course we pass it through, otherwise we wrap it.
    courseId: event.moduleId.startsWith('course.') ? event.moduleId : `course.vit.${event.moduleId}`,
    score,
    passed: score >= 60,
    completedAt: new Date().toISOString(),
    metadata: {
      kind: 'module_completed',
      moduleId: event.moduleId,
    },
  };
}

function clamp01_100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
