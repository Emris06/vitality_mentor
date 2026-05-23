import type {
  Locale,
  ScenarioId,
  ScenarioMistake,
  ScenarioRun,
  ScenarioStatus,
} from '@vitality/shared';
import { asJson, sql } from '../plugins/db';

/**
 * Generic scenario engine.
 *
 * Each scenario declares an ordered list of steps. A step validates a JSON
 * payload from the frontend and may either advance the state (`ok: true`)
 * or record a mistake (`ok: false`). Step `score` points are awarded on
 * successful submission; mistake `penalty` points are subtracted at the
 * end. Final score is clamped to 0-100.
 *
 * State is stored in a JSONB column on `scenario_runs`. Every record we
 * write must carry `synthetic: true` somewhere in its tree — `start()`
 * asserts on the value returned from `initialState`.
 */

export interface StepValidationOk<TState> {
  ok: true;
  next: TState;
  mistake?: ScenarioMistake;
}

export interface StepValidationErr {
  ok: false;
  mistake: ScenarioMistake;
}

export type StepValidationResult<TState> = StepValidationOk<TState> | StepValidationErr;

export interface StepDef<TState> {
  id: string;
  titleKey: string;
  /** Points awarded on successful submission. */
  score?: number;
  /** Last step in the scenario. Submitting it transitions status → 'scored'. */
  final?: boolean;
  validate: (state: TState, payload: unknown) => StepValidationResult<TState>;
}

export interface ScenarioDef<TState> {
  id: ScenarioId;
  initialState: (run: ScenarioRun) => TState;
  steps: StepDef<TState>[];
}

interface ScenarioRunRow {
  id: string;
  user_id: string;
  scenario_id: ScenarioId;
  locale: Locale;
  status: ScenarioStatus;
  current_step_id: string | null;
  state: Record<string, unknown>;
  mistakes: ScenarioMistake[];
  score: number | null;
  started_at: Date;
  finished_at: Date | null;
}

function rowToRun(row: ScenarioRunRow): ScenarioRun {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    userId: row.user_id,
    locale: row.locale,
    status: row.status,
    currentStepId: row.current_step_id,
    startedAt: row.started_at.toISOString(),
    ...(row.finished_at ? { finishedAt: row.finished_at.toISOString() } : {}),
    ...(row.score !== null ? { score: row.score } : {}),
    mistakes: Array.isArray(row.mistakes) ? row.mistakes : [],
    state: row.state,
  };
}

export class NotFoundError extends Error {
  constructor(msg = 'not_found') { super(msg); this.name = 'NotFoundError'; }
}
export class ForbiddenError extends Error {
  constructor(msg = 'forbidden') { super(msg); this.name = 'ForbiddenError'; }
}
export class ConflictError extends Error {
  constructor(msg = 'conflict') { super(msg); this.name = 'ConflictError'; }
}
export class UnknownStepError extends Error {
  constructor(msg = 'unknown_step') { super(msg); this.name = 'UnknownStepError'; }
}

/** Recursively assert that the state tree carries `synthetic: true` somewhere. */
function hasSyntheticMarker(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (obj.synthetic === true) return true;
  for (const v of Object.values(obj)) {
    if (hasSyntheticMarker(v, depth + 1)) return true;
  }
  return false;
}

export class ScenarioRunner<TState extends Record<string, unknown>> {
  constructor(private readonly def: ScenarioDef<TState>) {}

  private step(stepId: string): StepDef<TState> {
    const s = this.def.steps.find((x) => x.id === stepId);
    if (!s) throw new UnknownStepError(`unknown_step:${stepId}`);
    return s;
  }

  async start(userId: string, locale: Locale): Promise<ScenarioRun> {
    const firstStep = this.def.steps[0];
    if (!firstStep) throw new Error(`scenario ${this.def.id} has no steps`);

    const placeholderRun: ScenarioRun = {
      id: '00000000-0000-0000-0000-000000000000',
      scenarioId: this.def.id,
      userId,
      locale,
      status: 'in_progress',
      currentStepId: firstStep.id,
      startedAt: new Date().toISOString(),
      mistakes: [],
    };
    const initial = this.def.initialState(placeholderRun);

    if (!hasSyntheticMarker(initial)) {
      throw new Error(
        `synth-data safety: scenario "${this.def.id}" initial state is missing a synthetic:true marker`,
      );
    }

    const rows = await sql<ScenarioRunRow[]>`
      INSERT INTO scenario_runs (user_id, scenario_id, locale, status, current_step_id, state, mistakes)
      VALUES (
        ${userId},
        ${this.def.id},
        ${locale},
        'in_progress',
        ${firstStep.id},
        ${sql.json(asJson(initial))},
        ${sql.json(asJson([]))}
      )
      RETURNING id, user_id, scenario_id, locale, status, current_step_id, state, mistakes, score, started_at, finished_at
    `;
    const row = rows[0];
    if (!row) throw new Error('failed to insert scenario_run');
    return rowToRun(row);
  }

