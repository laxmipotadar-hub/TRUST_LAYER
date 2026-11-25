from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.repositories.json_store import repo
from app.schemas import HealthResponse, SettingsResponse, SettingsUpdateRequest
from app.services.cache_service import cache_service


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
    )
    return get_settings()


@router.get("/cache/stats")
def get_cache_stats() -> dict:
    return cache_service.stats()


@router.delete("/cache")
def clear_cache() -> dict:
    removed = cache_service.clear()
    return {"cleared_entries": removed}
