-- Initial DB setup: enable pgvector, create base schema.
-- Tables for RAG, simulator, HR, gamification, and skills are added incrementally
-- in later parts as their domains stabilize. Keep migrations idempotent.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Hard rule: every row originating from the synthetic data factory must carry
-- synthetic = TRUE. CI audits enforce that no production-bound table ever
-- contains a row with synthetic = FALSE in the simulator domain.
CREATE TABLE IF NOT EXISTS bootstrap_marker (
  id           SERIAL PRIMARY KEY,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bootstrap_marker (message)
VALUES ('vitality.postgres.bootstrap.ok')
ON CONFLICT DO NOTHING;
