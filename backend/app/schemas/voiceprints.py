from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.common import AnalysisProvenance


VerificationStatusType = Literal["VERIFIED", "MISMATCH", "UNVERIFIED", "UNAVAILABLE"]


class VoiceprintVerificationEntry(BaseModel):
    verification_id: str
    verified_at: str
    match_percentage: Optional[float] = None
    result: VerificationStatusType
    claimed_identity: str
    verified_identity: Optional[str] = None
    provenance: AnalysisProvenance
    notes: str = ""


class VoiceprintRecord(BaseModel):
    voiceprint_id: str
    customer_id: str
    customer_name: str
    account_tier: str
    enrollment_purpose: str = "Banking Call Authentication & Fraud Prevention"
    consent_confirmed: bool = True
    consent_timestamp: str = ""
    retention_policy: str = (
        "Voiceprint reference retained for active banking authentication until revoked by an authorized operator."
    )
    enrolled_at: str
    revoked_at: Optional[str] = None
    sample_duration_sec: float = Field(..., ge=1.0)
    enrollment_source: str = "REAL ANALYSIS"
    provider_speaker_id: str | None = None
    provider_speaker_ref: str | None = None
    provider_operation_id: str | None = None
    credits_used: Optional[float] = None
    reconciled: bool = False
    last_verified_at: Optional[str] = None
    last_verification_status: VerificationStatusType = "UNVERIFIED"
    last_match_percentage: Optional[float] = None
    verification_count: int = 0
    mismatch_count: int = 0
    verification_history: list[VoiceprintVerificationEntry] = Field(default_factory=list)
    status: Literal["ACTIVE", "REVOKED"] = "ACTIVE"


class VoiceprintEnrollRequest(BaseModel):
    customer_id: str = Field(..., min_length=3, max_length=64)
    customer_name: str = Field(..., min_length=2, max_length=120)
    account_tier: str = Field(default="Private Banking", max_length=64)
    enrollment_purpose: str = Field(
        default="Banking Call Authentication & Fraud Prevention",
        max_length=240,
    )
    consent_confirmed: bool = True
    sample_duration_sec: float = Field(default=6.0, ge=2.0, le=120.0)


class VoiceprintVerifyResponse(BaseModel):
    voiceprint_id: str
    match_percentage: Optional[float] = None
    verification_result: VerificationStatusType
    claimed_identity: str
    verified_identity: Optional[str] = None
    timestamp: str
    provenance: AnalysisProvenance
    notes: str


class VoiceprintDeleteResponse(BaseModel):
    deleted: bool
    voiceprint_id: str
