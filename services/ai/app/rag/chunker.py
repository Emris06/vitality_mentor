"""Paragraph-aware chunker with word-count token approximation.

Strategy:
  1. Split text on blank lines into paragraphs.
  2. Greedily pack paragraphs into chunks up to `target_tokens` (approximated
     as words * 1.3 -- conservative for multilingual content).
  3. Overlap each chunk's tail words into the next chunk to preserve context
     across boundaries.

No tiktoken dependency: the word-count heuristic is more than good enough for
retrieval-time chunking with E5-small at 512 max tokens.
"""

from __future__ import annotations

import re

_PARA_SPLIT = re.compile(r"\n\s*\n+")
_WS = re.compile(r"\s+")

# Tokens-per-word multiplier. Multilingual E5 tokenizer averages ~1.3 BPE
# tokens per whitespace word across uz/ru/en in our test corpus.
_TOKENS_PER_WORD = 1.3


def _word_count(text: str) -> int:
    return len(_WS.split(text.strip())) if text.strip() else 0


def _approx_tokens(text: str) -> int:
    return int(_word_count(text) * _TOKENS_PER_WORD)


def _split_paragraphs(text: str) -> list[str]:
    parts = _PARA_SPLIT.split(text.strip())
    return [p.strip() for p in parts if p.strip()]


def chunk(text: str, target_tokens: int = 500, overlap: int = 80) -> list[str]:
    """Chunk ``text`` into ~``target_tokens`` passages with ``overlap`` words.

    Returns at least one chunk if input is non-empty.
    """
    text = (text or "").strip()
    if not text:
        return []

    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return []

    chunks: list[str] = []
    current_parts: list[str] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current_parts, current_tokens
        if not current_parts:
            return
        chunks.append("\n\n".join(current_parts).strip())
        current_parts = []
        current_tokens = 0

    for para in paragraphs:
        para_tokens = _approx_tokens(para)

        # Oversized paragraph -- split it by words.
        if para_tokens > target_tokens:
            flush()
            words = _WS.split(para)
            words_per_chunk = max(1, int(target_tokens / _TOKENS_PER_WORD))
            step = max(1, words_per_chunk - overlap)
            for i in range(0, len(words), step):
                window = words[i : i + words_per_chunk]
                if not window:
                    break
                chunks.append(" ".join(window).strip())
                if i + words_per_chunk >= len(words):
                    break
            continue

        if current_tokens + para_tokens > target_tokens and current_parts:
            # Pack the overlap tail into the next chunk's seed.
            tail = " ".join(_WS.split("\n\n".join(current_parts))[-overlap:]) if overlap > 0 else ""
            flush()
            if tail:
                current_parts.append(tail)
                current_tokens = _approx_tokens(tail)

        current_parts.append(para)
        current_tokens += para_tokens

    flush()
    return chunks
