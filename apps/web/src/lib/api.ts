import type {
  AiHintResponse,
  ChatRequest,
  ChatStreamEvent,
  Employee,
  EmployeeRole,
  HealthResponse,
  Locale,
  Newcomer,
  ScenarioId,
  ScenarioMistake,
  ScenarioRun,
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
    let errorCode = 'errors.network';
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) errorCode = `errors.api.${body.error}`;
    } catch {
      // ignore body read failure — fall back to the generic network key
    }
    throw new SimHttpError(res.status, errorCode);
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
  mentor: Employee | null;
  progressPct: number;
}

export interface NewcomerDetailDto {
  newcomer: Newcomer;
  mentor: Employee | null;
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

interface EmployeesPayload {
  employees: Employee[];
}

interface NewcomersPayload {
  newcomers: NewcomerListItem[];
}

interface MatchesPayload {
  newcomerId: string;
  matches: MatchCandidate[];
}

export interface HrAssignResult {
  assignmentId: string;
  mentorId: string;
  newcomerId: string;
  matchScore: number;
  matchReasons: string[];
}

export interface HrUnassignResult {
  newcomerId: string;
  previousMentorId: string | null;
}

interface HrSummaryPayload {
  newcomers: {
    total: number;
    assigned: number;
    unassigned: number;
  };
  simulator: {
    scoredRunsLast7d: number;
    avgScoreLast7d: number | null;
  };
  topMentors: Array<{
    mentorId: string;
    fullName: string;
    completedNewcomers: number;
  }>;
}

export const hrApi = {
  async getEmployees(query: EmployeesQuery = {}): Promise<Employee[]> {
    const params = new URLSearchParams();
    if (query.role) params.set('role', query.role);
    if (query.q) params.set('q', query.q);
    const qs = params.toString();
    const res = await fetch(`${BASE}/hr/employees${qs ? `?${qs}` : ''}`);
    const payload = await hrJsonOrThrow<Employee[] | EmployeesPayload>(res);
    return Array.isArray(payload) ? payload : payload.employees;
  },

  async getNewcomers(): Promise<NewcomerListItem[]> {
    const res = await fetch(`${BASE}/hr/newcomers`);
    const payload = await hrJsonOrThrow<NewcomerListItem[] | NewcomersPayload>(res);
    return Array.isArray(payload) ? payload : payload.newcomers;
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
    const payload = await hrJsonOrThrow<MatchCandidate[] | MatchesPayload>(res);
    return Array.isArray(payload) ? payload : payload.matches;
  },

  async assign(id: string, mentorId: string): Promise<HrAssignResult> {
    const res = await fetch(`${BASE}/hr/newcomers/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId }),
    });
    return hrJsonOrThrow<HrAssignResult>(res);
  },

  async unassign(id: string): Promise<HrUnassignResult> {
    const res = await fetch(`${BASE}/hr/newcomers/${encodeURIComponent(id)}/unassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return hrJsonOrThrow<HrUnassignResult>(res);
  },

  async getSummary(): Promise<HrDashboardSummary> {
    const res = await fetch(`${BASE}/hr/dashboard/summary`);
    const payload = await hrJsonOrThrow<HrDashboardSummary | HrSummaryPayload>(res);
    if ('newcomersTotal' in payload) return payload;
    return {
      newcomersTotal: payload.newcomers.total,
      assigned: payload.newcomers.assigned,
      unassigned: payload.newcomers.unassigned,
      scoredRuns7d: payload.simulator.scoredRunsLast7d,
      avgScore7d: payload.simulator.avgScoreLast7d ?? 0,
      topMentors: payload.topMentors.map((m) => ({
        employeeId: m.mentorId,
        name: m.fullName,
        completedCount: m.completedNewcomers,
      })),
    };
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

  async quests(): Promise<import('../features/game/types').Quest[]> {
    const res = await authedFetch(`${BASE}/gamification/quests`);
    return gameJsonOrThrow<import('../features/game/types').Quest[]>(res);
  },
};

// ----- Intern --------------------------------------------------------------
//
// Per-intern view of profile + onboarding + cohort + activity. The backend
// route is `services/api/src/routes/intern.ts` registered at `/interns`.
// We reuse `authedFetch` so the Supabase Bearer token rides along when the
// caller is signed in; the dev cookie session still resolves the user
// server-side when it isn't.

export class InternHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InternHttpError';
  }
}

async function internJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore body read failure
    }
    throw new InternHttpError(res.status, detail || `intern ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface InternCohortMember {
  id: string;
  initials: string;
  fullName: string;
  totalXp: number;
  level: number;
}

export interface InternOnboarding {
  modulesCompleted: number;
  modulesTotal: number;
  deadline: string | null;
  assignedMentorName: string | null;
}

export interface InternRecentRun {
  id: string;
  scenarioId: string;
  score: number | null;
  status: string;
  createdAt: string;
}

export interface InternMe {
  profile: { id: string; fullName: string; role: string; avatarUrl: string | null };
  onboarding: InternOnboarding;
  recentRuns: InternRecentRun[];
  cohort: InternCohortMember[];
}

export interface InternActivityEntry {
  id: string;
  variant: 'sim_scored' | 'mentor_assigned' | 'quest_completed';
  actorName: string;
  createdAt: string;
}

export const internApi = {
  async me(): Promise<InternMe> {
    return internJsonOrThrow<InternMe>(await authedFetch(`${BASE}/interns/me`));
  },
  async activity(opts?: { limit?: number }): Promise<InternActivityEntry[]> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return internJsonOrThrow<InternActivityEntry[]>(
      await authedFetch(`${BASE}/interns/me/activity${qs ? `?${qs}` : ''}`),
    );
  },
};

// ----- Resources ------------------------------------------------------------

export type Resource = {
  id: string;
  titleKey: string;
  descKey: string;
  category: 'aml_kyc' | 'customer' | 'products' | 'operations';
  docType: 'guide' | 'checklist' | 'sop' | 'regulation';
};

export const resourcesApi = {
  async list(category?: string): Promise<Resource[]> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return jsonOrThrow<Resource[]>(await authedFetch(`${BASE}/resources${qs}`));
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
