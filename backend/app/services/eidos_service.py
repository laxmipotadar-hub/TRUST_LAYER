from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import time
from urllib.parse import quote
from uuid import uuid4
import httpx

from app.core.config import settings
from app.detectif.client import (
    extract_detectifai_error,
    log_raw_detectifai_response,
    parse_eidos_enroll_response,
    parse_eidos_verify_response,
    stable_enrollment_idempotency_key,
    validate_speaker_id,
)
from app.repositories.json_store import repo
from app.schemas import SpeakerIdentityResult, VoiceprintRecord
from app.services.cache_service import cache_service
from app.services.ledger_service import record_operation


NEUTRAL_UNENROLLED_SCORE = 50.0
EIDOS_VERIFY_COST_CREDITS = 500.0


@dataclass
class EidosEnrollOutcome:
    success: bool
    provider_speaker_ref: str | None
    provider_operation_id: str | None
    status: str
    detail: str
    credits_used: float = 0.0
    reconciled: bool = False


@dataclass
class EidosVerifyEvaluation:
    result: SpeakerIdentityResult
    model_status: str  # OK | CACHED | UNENROLLED | UNAVAILABLE | AUTH_ERROR | RATE_LIMITED | TIMEOUT | INVALID_RESPONSE | ERROR


async def fetch_speakers_eidos_checked() -> tuple[bool, list[dict]]:
    """Fetch enrolled speaker profiles from DetectifAI GET /v1/speakers with HTTP-200 status flag."""
    if not settings.detectifai_configured:
        return False, []
    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/speakers"
    headers = {"Authorization": f"Bearer {settings.detectif_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return False, []
            body = resp.json()
            if isinstance(body, dict):
                for key in ("data", "speakers"):
                    val = body.get(key)
                    if isinstance(val, list):
                        return True, [item for item in val if isinstance(item, dict)]
                res = body.get("result")
                if isinstance(res, dict):
                    for key in ("speakers", "data"):
                        val = res.get(key)
                        if isinstance(val, list):
                            return True, [item for item in val if isinstance(item, dict)]
                if isinstance(body.get("speaker"), dict):
                    return True, [body["speaker"]]
            if isinstance(body, list):
                return True, [item for item in body if isinstance(item, dict)]
            return True, []
    except Exception:
        return False, []


async def fetch_speakers_eidos() -> list[dict]:
    """Fetch enrolled speaker profiles from DetectifAI GET /v1/speakers."""
    _, speakers = await fetch_speakers_eidos_checked()
    return speakers


async def find_existing_speaker_eidos(speaker_id: str) -> dict | None:
    """Return existing DetectifAI speaker record if speaker_id is already enrolled on provider."""
    clean = speaker_id.strip()
    if not settings.detectifai_configured or not clean:
        return None
    speakers = await fetch_speakers_eidos()
    for spk in speakers:
        if str(spk.get("speaker_id") or spk.get("id") or "").strip() == clean:
            return spk
    return None


async def enroll_speaker_eidos(
    audio_bytes: bytes,
    speaker_id: str,
    filename: str = "enroll.wav",
    display_name: str | None = None,
    idempotency_key: str | None = None,
) -> EidosEnrollOutcome:
    """Isolated DetectifAI Eidos enrollment via POST /v1/speakers/enroll."""
    if not settings.detectifai_configured:
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status="UNAVAILABLE",
            detail="DETECTIF_API_KEY not configured on server; Eidos live enrollment skipped.",
        )

    try:
        clean_speaker_id = validate_speaker_id(speaker_id)
    except ValueError as exc:
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status="INVALID_SPEAKER_ID",
            detail=str(exc),
        )

    content_type = "audio/wav"
    clean_name = filename or "enroll.wav"
    if audio_bytes[:4] != b"RIFF" and clean_name.lower().endswith(".webm"):
        content_type = "audio/webm"

    stable_key = idempotency_key or stable_enrollment_idempotency_key(clean_speaker_id, audio_bytes)
    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/speakers/enroll"
    headers = {
        "Authorization": f"Bearer {settings.detectif_api_key}",
        "Idempotency-Key": stable_key,
    }
    files = {"file": (clean_name, audio_bytes, content_type)}
    data: dict[str, str] = {"speaker_id": clean_speaker_id}
    if display_name and display_name.strip():
        data["display_name"] = display_name.strip()
    t0 = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            log_raw_detectifai_response("/v1/speakers/enroll", resp)
            if resp.status_code >= 400:
                err = extract_detectifai_error(resp, service_label="Eidos enrollment", speaker_ref=clean_speaker_id)
                return EidosEnrollOutcome(
                    success=False,
                    provider_speaker_ref=None,
                    provider_operation_id=None,
                    status=err.model_status,
                    detail=err.detail,
                )
            body = resp.json()
    except httpx.TimeoutException as exc:
        err = extract_detectifai_error(exc, service_label="Eidos enrollment", speaker_ref=clean_speaker_id)
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status=err.model_status,
            detail=err.detail,
        )
    except httpx.HTTPStatusError as exc:
        err = extract_detectifai_error(exc, service_label="Eidos enrollment", speaker_ref=clean_speaker_id)
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status=err.model_status,
            detail=err.detail,
        )
    except Exception as exc:
        err = extract_detectifai_error(exc, service_label="Eidos enrollment", speaker_ref=clean_speaker_id)
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status=err.model_status,
            detail=err.detail,
        )

    try:
        parsed = parse_eidos_enroll_response(body, fallback_speaker_id=clean_speaker_id)
    except ValueError as exc:
        # Provider returned HTTP 2xx, so check GET /v1/speakers to reconcile instead of re-enrolling & wasting credits
        existing_remote = await find_existing_speaker_eidos(clean_speaker_id)
        if existing_remote is not None:
            rec_sid = str(existing_remote.get("speaker_id") or existing_remote.get("id") or clean_speaker_id).strip()
            return EidosEnrollOutcome(
                success=True,
                provider_speaker_ref=rec_sid,
                provider_operation_id=None,
                status="OK",
                detail=(
                    f"Reconciled provider speaker '{rec_sid}' after HTTP {resp.status_code} "
                    f"response parse mismatch (no duplicate enrollment charge)."
                ),
                credits_used=200.0,
                reconciled=True,
            )
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status="INVALID_RESPONSE",
            detail=f"Eidos enrollment HTTP {resp.status_code} parse error: {exc}",
        )

    op_id = parsed.operation_id or f"op_enr_{uuid4().hex[:8]}"
    record_operation(
        operation_id=op_id,
        call_id=f"ENROLL-{clean_speaker_id}",
        service="enroll",
        endpoint="/v1/speakers/enroll",
        mode="FRESH",
        status="done",
        cost_credits=parsed.credits_used,
        latency_ms=latency_ms,
        cached=False,
    )
    return EidosEnrollOutcome(
        success=True,
        provider_speaker_ref=parsed.speaker_id,
        provider_operation_id=op_id,
        status="OK",
        detail=(
            f"Speaker '{parsed.speaker_id}' enrolled with DetectifAI Eidos "
            f"(op {op_id}, {parsed.credits_used:.0f} credits)."
        ),
        credits_used=parsed.credits_used,
        reconciled=False,
    )


