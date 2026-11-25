from __future__ import annotations

from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root: /home/laxmi/TRUST_LAYER
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    """Centralized backend configuration loaded from root .env or environment variables."""

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(PROJECT_ROOT / "backend" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    detectif_api_key: str = ""
    detectif_api_base_url: str = "https://platform.detectif.ai"
    groq_api_key: str = ""
    groq_stt_model: str = "whisper-large-v3-turbo"
    groq_llm_model: str = "llama-3.3-70b-versatile"

    app_mode: Literal["DEMO", "REAL"] = "DEMO"
    cache_enabled: bool = True

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )

    data_dir: Path = PROJECT_ROOT / "data"

    @property
    def scenarios_dir(self) -> Path:
        return self.data_dir / "scenarios"

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def reports_dir(self) -> Path:
        return self.data_dir / "reports"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def detectifai_configured(self) -> bool:
        return bool(self.detectif_api_key.strip())

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key.strip())


settings = Settings()
for directory in (settings.data_dir, settings.scenarios_dir, settings.cache_dir, settings.reports_dir):
    directory.mkdir(parents=True, exist_ok=True)
