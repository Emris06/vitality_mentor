"""Thin wrapper around SentenceTransformer for multilingual E5 embeddings.

E5 models expect explicit "query: " / "passage: " prefixes and L2-normalized
output for cosine similarity. We keep the model singleton thread-safe and
load it lazily on first call so the FastAPI startup stays fast.
"""

from __future__ import annotations

import threading

import numpy as np

from app.config import get_settings

# Imported lazily to avoid pulling torch into import-time of the FastAPI app.
_model: object | None = None
_model_lock = threading.Lock()


def _get_model():
    """Load the SentenceTransformer once, thread-safe."""
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        from sentence_transformers import SentenceTransformer  # local import

        settings = get_settings()
        _model = SentenceTransformer(settings.embedding_model)
        return _model


def _encode(texts: list[str], prefix: str) -> np.ndarray:
    if not texts:
        return np.zeros((0, get_settings().embedding_dim), dtype=np.float32)
    model = _get_model()
    prefixed = [f"{prefix}{t}" for t in texts]
    vecs = model.encode(
        prefixed,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return vecs.astype(np.float32, copy=False)


def embed_passages(texts: list[str]) -> np.ndarray:
    """Embed corpus passages. Returns shape (n, embedding_dim), L2-normalized."""
    return _encode(texts, "passage: ")


def embed_query(text: str) -> np.ndarray:
    """Embed a single user query. Returns shape (embedding_dim,) 1-D vector."""
    vecs = _encode([text], "query: ")
    return vecs[0]
