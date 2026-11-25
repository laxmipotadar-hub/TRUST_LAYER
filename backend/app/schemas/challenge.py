from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.calls import CallSession
from app.schemas.common import AnalysisProvenance


ChallengeCaptureMode = Literal[
    "LIVE_SPEECH_AUDIO",
    "LIVE_SPEECH_ONLY",
    "SIMULATED_REPLAY_FAIL",
    "SIMULATED_LIVE_PASS",
    "TIMEOUT",
    "TEXT_INPUT",
]


class ChallengeStartRequest(BaseModel):
    call_id: Optional[str] = None
    customer_id: str = "CUST-4821-MARCUS"
    window_seconds: int = Field(default=12, ge=5, le=30)


class ChallengeSession(BaseModel):
    challenge_id: str
    call_id: Optional[str]
    customer_id: str
    phrase: str
    window_seconds: int = 12
    created_at: str
    expires_at: str = ""
    status: Literal["PENDING", "PASSED", "FAILED"] = "PENDING"
    provenance: AnalysisProvenance


class ChallengeVerifyRequest(BaseModel):
    challenge_id: str
    spoken_response: str = Field(default="", max_length=400)
    response_latency_ms: int = Field(default=1400, ge=0, le=60000)
    capture_mode: ChallengeCaptureMode = "LIVE_SPEECH_ONLY"
    audio_captured: bool = False


class ChallengeCheckItem(BaseModel):
    key: str
    label: str
    passed: bool
    detail: str


class ChallengeVerifyResponse(BaseModel):
    challenge_id: str
    passed: bool
    status: Literal["passed", "failed", "incomplete"] = "failed"
    reason: Optional[str] = None
    phrase_similarity: float = Field(..., ge=0, le=1)
    liveness_status: Literal["PASS", "FAIL", "INCOMPLETE"]
    capture_mode: ChallengeCaptureMode
    notes: str
    explanation: str
    banner_lines: list[str] = Field(default_factory=list)
    checks: list[ChallengeCheckItem] = Field(default_factory=list)
    provenance: AnalysisProvenance
    updated_call: Optional[CallSession] = None
