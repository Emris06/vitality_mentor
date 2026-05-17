import type { ScenarioId } from '@vitality/shared';
import type { ScenarioDef } from '../engine';
import { ScenarioRunner } from '../engine';
import { KycScenario, type KycState } from './kyc';
import { OpenAccountScenario, type OpenAccountState } from './open-account';
import { DepositScenario, type DepositState } from './deposit';
import { TransferScenario, type TransferState } from './transfer';

export class NotImplementedScenarioError extends Error {
  constructor(public readonly scenarioId: ScenarioId) {
    super(`scenario_not_implemented:${scenarioId}`);
    this.name = 'NotImplementedScenarioError';
  }
}

// All four scenarios are implemented. Order here mirrors the simulator
// dashboard's display order.
const REGISTRY: Partial<Record<ScenarioId, ScenarioDef<any>>> = {
  kyc: KycScenario,
  'open-account': OpenAccountScenario,
  deposit: DepositScenario,
  transfer: TransferScenario,
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

export {
  KycScenario,
  type KycState,
  OpenAccountScenario,
  type OpenAccountState,
  DepositScenario,
  type DepositState,
  TransferScenario,
  type TransferState,
};
