import type {
  AiHintResponse,
  ChatRequest,
  ChatStreamEvent,
  Employee,
  EmployeeRole,
  HealthResponse,
  Locale,
  MentorAssignment,
  Newcomer,
  PromotionReadiness,
  ScenarioId,
  ScenarioMistake,
  ScenarioRun,
  SkillForecast,
  SkillGap,
  SkillLevel,
  SkillNode,
} from '@vitality/shared';

import { getSupabase } from './supabase';

const BASE = '/api';

/**
 * Wrapped fetch that attaches the current Supabase access token (if any) as
 * a Bearer header. Use this for any API call that needs to identify the
 * caller via the JWT plugin on the server. Falls back to plain fetch when
 * Supabase isn't configured — the API's cookie fallback still resolves a
 * user id in dev.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      init.headers = {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return fetch(input, init);
}

export class SimHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'SimHttpError';
  }
}

export interface SubmitStepResult {
  run: ScenarioRun;
  ok: boolean;
  mistake?: ScenarioMistake;
  nextStepId?: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore body read failure
    }
    throw new SimHttpError(res.status, detail || `sim ${res.status}`);
  }
  return (await res.json()) as T;
}

export const simApi = {
  async startRun(scenarioId: ScenarioId, locale: Locale): Promise<ScenarioRun> {
    const res = await fetch(`${BASE}/sim/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId, locale }),
    });
    return jsonOrThrow<ScenarioRun>(res);
  },

  async getRun(id: string): Promise<ScenarioRun> {
    const res = await fetch(`${BASE}/sim/runs/${encodeURIComponent(id)}`);
    return jsonOrThrow<ScenarioRun>(res);
  },

  async submitStep(
    id: string,
    stepId: string,
    payload: Record<string, unknown>,
  ): Promise<SubmitStepResult> {
    const res = await fetch(`${BASE}/sim/runs/${encodeURIComponent(id)}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, payload }),
    });
    return jsonOrThrow<SubmitStepResult>(res);
  },

  async getHint(
    id: string,
    stepId: string,
    contextOverride?: Record<string, unknown>,
  ): Promise<AiHintResponse> {
    const res = await fetch(`${BASE}/sim/runs/${encodeURIComponent(id)}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, contextOverride }),
    });
    return jsonOrThrow<AiHintResponse>(res);
  },
};

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`, { signal });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return (await res.json()) as HealthResponse;
}

/**
 * Streams Server-Sent Events from POST /api/chat and yields parsed
 * ChatStreamEvent objects. The server format is one or more
 * `data: <json>\n\n` blocks (vanilla SSE). We parse manually so we can
 * survive partial chunks and multiple events glued together in one read.
 *
 * Stops on a `done` or `error` event. Re-throws AbortError so the caller
 * can distinguish a user-initiated cancel from a network failure.
 */
