from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


LedgerMode = Literal["FRESH", "CACHED", "DEMO"]


class OperationLedgerEntry(BaseModel):
    operation_id: str
    call_id: str
    service: Literal["aletheia", "eidos", "groq", "enroll", "challenge", "pipeline"]
    endpoint: str
    mode: LedgerMode
    status: str = "done"
    cost_credits: float = Field(default=0.0, ge=0.0)
    latency_ms: float = Field(default=0.0, ge=0.0)
    timestamp: str
    cached: bool = False


class CreditsResponse(BaseModel):
    available: Optional[float] = None
    reserved: Optional[float] = None
    currency: str = "credits"
    configured: bool
    latency_ms: float = 0.0
    error: Optional[str] = None
    raw_payload: Optional[dict[str, Any]] = None


class ProviderReconciliation(BaseModel):
    status: Literal["RECONCILED", "PARTIAL", "UNAVAILABLE"] = "UNAVAILABLE"
    matched_count: int = 0
    unmatched_local_count: int = 0
    provider_record_count: int = 0
    provider_credits_total: float = 0.0
    matched_operation_ids: list[str] = Field(default_factory=list)
    note: str = ""


class UsageSummaryResponse(BaseModel):
    credit_balance: Optional[float] = None
    credit_balance_error: Optional[str] = None
    total_calls_analyzed: int = 0
    total_credits_used: float = 0.0
    total_credits_saved: float = 0.0
    burn_rate_per_call: float = 0.0
    aletheia_calls: int = 0
    eidos_calls: int = 0
    groq_calls: int = 0
    cache_hits: int = 0
    fresh_calls: int = 0
    operations: list[OperationLedgerEntry] = Field(default_factory=list)
    provider_usage_raw: Optional[dict[str, Any]] = None
    reconciliation: ProviderReconciliation = Field(default_factory=ProviderReconciliation)