  async getRun(runId: string, userId: string): Promise<ScenarioRun> {
    const rows = await sql<ScenarioRunRow[]>`
      SELECT id, user_id, scenario_id, locale, status, current_step_id, state, mistakes, score, started_at, finished_at
      FROM scenario_runs WHERE id = ${runId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError();
    if (row.user_id !== userId) throw new NotFoundError(); // hide existence from other users
    return rowToRun(row);
  }

  async getState(runId: string, userId: string): Promise<TState> {
    const rows = await sql<ScenarioRunRow[]>`
      SELECT user_id, state FROM scenario_runs WHERE id = ${runId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError();
    if (row.user_id !== userId) throw new NotFoundError();
    return row.state as TState;
  }

  /**
   * Submit a step. Validates ownership + that the run is still in progress,
   * runs the step's validator, persists the new state / mistake list, and
   * advances `current_step_id` (or finalizes the run on the last step).
   */
  async submitStep(
    runId: string,
    userId: string,
    stepId: string,
    payload: unknown,
  ): Promise<{ run: ScenarioRun; ok: boolean; mistake?: ScenarioMistake; nextStepId: string | null }> {
    const step = this.step(stepId);

    return sql.begin(async (tx) => {
      const rows = await tx<ScenarioRunRow[]>`
        SELECT id, user_id, scenario_id, locale, status, current_step_id, state, mistakes, score, started_at, finished_at
        FROM scenario_runs WHERE id = ${runId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) throw new NotFoundError();
      if (row.user_id !== userId) throw new NotFoundError();
      if (row.status !== 'in_progress') throw new ConflictError(`run_status:${row.status}`);
      if (row.current_step_id !== stepId) {
        throw new ConflictError(`expected_step:${row.current_step_id ?? 'none'}`);
      }

      const currentState = row.state as TState;
      const result = step.validate(currentState, payload);

      const existingMistakes: ScenarioMistake[] = Array.isArray(row.mistakes) ? row.mistakes : [];
      const nextState: TState = result.ok ? result.next : currentState;
      const newMistake: ScenarioMistake | undefined = result.ok ? result.mistake : result.mistake;
      const mistakes: ScenarioMistake[] = newMistake ? [...existingMistakes, newMistake] : existingMistakes;

      const stepIdx = this.def.steps.findIndex((s) => s.id === stepId);
      const nextStep = this.def.steps[stepIdx + 1];
      // If validation hard-failed (e.g. malformed payload), we record the
      // mistake but keep the user on the same step so they can retry.
      // Soft-mistakes (result.ok === true with a mistake attached) still
      // advance — they're "wrong but submitted".
      const advance = result.ok;
      const isFinal = advance && (step.final === true || !nextStep);

      let nextStepId: string | null;
      let nextStatus: ScenarioStatus;
      let finalScore: number | null = null;
      let finishedAt: Date | null = null;

      if (isFinal) {
        nextStepId = null;
        nextStatus = 'scored';
        // Sum step points for all non-mistaken steps + this one (if ok).
        // We don't actually track "non-mistake" status per step; instead
        // we award full step points whenever submission was accepted with
        // result.ok=true and no mistake attached, and we always subtract
        // penalties. This keeps scoring transparent.
        let gross = 0;
        for (const s of this.def.steps) gross += s.score ?? 0;
        const penalties = mistakes.reduce((acc, m) => acc + (m.penalty || 0), 0);
        finalScore = Math.max(0, Math.min(100, gross - penalties));
        finishedAt = new Date();
      } else if (advance) {
        nextStepId = nextStep ? nextStep.id : null;
        nextStatus = 'in_progress';
      } else {
        // Stay on the same step for retry.
        nextStepId = stepId;
        nextStatus = 'in_progress';
      }

      const updated = await tx<ScenarioRunRow[]>`
        UPDATE scenario_runs
        SET state = ${tx.json(asJson(nextState))},
            mistakes = ${tx.json(asJson(mistakes))},
            current_step_id = ${nextStepId},
            status = ${nextStatus},
            score = ${finalScore},
            finished_at = ${finishedAt}
        WHERE id = ${runId}
        RETURNING id, user_id, scenario_id, locale, status, current_step_id, state, mistakes, score, started_at, finished_at
      `;
      const newRow = updated[0];
      if (!newRow) throw new Error('failed to update scenario_run');

      return {
        run: rowToRun(newRow),
        ok: result.ok,
        ...(newMistake ? { mistake: newMistake } : {}),
        nextStepId,
      };
    });
  }
}