export async function* streamChat(
  req: ChatRequest,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok || !res.body) {
    const status = res.status;
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore body read failure
    }
    throw new ChatHttpError(status, detail || `chat ${status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line. Handle CRLF too.
      let sepIdx = findEventSeparator(buffer);
      while (sepIdx !== -1) {
        const rawEvent = buffer.slice(0, sepIdx.start);
        buffer = buffer.slice(sepIdx.end);

        const ev = parseSseEvent(rawEvent);
        if (ev) {
          yield ev;
          if (ev.type === 'done' || ev.type === 'error') {
            return;
          }
        }
        sepIdx = findEventSeparator(buffer);
      }
    }

    // Flush any final partial event without trailing blank line.
    const flushed = buffer.trim();
    if (flushed.length > 0) {
      const ev = parseSseEvent(flushed);
      if (ev) yield ev;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export class ChatHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ChatHttpError';
  }
}

export class HrHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HrHttpError';
  }
}

async function hrJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore body read failure
    }
    throw new HrHttpError(res.status, detail || `hr ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface NewcomerListItem extends Newcomer {
  mentor?: Employee;
  progressPct: number;
}

export interface NewcomerDetailDto {
  newcomer: Newcomer;
  mentor?: Employee;
  recentRuns: ScenarioRun[];
}

export interface MatchCandidate {
  mentorId: string;
  score: number;
  reasons: string[];
}

export interface TopMentor {
  employeeId: string;
  name: string;
  completedCount: number;
}

export interface HrDashboardSummary {
  newcomersTotal: number;
  assigned: number;
  unassigned: number;
  scoredRuns7d: number;
  avgScore7d: number;
  topMentors: TopMentor[];
}

export type HrStreamEventType = 'hr.assigned' | 'hr.unassigned' | 'hr.progress' | 'hr.scored';

export interface HrStreamEvent {
  type: HrStreamEventType;
  payload: Record<string, unknown>;
}

export interface EmployeesQuery {
  role?: EmployeeRole;
  q?: string;
}

export const hrApi = {
  async getEmployees(query: EmployeesQuery = {}): Promise<Employee[]> {
    const params = new URLSearchParams();
    if (query.role) params.set('role', query.role);
    if (query.q) params.set('q', query.q);
    const qs = params.toString();
    const res = await fetch(`${BASE}/hr/employees${qs ? `?${qs}` : ''}`);
    return hrJsonOrThrow<Employee[]>(res);
  },

  async getNewcomers(): Promise<NewcomerListItem[]> {
    const res = await fetch(`${BASE}/hr/newcomers`);
    return hrJsonOrThrow<NewcomerListItem[]>(res);
  },

  async getNewcomer(id: string): Promise<NewcomerDetailDto> {
    const res = await fetch(`${BASE}/hr/newcomers/${encodeURIComponent(id)}`);
    return hrJsonOrThrow<NewcomerDetailDto>(res);
  },

  async match(id: string): Promise<MatchCandidate[]> {
    const res = await fetch(`${BASE}/hr/newcomers/${encodeURIComponent(id)}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return hrJsonOrThrow<MatchCandidate[]>(res);
  },

  async assign(id: string, mentorId: string): Promise<{ assignment: MentorAssignment }> {
    const res = await fetch(`${BASE}/hr/newcomers/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId }),
    });
    return hrJsonOrThrow<{ assignment: MentorAssignment }>(res);
  },

  async unassign(id: string): Promise<{ ok: true }> {
    const res = await fetch(`${BASE}/hr/newcomers/${encodeURIComponent(id)}/unassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return hrJsonOrThrow<{ ok: true }>(res);
  },

  async getSummary(): Promise<HrDashboardSummary> {
    const res = await fetch(`${BASE}/hr/dashboard/summary`);
    return hrJsonOrThrow<HrDashboardSummary>(res);
  },

  exportCsvUrl(): string {
    return `${BASE}/hr/export.csv`;
  },

  async *streamEvents(signal: AbortSignal): AsyncGenerator<HrStreamEvent> {
    const res = await fetch(`${BASE}/hr/stream`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal,
    });
    if (!res.ok || !res.body) {
      const status = res.status;
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        // ignore body read failure
      }
      throw new HrHttpError(status, detail || `hr stream ${status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = findEventSeparator(buffer);
        while (sep !== -1) {
          const raw = buffer.slice(0, sep.start);
          buffer = buffer.slice(sep.end);
          const ev = parseHrEvent(raw);
          if (ev) yield ev;
          sep = findEventSeparator(buffer);
        }
      }
      const flushed = buffer.trim();
      if (flushed.length > 0) {
        const ev = parseHrEvent(flushed);
        if (ev) yield ev;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  },
};

// ----- Gamification ---------------------------------------------------------
//
// Local-only typed views over the gamification HTTP surface. We deliberately
// avoid importing types from `@vitality/shared` here because the contract is
// owned by a parallel agent; keep the source of truth in
// `features/game/types.ts` and re-import as needed.

export class GameHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GameHttpError';
  }
}