async def delete_speaker_eidos(speaker_id: str) -> tuple[bool, str]:
    """Delete speaker profile from DetectifAI Eidos via DELETE /v1/speakers/{speaker_id}."""
    if not settings.detectifai_configured or speaker_id.startswith("sim-") or speaker_id.startswith("eidos-ref-"):
        return True, "Local/simulation speaker profile revoked."
    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/speakers/{quote(speaker_id, safe='')}"
    headers = {"Authorization": f"Bearer {settings.detectif_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(url, headers=headers)
            if resp.status_code in (200, 204, 404):
                return True, f"Eidos speaker '{speaker_id}' removed (HTTP {resp.status_code})."
            return False, f"Eidos delete failed (HTTP {resp.status_code})."
    except Exception as exc:
        return False, f"Eidos delete network error: {exc.__class__.__name__}"


async def verify_speaker_eidos(
    audio_bytes: bytes | None,
    claimed_customer_id: str,
    filename: str = "verify.wav",
    bypass_cache: bool = False,
    call_id: str | None = None,
) -> EidosVerifyEvaluation:
    """Isolated DetectifAI Eidos verification via POST /v1/speakers/verify."""
    enrolled_vp = repo.get_voiceprint_by_customer(claimed_customer_id)
    if enrolled_vp is None:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=NEUTRAL_UNENROLLED_SCORE,
                match_confidence=0.5,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                enrolled=False,
                status="WARN",
                provenance="REAL ANALYSIS" if settings.detectifai_configured else "SIMULATION",
                detail=(
                    f"Customer '{claimed_customer_id}' is not enrolled in Voiceprint Library; "
                    f"neutral speaker baseline score {NEUTRAL_UNENROLLED_SCORE:.0f} applied."
                ),
            ),
            model_status="UNENROLLED",
        )

    if not audio_bytes:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                enrolled=True,
                status="UNAVAILABLE",
                provenance="REAL ANALYSIS",
                detail="No live audio sample supplied for DetectifAI Eidos verification.",
            ),
            model_status="UNAVAILABLE",
        )

    if not settings.detectifai_configured:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                enrolled=True,
                status="UNAVAILABLE",
                provenance="REAL ANALYSIS",
                detail="DETECTIF_API_KEY not configured on server; Eidos verification unavailable.",
            ),
            model_status="UNAVAILABLE",
        )

    raw_provider_sid = (enrolled_vp.provider_speaker_id or enrolled_vp.provider_speaker_ref or "").strip()
    is_placeholder = raw_provider_sid.startswith(("sim-", "eidos-ref-"))

    if not raw_provider_sid or is_placeholder:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                provider_speaker_id=None,
                decision="SKIPPED",
                enrolled=False,
                skip_reason="no_voice_id",
                similarity_tier="unavailable",
                status="skipped",
                provenance="REAL ANALYSIS",
                detail=(
                    f"Skipped: customer '{claimed_customer_id}' has no live provider_speaker_id "
                    f"(provider_speaker_id={enrolled_vp.provider_speaker_id!r}, "
                    f"ref={enrolled_vp.provider_speaker_ref!r}, "
                    f"source={enrolled_vp.enrollment_source!r})."
                ),
                cost_credits=0.0,
            ),
            model_status="SKIPPED",
        )

    speaker_ref = raw_provider_sid
    cache_key = cache_service.compute_request_hash(
        provider="eidos_verify",
        params={"speaker_id": speaker_ref},
        audio_bytes=audio_bytes,
    )
    if not bypass_cache:
        cached = cache_service.get(cache_key)
        if cached and isinstance(cached.get("payload"), dict):
            res_obj = SpeakerIdentityResult(**{**cached["payload"], "cache_hit": True, "cost_credits": 0.0})
            if call_id:
                record_operation(
                    operation_id=res_obj.operation_id or res_obj.request_id or f"cache_{uuid4().hex[:8]}",
                    call_id=call_id,
                    service="eidos",
                    endpoint="/v1/speakers/verify",
                    mode="CACHED",
                    status="done",
                    cost_credits=0.0,
                    latency_ms=0.0,
                    cached=True,
                )
            return EidosVerifyEvaluation(result=res_obj, model_status="CACHED")

    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/speakers/verify"
    headers = {
        "Authorization": f"Bearer {settings.detectif_api_key}",
        "Idempotency-Key": str(uuid4()),
    }
    content_type = "audio/wav" if audio_bytes[:4] == b"RIFF" else "audio/webm"
    files = {"file": (filename, audio_bytes, content_type)}
    form = {"speaker_id": speaker_ref}
    t0 = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=form)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            log_raw_detectifai_response("/v1/speakers/verify", resp)
            if resp.status_code >= 400:
                err = extract_detectifai_error(resp, service_label="DetectifAI Eidos", speaker_ref=speaker_ref)
                return EidosVerifyEvaluation(
                    result=SpeakerIdentityResult(
                        score=None,
                        match_confidence=None,
                        claimed_customer_id=claimed_customer_id,
                        matched_customer_name=None,
                        provider_speaker_id=speaker_ref,
                        enrolled=err.status_code != 404,
                        similarity_tier="unavailable",
                        status="error",
                        provenance="REAL ANALYSIS",
                        detail=err.detail,
                        latency_ms=latency_ms,
                        error_code=err.error_code,
                        http_status=err.status_code,
                    ),
                    model_status=err.model_status,
                )
            resp.raise_for_status()
            body = resp.json()
    except httpx.TimeoutException as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        err = extract_detectifai_error(exc, service_label="DetectifAI Eidos", speaker_ref=speaker_ref)
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                provider_speaker_id=speaker_ref,
                enrolled=True,
                similarity_tier="unavailable",
                status="error",
                provenance="REAL ANALYSIS",
                detail=err.detail,
                latency_ms=latency_ms,
                error_code=err.error_code,
            ),
            model_status=err.model_status,
        )
    except httpx.HTTPStatusError as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        err = extract_detectifai_error(exc, service_label="DetectifAI Eidos", speaker_ref=speaker_ref)
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                provider_speaker_id=speaker_ref,
                enrolled=err.status_code != 404,
                similarity_tier="unavailable",
                status="error",
                provenance="REAL ANALYSIS",
                detail=err.detail,
                latency_ms=latency_ms,
                error_code=err.error_code,
                http_status=err.status_code,
            ),
            model_status=err.model_status,
        )
    except Exception as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        err = extract_detectifai_error(exc, service_label="DetectifAI Eidos", speaker_ref=speaker_ref)
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                provider_speaker_id=speaker_ref,
                enrolled=True,
                similarity_tier="unavailable",
                status="error",
                provenance="REAL ANALYSIS",
                detail=err.detail,
                latency_ms=latency_ms,
                error_code=err.error_code,
            ),
            model_status=err.model_status,
        )

    try:
        parsed = parse_eidos_verify_response(body)
    except ValueError as exc:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                provider_speaker_id=speaker_ref,
                enrolled=True,
                similarity_tier="unavailable",
                status="error",
                provenance="REAL ANALYSIS",
                detail=f"DetectifAI Eidos HTTP {resp.status_code} parse error: {exc}",
                latency_ms=latency_ms,
                error_code="invalid_response",
                http_status=resp.status_code,
                raw_payload=body if isinstance(body, dict) else None,
            ),
            model_status="INVALID_RESPONSE",
        )

    similarity = parsed.similarity
    decision_lower = parsed.decision
    decision_display = "MATCH" if decision_lower == "match" else "NO_MATCH"
    match_pct = round(max(0.0, min(1.0, similarity)) * 100.0, 1)
    status = "PASS" if decision_lower == "match" else "FAIL"
    op_id = parsed.operation_id or f"op_eid_{uuid4().hex[:8]}"
    credits_used = parsed.credits_used

    normalized = SpeakerIdentityResult(
        score=match_pct,
        match_confidence=round(max(-1.0, min(1.0, similarity)), 3),
        claimed_customer_id=claimed_customer_id,
        matched_customer_name=enrolled_vp.customer_name if decision_lower == "match" else None,
        provider_speaker_id=speaker_ref,
        decision=decision_display,
        enrolled=True,
        status=status,
        provenance="REAL ANALYSIS",
        detail=(
            f"DetectifAI Eidos decision={decision_display} for speaker '{speaker_ref}' "
            f"(similarity {similarity:.3f}, match {match_pct:.1f}%)."
        ),
        cache_hit=False,
        request_id=body.get("request_id") if isinstance(body, dict) else None,
        operation_id=op_id,
        cost_credits=credits_used,
        latency_ms=latency_ms,
        raw_payload=body if isinstance(body, dict) else None,
    )
    cache_service.set(cache_key, "eidos_verify", normalized.model_dump())
    record_operation(
        operation_id=op_id or f"op_eid_{uuid4().hex[:8]}",
        call_id=call_id or f"VERIFY-{claimed_customer_id}",
        service="eidos",
        endpoint="/v1/speakers/verify",
        mode="FRESH",
        status="done",
        cost_credits=credits_used,
        latency_ms=latency_ms,
        cached=False,
    )

    return EidosVerifyEvaluation(result=normalized, model_status="OK")


