"""Document ingestion pipeline.

Chunk -> batch-embed -> single-transaction insert.
"""

from __future__ import annotations

from typing import Literal

from app.db import get_pool
from app.rag.chunker import chunk as chunk_text
from app.rag.embeddings import embed_passages

Lang = Literal["uz", "ru", "en"]


def _vector_literal(vec) -> str:
    """Format a numpy/list vector as the pgvector text literal: '[v1,v2,...]'."""
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def _page_for_chunk(idx: int, page_map: list[tuple[int, int]] | None) -> int | None:
    """Resolve a page number for chunk index ``idx`` using the optional map.

    ``page_map`` is a list of (chunk_index_lower_bound, page_number) pairs sorted
    ascending by chunk_index. Each entry says "from this chunk onward, page is N".
    """
    if not page_map:
        return None
    page: int | None = None
    for lower, p in page_map:
        if idx >= lower:
            page = p
        else:
            break
    return page


async def ingest_document(
    title: str,
    source_uri: str,
    text: str,
    lang: Lang,
    page_map: list[tuple[int, int]] | None = None,
) -> str:
    """Ingest a document. Returns the new document UUID as a string.

    All chunk embeddings are computed in one batched call, and document + chunks
    are written in a single transaction. The caller is responsible for deleting
    prior rows with the same ``source_uri`` if idempotency is required.
    """
    if lang not in ("uz", "ru", "en"):
        raise ValueError(f"unsupported lang: {lang!r}")

    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("empty document, nothing to ingest")

    embeddings = embed_passages(chunks)
    if embeddings.shape[0] != len(chunks):
        raise RuntimeError("embedding count does not match chunk count")

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO documents (title, source_uri, lang)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (title, source_uri, lang),
                )
                row = await cur.fetchone()
                if row is None:
                    raise RuntimeError("failed to insert document")
                document_id = str(row[0])

                rows = []
                for idx, (content, vec) in enumerate(zip(chunks, embeddings, strict=True)):
                    rows.append(
                        (
                            document_id,
                            idx,
                            content,
                            lang,
                            _vector_literal(vec),
                            _page_for_chunk(idx, page_map),
                        )
                    )

                await cur.executemany(
                    """
                    INSERT INTO chunks
                        (document_id, ordinal, content, lang, embedding, page)
                    VALUES (%s, %s, %s, %s, %s::vector, %s)
                    """,
                    rows,
                )

    return document_id


async def delete_by_source_uri(source_uri: str) -> int:
    """Delete every document (and cascaded chunks) for a given source URI.

    Returns the count of deleted documents. Used by the seed script for
    idempotent re-runs.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM documents WHERE source_uri = %s",
                    (source_uri,),
                )
                return cur.rowcount or 0
