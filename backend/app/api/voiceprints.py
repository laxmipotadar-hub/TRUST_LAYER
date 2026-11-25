from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.repositories.json_store import repo
from app.schemas import (
    VoiceprintDeleteResponse,
    VoiceprintEnrollRequest,
    VoiceprintRecord,
    VoiceprintVerificationEntry,
    VoiceprintVerifyResponse,
)
from app.services.eidos_service import (
    delete_speaker_eidos,
    enroll_speaker_eidos,
    fetch_speakers_eidos,
    find_existing_speaker_eidos,
    verify_speaker_eidos,
)


router = APIRouter(prefix="/voiceprints", tags=["voiceprints"])


@router.get("", response_model=list[VoiceprintRecord])
def list_voiceprints() -> list[VoiceprintRecord]:
    return repo.list_voiceprints()


@router.post("/reconcile", response_model=list[VoiceprintRecord])
async def reconcile_voiceprints() -> list[VoiceprintRecord]:
    """Import any existing DetectifAI Eidos speakers missing from local voiceprints without re-charging."""
    remote_speakers = await fetch_speakers_eidos()
    local_by_cid = {vp.customer_id: vp for vp in repo.list_voiceprints()}
    for spk in remote_speakers:
        sid = str(spk.get("speaker_id") or spk.get("id") or "").strip()
        if not sid:
            continue
        existing = local_by_cid.get(sid)
        if existing and existing.enrollment_source == "REAL ANALYSIS" and existing.provider_speaker_ref == sid:
            continue
        now = str(spk.get("created_at") or datetime.now(timezone.utc).isoformat())
        display = str(spk.get("display_name") or sid).strip()
        record = VoiceprintRecord(
            voiceprint_id=existing.voiceprint_id if existing else f"VP-{uuid4().hex[:6].upper()}",
            customer_id=sid,
            customer_name=existing.customer_name if existing else display,
            account_tier=existing.account_tier if existing else "Private Banking",
            enrollment_purpose="Banking Call Authentication & Fraud Prevention",
            consent_confirmed=True,
            consent_timestamp=now,
            enrolled_at=now,
            sample_duration_sec=max(5.0, float(spk.get("samples") or 1) * 5.0),
            enrollment_source="REAL ANALYSIS",
            provider_speaker_ref=sid,
            provider_operation_id=existing.provider_operation_id if existing else None,
            credits_used=0.0,
            reconciled=True,
            status="ACTIVE",
        )
        repo.add_voiceprint(record)
    return repo.list_voiceprints()


@router.post("/enroll", response_model=VoiceprintRecord)
def enroll_voiceprint(payload: VoiceprintEnrollRequest) -> VoiceprintRecord:
    if not payload.consent_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Explicit customer voice-biometric consent is required before enrollment.",
        )

    now = datetime.now(timezone.utc).isoformat()
    cid = payload.customer_id.strip()
    record = VoiceprintRecord(
        voiceprint_id=f"VP-{uuid4().hex[:6].upper()}",
        customer_id=cid,
        customer_name=payload.customer_name.strip(),
        account_tier=payload.account_tier.strip(),
        enrollment_purpose=payload.enrollment_purpose.strip(),
        consent_confirmed=True,
        consent_timestamp=now,
        enrolled_at=now,
        sample_duration_sec=payload.sample_duration_sec,
        enrollment_source="SIMULATION",
        provider_speaker_ref=f"sim-{cid}",
        status="ACTIVE",
    )
    return repo.add_voiceprint(record)


@router.post("/enroll-audio", response_model=VoiceprintRecord)
async def enroll_voiceprint_with_audio(
    file: UploadFile = File(...),
    customer_id: str = Form(...),
    customer_name: str = Form(...),
    account_tier: str = Form(default="Private Banking"),
    enrollment_purpose: str = Form(default="Banking Call Authentication & Fraud Prevention"),
    consent_confirmed: bool = Form(default=False),
    sample_duration_sec: float = Form(default=6.0),
) -> VoiceprintRecord:
    if not consent_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Explicit customer consent must be confirmed before capturing or submitting voice audio.",
        )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio sample is empty.")

    now = datetime.now(timezone.utc).isoformat()
    cid = customer_id.strip()
    state = repo.get_settings_state()

    if state["app_mode"] == "REAL":
        outcome = await enroll_speaker_eidos(
            audio_bytes=audio_bytes,
            speaker_id=cid,
            filename=file.filename or "enroll.wav",
        )
        if not outcome.success:
            raise HTTPException(status_code=502, detail=outcome.detail)
        source = "REAL ANALYSIS"
        ref = outcome.provider_speaker_ref
        op_id = outcome.provider_operation_id
    else:
        source = "SIMULATION"
        ref = f"sim-{cid}"
        op_id = None

    # Raw audio bytes are never saved to disk; only speaker reference & metadata are persisted.
    record = VoiceprintRecord(
        voiceprint_id=f"VP-{uuid4().hex[:6].upper()}",
        customer_id=cid,
        customer_name=customer_name.strip(),
        account_tier=account_tier.strip(),
        enrollment_purpose=enrollment_purpose.strip(),
        consent_confirmed=True,
        consent_timestamp=now,
        enrolled_at=now,
        sample_duration_sec=sample_duration_sec,
        enrollment_source=source,
        provider_speaker_ref=ref,
        provider_operation_id=op_id,
        status="ACTIVE",
    )
    return repo.add_voiceprint(record)