async def enroll_customer_voiceprint(
    *,
    audio_bytes: bytes,
    customer_id: str,
    customer_name: str,
    account_tier: str = "Private Banking",
    enrollment_purpose: str = "Banking Call Authentication & Fraud Prevention",
    sample_duration_sec: float = 6.0,
    filename: str = "enroll.wav",
    execution_mode: str | None = None,
) -> VoiceprintRecord:
    """Shared enrollment service used by both Voiceprints API and Live Demo."""
    now = datetime.now(timezone.utc).isoformat()
    cid = customer_id.strip()
    state = repo.get_settings_state()
    use_real_eidos = (
        state["app_mode"] == "REAL"
        or (execution_mode or "").strip().upper() in ("LIVE", "REAL")
    )

    if use_real_eidos:
        existing_remote = await find_existing_speaker_eidos(cid)
        if existing_remote is not None:
            provider_sid = str(
                existing_remote.get("speaker_id") or existing_remote.get("id") or cid
            ).strip()
            source = "REAL ANALYSIS"
            ref = provider_sid
            op_id = None
            credits_used = 0.0
            reconciled = True
        else:
            outcome = await enroll_speaker_eidos(
                audio_bytes=audio_bytes,
                speaker_id=cid,
                filename=filename,
                display_name=customer_name.strip(),
            )
            if not outcome.success or not outcome.provider_speaker_ref:
                raise RuntimeError(outcome.detail)
            provider_sid = outcome.provider_speaker_ref.strip()
            source = "REAL ANALYSIS"
            ref = provider_sid
            op_id = outcome.provider_operation_id
            credits_used = outcome.credits_used
            reconciled = outcome.reconciled
    else:
        source = "SIMULATION"
        provider_sid = None
        ref = f"sim-{cid}"
        op_id = None
        credits_used = 0.0
        reconciled = False

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
        provider_speaker_id=provider_sid,
        provider_speaker_ref=ref,
        provider_operation_id=op_id,
        credits_used=credits_used,
        reconciled=reconciled,
        status="ACTIVE",
    )
    return repo.add_voiceprint(record)


