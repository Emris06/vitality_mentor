"""JSON logging configuration for the AI service.

Installs a root logger that emits one JSON object per line and includes the
current request id (from :mod:`app.middleware.request_id`) on every record.
Idempotent — calling :func:`configure_logging` multiple times re-uses the
same handler instead of stacking duplicates.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.middleware.request_id import get_request_id

_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    """Minimal, dependency-free JSON line formatter."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401 - stdlib override
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": get_request_id(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Surface any structured `extra={...}` fields the caller attached.
        for key, value in record.__dict__.items():
            if key in payload or key.startswith("_"):
                continue
            if key in {
                "args",
                "msg",
                "levelname",
                "levelno",
                "name",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "taskName",
            }:
                continue
            try:
                json.dumps(value)
                payload[key] = value
            except TypeError:
                payload[key] = repr(value)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "info") -> None:
    """Install the JSON formatter on the root logger.

    Safe to call from FastAPI startup. Uvicorn's access/error loggers are
    redirected to the same handler so a single line format covers everything.
    """

    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        lg = logging.getLogger(name)
        lg.handlers = [handler]
        lg.propagate = False
        lg.setLevel(level.upper())

    _CONFIGURED = True
