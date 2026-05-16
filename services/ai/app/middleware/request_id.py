"""Request-ID middleware for the AI service.

Reads the inbound ``X-Request-Id`` header (or mints a UUID4 when absent) and
publishes it into a :class:`contextvars.ContextVar` so the logging
configuration in :mod:`app.logging_setup` can attach it to every log record
produced while the request is being handled.

The same value is echoed back on the response as ``X-Request-Id`` so the
caller (typically the Fastify API) can correlate its logs with ours.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

HEADER = "x-request-id"

# Default to empty string so log records always have a value. Loggers should
# treat empty as "no request context" (e.g. startup / shutdown lifecycle).
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Return the current request id, or an empty string when outside a request."""

    return request_id_var.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that propagates ``X-Request-Id``."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        incoming = request.headers.get(HEADER)
        rid = (incoming or "").strip() or uuid.uuid4().hex
        token = request_id_var.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[HEADER] = rid
        return response