async def resync_voiceprints_from_provider() -> list[VoiceprintRecord]:
    """Re-sync local voiceprints against DetectifAI GET /v1/speakers at 0 credits."""
    remote_ok, remote_speakers = await fetch_speakers_eidos_checked()
    remote_ids = {
        str(spk.get("speaker_id") or spk.get("id") or "").strip()
        for spk in remote_speakers
        if str(spk.get("speaker_id") or spk.get("id") or "").strip()
    }
    local_list = repo.list_voiceprints()

    # Clear stale provider_speaker_id values from a different/previous DetectifAI account if GET /v1/speakers succeeded
    if remote_ok:
        for vp in local_list:
            cur_pid = (vp.provider_speaker_id or vp.provider_speaker_ref or "").strip()
            if (
                vp.status == "ACTIVE"
                and cur_pid
                and not cur_pid.startswith(("sim-", "eidos-ref-"))
                and cur_pid not in remote_ids
            ):
                repo.delete_voiceprint(vp.voiceprint_id)
                repaired = vp.model_copy(
                    update={
                        "provider_speaker_id": None,
                        "provider_speaker_ref": None,
                        "reconciled": False,
                    }
                )
                repo.add_voiceprint(repaired)
        local_list = repo.list_voiceprints()

    local_by_cid = {vp.customer_id: vp for vp in local_list}
    local_by_cid_lower = {vp.customer_id.strip().lower(): vp for vp in local_list}

    for spk in remote_speakers:
        sid = str(spk.get("speaker_id") or spk.get("id") or "").strip()
        if not sid:
            continue
        existing = local_by_cid.get(sid) or local_by_cid_lower.get(sid.lower())
        existing_pid = (
            (existing.provider_speaker_id or existing.provider_speaker_ref or "").strip()
            if existing
            else ""
        )
        has_valid_local_id = (
            existing is not None
            and existing.status == "ACTIVE"
            and bool(existing_pid)
            and not existing_pid.startswith(("sim-", "eidos-ref-"))
            and existing.provider_speaker_id == sid
            and str(existing.enrollment_source).upper() == "REAL ANALYSIS"
        )
        if has_valid_local_id:
            continue

        now = str(spk.get("created_at") or datetime.now(timezone.utc).isoformat())
        display = str(spk.get("display_name") or sid).strip()
        target_cid = existing.customer_id if existing else sid
        record = VoiceprintRecord(
            voiceprint_id=existing.voiceprint_id if existing else f"VP-{uuid4().hex[:6].upper()}",
            customer_id=target_cid,
            customer_name=existing.customer_name if existing else display,
            account_tier=existing.account_tier if existing else "Private Banking",
            enrollment_purpose=existing.enrollment_purpose if existing else "Banking Call Authentication & Fraud Prevention",
            consent_confirmed=True,
            consent_timestamp=existing.consent_timestamp if existing and existing.consent_timestamp else now,
            enrolled_at=existing.enrolled_at if existing and existing.enrolled_at else now,
            sample_duration_sec=max(
                5.0,
                float(spk.get("samples") or spk.get("sample_count") or 1) * 5.0,
            ),
            enrollment_source="REAL ANALYSIS",
            provider_speaker_id=sid,
            provider_speaker_ref=sid,
            provider_operation_id=existing.provider_operation_id if existing else None,
            credits_used=0.0,
            reconciled=True,
            verification_history=existing.verification_history if existing else [],
            verification_count=existing.verification_count if existing else 0,
            mismatch_count=existing.mismatch_count if existing else 0,
            last_verified_at=existing.last_verified_at if existing else None,
            last_verification_status=existing.last_verification_status if existing else "UNVERIFIED",
            last_match_percentage=existing.last_match_percentage if existing else None,
            status="ACTIVE",
        )
        repo.add_voiceprint(record)
    return repo.list_voiceprints()
