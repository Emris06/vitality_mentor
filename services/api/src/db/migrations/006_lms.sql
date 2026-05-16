-- 006_lms.sql
-- iSpring LMS export queue (Part 6 of the Ideathon build).
--
-- Why a dedicated outbox table?
--   The gamification stream already gives us at-least-once delivery from the
--   API → game-worker. But iSpring is an *external* system: we want
--   exponential backoff, a dead-letter for permanent failures, and a record
--   the HR dashboard can introspect (which exports landed, which didn't,
--   why). Redis Streams alone don't give us that — durable rows + a worker
--   loop do. The Redis consumer (consumer.ts) writes here and the queue
--   worker (queue.ts) drains here.
--
-- Idempotency model:
--   idempotency_key is the *external* dedupe key (e.g. "sim:<runId>") and is
--   what iSpring's POST /api/v1/results header reuses. UNIQUE on this column
--   means a stream redelivery → duplicate enqueue is a silent no-op.
--
-- Idempotent migration: safe to re-apply.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS lms_exports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('sim_scored','module_completed','assessment')),
  source_id          text NOT NULL,
  user_id            uuid NOT NULL,
  payload            jsonb NOT NULL,
  status             text NOT NULL CHECK (status IN ('pending','submitted','failed','dead_letter')) DEFAULT 'pending',
  attempts           int  NOT NULL DEFAULT 0,
  last_error         text NULL,
  idempotency_key    text NOT NULL UNIQUE,
  ispring_result_id  text NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Queue draining: the worker scans for non-terminal rows in age order.
CREATE INDEX IF NOT EXISTS lms_exports_status_created_idx
  ON lms_exports (status, created_at);