async function gameJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore body read failure
    }
    throw new GameHttpError(res.status, detail || `game ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface LeaderboardQuery {
  /** Filter by skill key (e.g. "kyc", "compliance"). Omit for total XP. */
  skill?: string;
  /** Cap on rows returned (default 10 server-side). */
  limit?: number;
}

export const gameApi = {
  async me<T = unknown>(): Promise<T> {
    const res = await fetch(`${BASE}/gamification/me`);
    return gameJsonOrThrow<T>(res);
  },

  async user<T = unknown>(userId: string): Promise<T> {
    const res = await fetch(
      `${BASE}/gamification/users/${encodeURIComponent(userId)}/profile`,
    );
    return gameJsonOrThrow<T>(res);
  },

  async leaderboard<T = unknown>(query: LeaderboardQuery = {}): Promise<T> {
    const params = new URLSearchParams();
    if (query.skill) params.set('skill', query.skill);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await fetch(`${BASE}/gamification/leaderboard${qs ? `?${qs}` : ''}`);
    return gameJsonOrThrow<T>(res);
  },
};

// ----- Skills analytics ------------------------------------------------------
//
// The backend may extend `SkillNode` with extra fields (notably `targetXp`) used
// by the UI for matrix coloring and radar normalization. We type that locally
// so we can stay compatible with the shared contract while still consuming the
// optional field.

export class SkillsHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'SkillsHttpError';
  }
}

async function skillsJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore body read failure
    }
    throw new SkillsHttpError(res.status, detail || `skills ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Same shape as the shared `SkillNode`, plus an optional level cap used for
 *  visual normalization. The backend is expected to populate it; the UI
 *  falls back to 1000 when missing. */
export interface SkillNodeFull extends SkillNode {
  targetXp?: number;
}

export interface SkillsTaxonomyResponse {
  nodes: SkillNodeFull[];
}

export interface EmployeeSkillProfile {
  employee: Employee;
  skills: SkillLevel[];
}

export interface SkillRecommendation {
  moduleId: string;
  title: string;
  skillId: string;
  reason: string;
  impactScore: number;
  estimatedMinutes: number;
}

export interface SkillsRecommendationsResponse {
  // The backend may return either a bare array or `{ items: [] }`.
  items?: SkillRecommendation[];
}

export interface TeamGapMatrixCell {
  employeeId: string;
  skillId: string;
  xp: number;
  target: number;
}

export interface TeamGapMatrixResponse {
  employees: Employee[];
  skills: SkillNodeFull[];
  cells: TeamGapMatrixCell[];
}

export interface TeamSkillDistributionEntry {
  skillId: string;
  p50: number;
  p25?: number;
  p75?: number;
}

export interface TeamCompletionPoint {
  date: string;
  scoredRuns: number;
}

export interface TeamMentorEffectivenessEntry {
  mentorId: string;
  name: string;
  avgNewcomerScore: number;
  newcomerCount?: number;
}

export interface TeamAnalyticsResponse {
  skillDistribution: TeamSkillDistributionEntry[];
  completionVelocity: TeamCompletionPoint[];
  mentorEffectiveness: TeamMentorEffectivenessEntry[];
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const skillsApi = {
  async taxonomy(): Promise<SkillsTaxonomyResponse> {
    const res = await fetch(`${BASE}/skills/taxonomy`);
    return skillsJsonOrThrow<SkillsTaxonomyResponse>(res);
  },

  async employeeProfile(id: string): Promise<EmployeeSkillProfile> {
    const res = await fetch(
      `${BASE}/skills/employees/${encodeURIComponent(id)}/profile`,
    );
    return skillsJsonOrThrow<EmployeeSkillProfile>(res);
  },

  async gaps(id: string, targetRole?: string): Promise<{ gaps: SkillGap[] }> {
    const res = await fetch(
      `${BASE}/skills/employees/${encodeURIComponent(id)}/gaps${qs({ targetRole })}`,
    );
    return skillsJsonOrThrow<{ gaps: SkillGap[] }>(res);
  },

  async readiness(id: string, targetRole?: string): Promise<PromotionReadiness> {
    const res = await fetch(
      `${BASE}/skills/employees/${encodeURIComponent(id)}/readiness${qs({ targetRole })}`,
    );
    return skillsJsonOrThrow<PromotionReadiness>(res);
  },

  async recommendations(
    id: string,
    targetRole?: string,
    locale?: Locale,
  ): Promise<SkillRecommendation[]> {
    const res = await fetch(
      `${BASE}/skills/employees/${encodeURIComponent(id)}/recommendations${qs({ targetRole, locale })}`,
    );
    const payload = await skillsJsonOrThrow<
      SkillRecommendation[] | SkillsRecommendationsResponse
    >(res);
    if (Array.isArray(payload)) return payload;
    return payload.items ?? [];
  },

  async forecast(
    id: string,
    skillId: string,
    horizonDays = 90,
  ): Promise<SkillForecast> {
    const res = await fetch(
      `${BASE}/skills/employees/${encodeURIComponent(id)}/forecast${qs({ skillId, horizonDays })}`,
    );
    return skillsJsonOrThrow<SkillForecast>(res);
  },

  async teamGapMatrix(department?: string): Promise<TeamGapMatrixResponse> {
    const res = await fetch(`${BASE}/skills/team/gap-matrix${qs({ department })}`);
    return skillsJsonOrThrow<TeamGapMatrixResponse>(res);
  },

  async teamAnalytics(department?: string): Promise<TeamAnalyticsResponse> {
    const res = await fetch(`${BASE}/skills/team/analytics${qs({ department })}`);
    return skillsJsonOrThrow<TeamAnalyticsResponse>(res);
  },
};

function parseHrEvent(raw: string): HrStreamEvent | null {
  const lines = raw.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      const payload = line.slice(5);
      dataLines.push(payload.startsWith(' ') ? payload.slice(1) : payload);
    }
  }
  if (dataLines.length === 0) return null;
  const joined = dataLines.join('\n').trim();
  if (joined.length === 0) return null;
  try {
    const parsed = JSON.parse(joined) as HrStreamEvent;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.type === 'string' &&
      parsed.type.startsWith('hr.')
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

interface EventSep {
  start: number;
  end: number;
}

function findEventSeparator(buf: string): EventSep | -1 {
  const lf = buf.indexOf('\n\n');
  const crlf = buf.indexOf('\r\n\r\n');
  if (lf === -1 && crlf === -1) return -1;
  if (lf === -1) return { start: crlf, end: crlf + 4 };
  if (crlf === -1) return { start: lf, end: lf + 2 };
  return lf < crlf ? { start: lf, end: lf + 2 } : { start: crlf, end: crlf + 4 };
}

function parseSseEvent(raw: string): ChatStreamEvent | null {
  // An SSE event is one or more `field: value` lines. We only care about
  // `data:` lines, joining multi-line data per the spec.
  const lines = raw.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(':')) continue; // comment / heartbeat
    if (line.startsWith('data:')) {
      const payload = line.slice(5);
      dataLines.push(payload.startsWith(' ') ? payload.slice(1) : payload);
    }
  }
  if (dataLines.length === 0) return null;
  const joined = dataLines.join('\n').trim();
  if (joined.length === 0) return null;

  try {
    const parsed = JSON.parse(joined) as ChatStreamEvent;
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed;
    }
    return null;
  } catch {
    // Tolerate malformed frames — treat as a generic error.
    return { type: 'error', data: { message: 'malformed_event' } };
  }
}
