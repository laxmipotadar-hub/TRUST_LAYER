from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


AppMode = Literal["DEMO", "REAL"]
ExecutionMode = Literal["LIVE", "DEMO", "CACHED"]
AnalysisMode = Literal["REAL", "CACHED", "SIMULATION"]
AnalysisProvenance = Literal["REAL ANALYSIS", "CACHED ANALYSIS", "SIMULATION"]
TrustVerdict = Literal["SAFE", "CAUTION", "THREAT", "INCOMPLETE ANALYSIS"]
FusionBand = Literal["SAFE", "REVIEW", "THREAT", "INCOMPLETE ANALYSIS"]
CallDecision = Literal["ALLOW", "STEP_UP", "BLOCK", "INCOMPLETE ANALYSIS"]
SignalStatus = Literal["PASS", "WARN", "FAIL", "UNAVAILABLE", "INCOMPLETE"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
EvidenceSeverity = Literal["INFO", "WARNING", "CRITICAL"]
EvidenceCategory = Literal["VOICE", "IDENTITY", "SCAM", "PRESSURE", "LIVENESS", "POLICY"]
ManipulationCategory = Literal["urgency", "secrecy", "authority", "threat"]
CallStateStage = Literal[
    "RINGING",
    "GREETING",
    "IDENTITY_CHECK",
    "CHALLENGE",
    "CONVERSATION",
    "VERDICT",
]
CallActionType = Literal[
    "ALLOW",
    "CHALLENGE",
    "PAUSE_BOT",
    "TRANSFER_TO_HUMAN",
    "BLOCK_CALL",
    "STEP_UP_CHALLENGE",
    "FREEZE_ACCOUNT",
    "ESCALATE_SOC",
    "TERMINATE_CALL",
]


DEFAULT_LAYER_WEIGHTS: dict[str, float] = {
    "voice_authenticity": 0.35,
    "speaker_identity": 0.30,
    "scam_safety": 0.20,
    "behavioral_safety": 0.15,
}


class HealthResponse(BaseModel):
    status: str
    service: str = "AEGIS — The Trust Layer"
    version: str = "1.0.0"
    app_mode: AppMode
    cache_enabled: bool
    detectifai_configured: bool
    gemini_configured: bool
    active_calls_count: int
    voiceprints_count: int
    real_mode_note: str


class SettingsResponse(BaseModel):
    app_mode: AppMode
    cache_enabled: bool
    bot_guard_enabled: bool = True
    bot_guard_threshold: int = Field(default=40, ge=0, le=100)
    layer_weights: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_LAYER_WEIGHTS))
    safe_threshold: float = Field(default=75.0, ge=40, le=100)
    review_threshold: float = Field(default=40.0, ge=0, le=90)
    ema_alpha: float = Field(default=0.45, ge=0.05, le=1.0)
    language: str = "en"
    detectifai_configured: bool
    gemini_configured: bool
    detectifai_base_url: str
    gemini_model: str


class SettingsUpdateRequest(BaseModel):
    app_mode: AppMode | None = None
    cache_enabled: bool | None = None
    bot_guard_enabled: bool | None = None
    bot_guard_threshold: int | None = Field(default=None, ge=0, le=100)
    layer_weights: dict[str, float] | None = None
    safe_threshold: float | None = Field(default=None, ge=40, le=100)
    review_threshold: float | None = Field(default=None, ge=0, le=90)
    ema_alpha: float | None = Field(default=None, ge=0.05, le=1.0)
    language: str | None = Field(default=None, pattern="^(en|es|fr|de)$")


class SecretsUpdateRequest(BaseModel):
    detectif_api_key: str | None = None
    gemini_api_key: str | None = None
    detectif_api_base_url: str | None = None
    gemini_model: str | None = None


class SecretsStatusResponse(BaseModel):
    detectifai_configured: bool
    gemini_configured: bool
    detectif_key_hint: str = "NOT SET"
    gemini_key_hint: str = "NOT SET"
    detectifai_base_url: str
    gemini_model: str
