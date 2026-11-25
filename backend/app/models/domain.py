from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional


AppMode = Literal["DEMO", "REAL"]
Provenance = Literal["REAL ANALYSIS", "CACHED ANALYSIS", "SIMULATION"]
TrustVerdict = Literal["TRUSTED", "CAUTION", "HIGH RISK", "BLOCKED"]


@dataclass
class VoiceprintDomainModel:
    voiceprint_id: str
    customer_id: str
    customer_name: str
    account_tier: str
    enrolled_at: str
    sample_duration_sec: float
    enrollment_source: Provenance
    status: Literal["ACTIVE", "REVOKED"] = "ACTIVE"


@dataclass
class ChallengeDomainModel:
    challenge_id: str
    call_id: Optional[str]
    phrase: str
    created_at: str
    status: Literal["PENDING", "PASSED", "FAILED"] = "PENDING"
    latency_ms: Optional[int] = None
    notes: str = ""


@dataclass
class ThreatRegistryDomainModel:
    entry_id: str
    pattern_name: str
    category: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    indicators: list[str] = field(default_factory=list)
    reported_institutions: int = 1
    last_seen: str = ""
