/**
 * iSpring REST surface — minimal subset used by the Vitality export pipeline.
 *
 * These shapes are a plausible mirror of iSpring's public API (we only need
 * courses, enrollments, and results). The mock server in
 * `infra/mocks/ispring` implements exactly these endpoints. If/when the real
 * iSpring is wired in, anything that doesn't fit here belongs in a wider
 * `IspringResultExt` rather than complicating this file.
 */

export interface IspringCourse {
  id: string;
  title: string;
  durationMinutes?: number;
}

export interface IspringEnrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'failed';
}

export interface IspringResult {
  id: string;
  userId: string;
  courseId: string;
  score: number;
  passed: boolean;
  completedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input shape for POST /api/v1/results. `idempotencyKey` is sent as the
 * `Idempotency-Key` HTTP header — the body itself does not carry it. iSpring
 * (and our mock) return the previously-stored result on key replay.
 */
export interface SubmitResultInput {
  idempotencyKey: string;
  userId: string;
  courseId: string;
  score: number;
  passed: boolean;
  completedAt: string;
  metadata?: Record<string, unknown>;
}
