"""Hybrid retriever: pgvector dense + Postgres FTS lexical, merged with RRF.

Both branches run in parallel per query. Reciprocal Rank Fusion (RRF) merges
their ranked lists without needing comparable score scales -- it only uses
positions, which is robust when one branch returns near-uniform cosine
distances and the other returns wildly different ts_rank_cd magnitudes.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass

from app.db import get_pool
from app.rag.embeddings import embed_query

# RRF constant; 60 is the value from the original Cormack et al. paper.
_RRF_K = 60

# Strip characters that are illegal in to_tsquery; we'll & the remaining words.
_TSQ_CLEAN = re.compile(r"[^\w\sЀ-ӿԀ-ԯ'`]+", re.UNICODE)


@dataclass
class Chunk:
    chunk_id: str
    document_title: str
    source_uri: str
    page: int | None
    snippet: str
    lang: str
    score: float


def _vector_literal(vec) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def _build_tsquery(query: str) -> str:
    """Build a conservative & -joined to_tsquery string from raw user input.

    Empty -> empty string (caller treats that as "skip lexical").
    """
    cleaned = _TSQ_CLEAN.sub(" ", query).strip()
    if not cleaned:
        return ""
    words = [w for w in cleaned.split() if w]
    if not words:
        return ""
    # Apply prefix matching to the last token so partial words still match.
    parts = [f"{w}:*" if i == len(words) - 1 else w for i, w in enumerate(words)]
    return " & ".join(parts)


async def _dense_search(query: str, lang: str, k: int) -> list[tuple[str, dict]]:
    vec = embed_query(query)
    vec_lit = _vector_literal(vec)

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT
                    c.id::text,
                    d.title,
                    d.source_uri,
                    c.page,
                    c.content,
                    c.lang,
                    1.0 - (c.embedding <=> %s::vector) AS score
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.lang = %s
                ORDER BY c.embedding <=> %s::vector
                LIMIT %s
                """,
                (vec_lit, lang, vec_lit, k),
            )
            rows = await cur.fetchall()

    return [
        (
            row[0],
            {
                "chunk_id": row[0],
                "document_title": row[1],
                "source_uri": row[2],
                "page": row[3],
                "content": row[4],
                "lang": row[5],
                "score": float(row[6]),
            },
        )
        for row in rows
    ]


async def _lexical_search(query: str, lang: str, k: int) -> list[tuple[str, dict]]:
    tsq = _build_tsquery(query)
    if not tsq:
        return []

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT
                    c.id::text,
                    d.title,
                    d.source_uri,
                    c.page,
                    c.content,
                    c.lang,
                    ts_rank_cd(c.content_tsv, q) AS score
                FROM chunks c
                JOIN documents d ON d.id = c.document_id,
                     to_tsquery('simple', unaccent(%s)) AS q
                WHERE c.lang = %s
                  AND c.content_tsv @@ q
                ORDER BY score DESC
                LIMIT %s
                """,
                (tsq, lang, k),
            )
            rows = await cur.fetchall()

    return [
        (
            row[0],
            {
                "chunk_id": row[0],
                "document_title": row[1],
                "source_uri": row[2],
                "page": row[3],
                "content": row[4],
                "lang": row[5],
                "score": float(row[6]),
            },
        )
        for row in rows
    ]


def _rrf_merge(
    dense: list[tuple[str, dict]],
    lexical: list[tuple[str, dict]],
    k: int,
    rrf_k: int = _RRF_K,
) -> list[dict]:
    scores: dict[str, float] = {}
    items: dict[str, dict] = {}

    for rank, (cid, item) in enumerate(dense):
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (rrf_k + rank + 1)
        items.setdefault(cid, item)

    for rank, (cid, item) in enumerate(lexical):
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (rrf_k + rank + 1)
        items.setdefault(cid, item)

    ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    out: list[dict] = []
    for cid, fused_score in ordered[:k]:
        item = dict(items[cid])
        item["score"] = fused_score
        out.append(item)
    return out


async def retrieve(
    query: str,
    lang: str,
    k_dense: int = 6,
    k_lex: int = 6,
    k_final: int = 3,
) -> list[Chunk]:
    """Hybrid retrieve top ``k_final`` chunks for ``query`` in ``lang``."""
    if lang not in ("uz", "ru", "en"):
        raise ValueError(f"unsupported lang: {lang!r}")

    dense_task = asyncio.create_task(_dense_search(query, lang, k_dense))
    lex_task = asyncio.create_task(_lexical_search(query, lang, k_lex))
    dense, lexical = await asyncio.gather(dense_task, lex_task)

    fused = _rrf_merge(dense, lexical, k_final)

    chunks: list[Chunk] = []
    for item in fused:
        content: str = item["content"] or ""
        snippet = content.strip().replace("\n", " ")
        if len(snippet) > 200:
            snippet = snippet[:200].rstrip() + "..."
        chunks.append(
            Chunk(
                chunk_id=item["chunk_id"],
                document_title=item["document_title"],
                source_uri=item["source_uri"],
                page=item["page"],
                snippet=snippet,
                lang=item["lang"],
                score=float(item["score"]),
            )
        )
    return chunks
