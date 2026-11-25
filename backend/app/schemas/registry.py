from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

from app.schemas.common import AnalysisProvenance


ThreatVerificationStatus = Literal["PENDING REVIEW", "CONFIRMED THREAT", "MITIGATED"]
ThreatSeverity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class ThreatRegistryEntry(BaseModel):
    entry_id: str
    pattern_name: str
    anonymous_speaker_ref: str = "anon-spk-unassigned"
    category: str
    severity: ThreatSeverity
    detection_date: str = ""
    evidence_reference: str = ""
    verification_status: ThreatVerificationStatus = "CONFIRMED THREAT"
    institution_scope: str = "Local SOC Instance (Federation-Ready Schema)"
    indicators: list[str] = Field(default_factory=list)
    reported_institutions: int = 1
    last_seen: str
    provenance: AnalysisProvenance = "CACHED ANALYSIS"


class ThreatSubmitRequest(BaseModel):
    pattern_name: str = Field(..., min_length=3, max_length=140)
    raw_speaker_reference: str = Field(..., min_length=2, max_length=120)
    category: str = Field(..., min_length=2, max_length=100)
    severity: ThreatSeverity = "HIGH"
    evidence_reference: str = Field(default="", max_length=160)
    indicators: list[str] = Field(default_factory=list)
    operator_authorized: bool = True


class ThreatStatusUpdateRequest(BaseModel):
    verification_status: ThreatVerificationStatus


class ThreatRegistryResponse(BaseModel):
    total: int
    categories: list[str] = Field(default_factory=list)
    entries: list[ThreatRegistryEntry]
