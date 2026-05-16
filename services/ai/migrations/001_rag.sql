-- 001_rag.sql
-- RAG schema for the AI-Mentor HUB chatbot.
-- Idempotent: safe to re-run.
--
-- Tables:
--   documents : a logical source document (SOP, regulation, KYC manual, ...).
--   chunks    : passage-sized splits with embeddings for hybrid retrieval.
--
-- Index strategy:
--   - ivfflat on embedding for ANN dense retrieval (cosine distance via `<=>`).
--   - GIN on the generated tsvector for lexical search with ts_rank_cd.
--   - btree on (lang) to narrow per-locale searches cheaply.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    source_uri  TEXT NOT NULL,
    lang        TEXT NOT NULL CHECK (lang IN ('uz', 'ru', 'en')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_source_uri_idx
    ON documents (source_uri);

CREATE TABLE IF NOT EXISTS chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    ordinal      INT NOT NULL,
    content      TEXT NOT NULL,
    content_tsv  TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', unaccent(coalesce(content, '')))
    ) STORED,
    lang         TEXT NOT NULL CHECK (lang IN ('uz', 'ru', 'en')),
    embedding    VECTOR(384),
    page         INT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dense ANN index. cosine ops because embeddings are L2-normalized.
-- lists=100 is fine for the demo corpus; tune up at ~1M chunks.
CREATE INDEX IF NOT EXISTS chunks_embedding_ivfflat_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS chunks_content_tsv_gin_idx
    ON chunks USING GIN (content_tsv);

CREATE INDEX IF NOT EXISTS chunks_lang_idx
    ON chunks (lang);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx
    ON chunks (document_id);
