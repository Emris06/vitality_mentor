from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_host: str = "0.0.0.0"
    ai_port: int = 8000
    ai_log_level: str = "info"

    database_url: str = "postgres://vitality:vitality@localhost:5433/vitality"
    redis_url: str = "redis://localhost:6379"

    embedding_model: str = "intfloat/multilingual-e5-small"
    embedding_dim: int = 384

    gen_provider: Literal["openai", "anthropic", "ollama"] = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b-instruct"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    chat_latency_budget_ms: int = 2000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
