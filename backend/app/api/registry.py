from __future__ import annotations

from fastapi import APIRouter

from app.schemas import (
    ThreatRegistryEntry,
    ThreatRegistryResponse,
    ThreatStatusUpdateRequest,
    ThreatSubmitRequest,
)
from app.services.threat_registry import (
    change_threat_verification_status,
    get_threat_registry_snapshot,
    submit_threat_record,
)


router = APIRouter(prefix="/threat-registry", tags=["registry"])


@router.get("", response_model=ThreatRegistryResponse)
def get_threat_registry(category: str | None = None) -> ThreatRegistryResponse:
    return get_threat_registry_snapshot(category=category)


@router.post("", response_model=ThreatRegistryEntry)
def post_threat_registry(payload: ThreatSubmitRequest) -> ThreatRegistryEntry:
    return submit_threat_record(payload)


@router.patch("/{entry_id}", response_model=ThreatRegistryEntry)
def patch_threat_registry_status(
    entry_id: str,
    payload: ThreatStatusUpdateRequest,
) -> ThreatRegistryEntry:
    return change_threat_verification_status(entry_id, payload.verification_status)
