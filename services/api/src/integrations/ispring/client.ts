/**
 * Thin HTTP client for the iSpring REST API (and our mock).
 *
 * Why hand-rolled instead of fetch:
 *   - We need separate `headersTimeout` (5s) and `bodyTimeout` (10s) — iSpring
 *     can be slow to start responding but usually streams fast once it does;
 *     undici exposes both knobs cleanly.
 *   - The mock at `infra/mocks/ispring` can simulate 503s via MOCK_FAIL_RATE,
 *     so we need a predictable error path (`IspringError {status, body}`)
 *     for the queue worker to act on (retry vs dead-letter).
 *
 * Auth: a single Bearer token is read from config at construction time.
 * Idempotency-Key is set per call on POST /api/v1/results.
 */

import { request as undiciRequest } from 'undici';
import type {
  IspringCourse,
  IspringEnrollment,
  IspringResult,
  SubmitResultInput,
} from './types';

export class IspringError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `iSpring HTTP ${status}`);
    this.name = 'IspringError';
    this.status = status;
    this.body = body;
  }
}

interface IspringClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class IspringClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts: IspringClientOptions) {
    // Strip a trailing slash so we don't end up with `//api/v1/...`.
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
  }

  // ----- public surface -----------------------------------------------------

  async listCourses(): Promise<IspringCourse[]> {
    const { body } = await this.req<{ courses: IspringCourse[] } | IspringCourse[]>(
      'GET',
      '/api/v1/courses',
    );
    // Accept either {courses:[...]} or a bare array (mock returns the former).
    return Array.isArray(body) ? body : body.courses;
  }

  async enrollUser(userId: string, courseId: string): Promise<IspringEnrollment> {
    const { body } = await this.req<IspringEnrollment>('POST', '/api/v1/enrollments', {
      body: { userId, courseId },
    });
    return body;
  }

  async submitResult(input: SubmitResultInput): Promise<IspringResult> {
    const { idempotencyKey, ...payload } = input;
    const { body } = await this.req<IspringResult>('POST', '/api/v1/results', {
      body: payload,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return body;
  }

  async getResult(resultId: string): Promise<IspringResult> {
    const { body } = await this.req<IspringResult>(
      'GET',
      `/api/v1/results/${encodeURIComponent(resultId)}`,
    );
    return body;
  }

  /** Calls /api/v1/_health with a tight timeout; used by /lms/health. */
  async health(timeoutMs = 1000): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
    const start = performance.now();
    try {
      const { body } = await this.req<{ ok: boolean }>('GET', '/api/v1/_health', {
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        skipAuth: true,
      });
      return { ok: !!body.ok, latencyMs: performance.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: performance.now() - start,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ----- internals ----------------------------------------------------------

  private async req<TResp>(
    method: 'GET' | 'POST',
    path: string,
    opts: {
      body?: unknown;
      headers?: Record<string, string>;
      headersTimeout?: number;
      bodyTimeout?: number;
      skipAuth?: boolean;
    } = {},
  ): Promise<{ status: number; body: TResp }> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(opts.headers ?? {}),
    };
    if (!opts.skipAuth) headers.authorization = `Bearer ${this.apiKey}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';

    const res = await undiciRequest(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      headersTimeout: opts.headersTimeout ?? 5000,
      bodyTimeout: opts.bodyTimeout ?? 10000,
    });

    const text = await res.body.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Fall through with the raw text in the error path.
        if (res.statusCode >= 400) {
          throw new IspringError(res.statusCode, text);
        }
        throw new IspringError(res.statusCode, text, 'non-JSON success body');
      }
    }
    if (res.statusCode >= 400) {
      throw new IspringError(res.statusCode, parsed);
    }
    return { status: res.statusCode, body: parsed as TResp };
  }
}