@router.post("/verify", response_model=VoiceprintVerifyResponse)
async def verify_voiceprint_audio(
    file: UploadFile | None = File(default=None),
    claimed_customer_id: str = Form(...),
    simulate_outcome: str = Form(default="match"),
) -> VoiceprintVerifyResponse:
    cid = claimed_customer_id.strip()
    enrolled = repo.get_voiceprint_by_customer(cid)
    now = datetime.now(timezone.utc).isoformat()
    state = repo.get_settings_state()

    audio_bytes = await file.read() if file is not None else None

    if state["app_mode"] == "REAL":
        evaluation = await verify_speaker_eidos(
            audio_bytes=audio_bytes,
            claimed_customer_id=cid,
            filename=(file.filename or "verify.wav") if file is not None else "no_audio.wav",
        )
        res = evaluation.result
        if res.status == "UNAVAILABLE":
            ver_status = "UNAVAILABLE"
        elif res.status == "PASS":
            ver_status = "VERIFIED"
        else:
            ver_status = "MISMATCH"

        entry = VoiceprintVerificationEntry(
            verification_id=f"VER-{uuid4().hex[:6].upper()}",
            verified_at=now,
            match_percentage=res.score,
            result=ver_status,
            claimed_identity=cid,
            verified_identity=res.matched_customer_name,
            provenance=res.provenance,
            notes=res.detail,
        )
        updated_vp = repo.record_voiceprint_verification(cid, entry.model_dump())

        return VoiceprintVerifyResponse(
            voiceprint_id=updated_vp.voiceprint_id if updated_vp else "UNENROLLED",
            match_percentage=res.score,
            verification_result=ver_status,
            claimed_identity=cid,
            verified_identity=res.matched_customer_name,
            timestamp=now,
            provenance=res.provenance,
            notes=res.detail,
        )

    # DEMO Mode: clearly labelled SIMULATION verification (never presents simulated results as real Eidos)
    if not enrolled:
        return VoiceprintVerifyResponse(
            voiceprint_id="UNENROLLED",
            match_percentage=50.0,
            verification_result="UNVERIFIED",
            claimed_identity=cid,
            verified_identity=None,
            timestamp=now,
            provenance="SIMULATION",
            notes=f"Customer '{cid}' is not enrolled or has been revoked; neutral score 50.0 applied.",
        )

    is_match = simulate_outcome != "mismatch"
    match_pct = 93.4 if is_match else 21.5
    ver_status = "VERIFIED" if is_match else "MISMATCH"
    verified_name = enrolled.customer_name if is_match else None
    notes = (
        f"SIMULATION verification against Eidos ref '{enrolled.provider_speaker_ref or cid}': "
        f"{'speaker match confirmed' if is_match else 'speaker mismatch flagged'}."
    )

    entry = VoiceprintVerificationEntry(
        verification_id=f"VER-{uuid4().hex[:6].upper()}",
        verified_at=now,
        match_percentage=match_pct,
        result=ver_status,
        claimed_identity=cid,
        verified_identity=verified_name,
        provenance="SIMULATION",
        notes=notes,
    )
    repo.record_voiceprint_verification(cid, entry.model_dump())

    return VoiceprintVerifyResponse(
        voiceprint_id=enrolled.voiceprint_id,
        match_percentage=match_pct,
        verification_result=ver_status,
        claimed_identity=cid,
        verified_identity=verified_name,
        timestamp=now,
        provenance="SIMULATION",
        notes=notes,
    )


@router.post("/{voiceprint_id}/revoke", response_model=VoiceprintRecord)
async def revoke_voiceprint(voiceprint_id: str) -> VoiceprintRecord:
    existing = next((v for v in repo.list_voiceprints() if v.voiceprint_id == voiceprint_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Voiceprint '{voiceprint_id}' not found.")
    state = repo.get_settings_state()
    if state["app_mode"] == "REAL" and existing.provider_speaker_ref:
        ok, msg = await delete_speaker_eidos(existing.provider_speaker_ref)
        if not ok:
            raise HTTPException(status_code=502, detail=msg)
    revoked = repo.revoke_voiceprint(voiceprint_id, datetime.now(timezone.utc).isoformat())
    if not revoked:
        raise HTTPException(status_code=404, detail=f"Voiceprint '{voiceprint_id}' not found.")
    return revoked


@router.delete("/{voiceprint_id}", response_model=VoiceprintDeleteResponse)
async def delete_voiceprint(voiceprint_id: str) -> VoiceprintDeleteResponse:
    existing = next((v for v in repo.list_voiceprints() if v.voiceprint_id == voiceprint_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Voiceprint '{voiceprint_id}' not found.")
    state = repo.get_settings_state()
    if state["app_mode"] == "REAL" and existing.provider_speaker_ref:
        ok, msg = await delete_speaker_eidos(existing.provider_speaker_ref)
        if not ok:
            raise HTTPException(status_code=502, detail=msg)
    deleted = repo.delete_voiceprint(voiceprint_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Voiceprint '{voiceprint_id}' not found.")
    return VoiceprintDeleteResponse(deleted=True, voiceprint_id=voiceprint_id)
