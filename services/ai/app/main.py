from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_pool, get_pool
from app.logging_setup import configure_logging
from app.middleware.request_id import RequestIdMiddleware
from app.rag.cache import close_cache
from app.routes.chat import router as chat_router
from app.routes.health import router as health_router
from app.routes.sim_hint import router as sim_hint_router
from app.routes.clicky_explain import router as clicky_explain_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Open the DB pool eagerly so the first chat request doesn't pay for it.
    # The embedding model is still loaded lazily on first use to keep startup
    # fast for Docker health checks.
    try:
        await get_pool()
    except Exception:
        # Don't crash the app if the DB isn't reachable yet -- /health still
        # responds, and the chat route will surface a clean error.
        pass
    try:
        yield
    finally:
        await close_pool()
        await close_cache()


def create_app() -> FastAPI:
    settings = get_settings()
    # JSON logs with request-id stitching — installed before app construction
    # so even FastAPI's own startup messages get the new format.
    configure_logging(settings.ai_log_level)
    app = FastAPI(
        title="Vitality AI",
        version="0.0.0",
        lifespan=lifespan,
    )
    # Order: request-id outermost so it wraps everything (including CORS
    # preflight). Starlette runs middleware in reverse-of-add order, so
    # adding CORS first and RequestId second yields the correct nesting.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:4000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)
    app.include_router(health_router)
    app.include_router(chat_router)
    app.include_router(sim_hint_router)
    app.include_router(clicky_explain_router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"service": "vitality-ai", "provider": settings.gen_provider}

    return app


app = create_app()
