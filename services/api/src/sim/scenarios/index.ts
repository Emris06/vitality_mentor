import type { ScenarioId } from '@vitality/shared';
import type { ScenarioDef } from '../engine';
import { ScenarioRunner } from '../engine';
import { KycScenario, type KycState } from './kyc';

export class NotImplementedScenarioError extends Error {
  constructor(public readonly scenarioId: ScenarioId) {
    super(`scenario_not_implemented:${scenarioId}`);
    this.name = 'NotImplementedScenarioError';
  }
}

// Registry. Only `kyc` is implemented right now; the others are placeholders
// so the frontend can list them but `getRunner` will throw.
//
// TODO(simulator): implement open-account, deposit, transfer scenarios.
const REGISTRY: Partial<Record<ScenarioId, ScenarioDef<any>>> = {
  kyc: KycScenario,
};

const RUNNER_CACHE = new Map<ScenarioId, ScenarioRunner<any>>();

export function getRunner(scenarioId: ScenarioId): ScenarioRunner<Record<string, unknown>> {
  const cached = RUNNER_CACHE.get(scenarioId);
  if (cached) return cached;
  const def = REGISTRY[scenarioId];
  if (!def) throw new NotImplementedScenarioError(scenarioId);
  const runner = new ScenarioRunner<Record<string, unknown>>(def);
  RUNNER_CACHE.set(scenarioId, runner);
  return runner;
}

export function isImplemented(scenarioId: ScenarioId): boolean {
  return REGISTRY[scenarioId] !== undefined;
}

export { KycScenario, type KycState };
