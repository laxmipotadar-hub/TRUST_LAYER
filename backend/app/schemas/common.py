from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


AppMode = Literal["DEMO", "REAL"]
AnalysisMode = Literal["REAL", "CACHED", "SIMULATION"]
AnalysisProvenance = Literal["REAL ANALYSIS", "CACHED ANALYSIS", "SIMULATION"]
TrustVerdict = Literal["SAFE", "CAUTION", "THREAT", "INCOMPLETE ANALYSIS"]
SignalStatus = Literal["PASS", "WARN", "FAIL", "UNAVAILABLE", "INCOMPLETE"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
EvidenceSeverity = Literal["INFO", "WARNING", "CRITICAL"]
EvidenceCategory = Literal["VOICE", "IDENTITY", "SCAM", "PRESSURE", "LIVENESS", "POLICY"]
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
    detectifai_configured: bool
    gemini_configured: bool
    detectifai_base_url: str
    gemini_model: str


class SettingsUpdateRequest(BaseModel):
    app_mode: AppMode | None = None
    cache_enabled: bool | None = None
    bot_guard_enabled: bool | None = None
    bot_guard_threshold: int | None = Field(default=None, ge=0, le=100)
