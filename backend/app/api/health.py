from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.repositories.json_store import repo
from app.schemas import (
    HealthResponse,
    SecretsStatusResponse,
    SecretsUpdateRequest,
    SettingsResponse,
    SettingsUpdateRequest,
)
from app.services.cache_service import cache_service
from app.services.secrets_service import (
    clear_server_secrets,
    get_secrets_status,
    update_server_secrets,
)


router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    state = repo.get_settings_state()
    missing = []
    if not settings.detectifai_configured:
        missing.append("DETECTIF_API_KEY")
    if not settings.gemini_configured:
        missing.append("GEMINI_API_KEY")

    note = (
        "All Real Mode AI providers configured on backend."
        if not missing
        else (
            f"Missing {', '.join(missing)} on server. "
            "REAL mode reports UNAVAILABLE for unconfigured DetectifAI calls and deterministic SIMULATION fallback for transcripts."
        )
    )

    return HealthResponse(
        status="ok",
        app_mode=state["app_mode"],
        cache_enabled=state["cache_enabled"],
        detectifai_configured=settings.detectifai_configured,
        gemini_configured=settings.gemini_configured,
        active_calls_count=repo.count_calls(),
        voiceprints_count=len(repo.list_voiceprints()),
        real_mode_note=note,
    )


@router.get("/settings", response_model=SettingsResponse)
def get_settings() -> SettingsResponse:
    state = repo.get_settings_state()
    return SettingsResponse(
        app_mode=state["app_mode"],
        cache_enabled=state["cache_enabled"],
        bot_guard_enabled=state["bot_guard_enabled"],
        bot_guard_threshold=state["bot_guard_threshold"],
        layer_weights=state["layer_weights"],
        safe_threshold=state["safe_threshold"],
        review_threshold=state["review_threshold"],
        ema_alpha=state["ema_alpha"],
        language=state["language"],
        detectifai_configured=settings.detectifai_configured,
        gemini_configured=settings.gemini_configured,
        detectifai_base_url=settings.detectif_api_base_url,
        gemini_model=settings.gemini_model,
    )


@router.post("/settings", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdateRequest) -> SettingsResponse:
    repo.update_settings_state(
        app_mode=payload.app_mode,
        cache_enabled=payload.cache_enabled,
        bot_guard_enabled=payload.bot_guard_enabled,
        bot_guard_threshold=payload.bot_guard_threshold,
        layer_weights=payload.layer_weights,
        safe_threshold=payload.safe_threshold,
        review_threshold=payload.review_threshold,
        ema_alpha=payload.ema_alpha,
        language=payload.language,
    )
    return get_settings()


@router.get("/settings/secrets", response_model=SecretsStatusResponse)
def read_secrets_status() -> SecretsStatusResponse:
    return get_secrets_status()


@router.post("/settings/secrets", response_model=SecretsStatusResponse)
def save_server_secrets(payload: SecretsUpdateRequest) -> SecretsStatusResponse:
    return update_server_secrets(
        detectif_api_key=payload.detectif_api_key,
        gemini_api_key=payload.gemini_api_key,
        detectif_api_base_url=payload.detectif_api_base_url,
        gemini_model=payload.gemini_model,
    )


@router.delete("/settings/secrets", response_model=SecretsStatusResponse)
def remove_server_secrets() -> SecretsStatusResponse:
    return clear_server_secrets()


@router.get("/cache/stats")
def get_cache_stats() -> dict:
    return cache_service.stats()


@router.delete("/cache")
def clear_cache() -> dict:
    removed = cache_service.clear()
    return {"cleared_entries": removed}
