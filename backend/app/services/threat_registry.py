from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from uuid import uuid4

from fastapi import HTTPException

from app.repositories.json_store import repo
from app.schemas import (
    ThreatRegistryEntry,
    ThreatRegistryResponse,
    ThreatSubmitRequest,
    ThreatVerificationStatus,
)


def anonymize_speaker_reference(raw_ref: str) -> str:
    """One-way SHA-256 anonymization so no identifiable customer data or voiceprint is exposed."""
    digest = hashlib.sha256(f"aegis-threat-salt:{raw_ref.strip()}".encode("utf-8")).hexdigest()
    return f"anon-spk-{digest[:10]}"


def get_threat_registry_snapshot(category: str | None = None) -> ThreatRegistryResponse:
    entries = repo.list_threat_registry()
    categories = sorted({e.category for e in entries})
    if category and category.upper() != "ALL":
        entries = [e for e in entries if e.category.lower() == category.lower()]
    return ThreatRegistryResponse(total=len(entries), categories=categories, entries=entries)


def submit_threat_record(payload: ThreatSubmitRequest) -> ThreatRegistryEntry:
    if not payload.operator_authorized:
        raise HTTPException(
            status_code=403,
            detail="Only authorized SOC operators may publish entries to the Threat Registry.",
        )

    now = datetime.now(timezone.utc).isoformat()
    anon_ref = anonymize_speaker_reference(payload.raw_speaker_reference)

    entry = ThreatRegistryEntry(
        entry_id=f"TH-{datetime.now(timezone.utc).year}-{uuid4().hex[:4].upper()}",
        pattern_name=payload.pattern_name.strip(),
        anonymous_speaker_ref=anon_ref,
        category=payload.category.strip(),
        severity=payload.severity,
        detection_date=now,
        evidence_reference=payload.evidence_reference.strip() or "Operator Flagged Call",
        verification_status="PENDING REVIEW",
        institution_scope="Local SOC Instance (Federation-Ready Schema)",
        indicators=[i.strip() for i in payload.indicators if i.strip()],
        reported_institutions=1,
        last_seen=now,
        provenance="SIMULATION",
    )
    return repo.add_threat_entry(entry)


def change_threat_verification_status(
    entry_id: str,
    status: ThreatVerificationStatus,
) -> ThreatRegistryEntry:
    updated = repo.update_threat_status(entry_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Threat entry '{entry_id}' not found.")
    return updated
