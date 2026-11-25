from __future__ import annotations

from dataclasses import dataclass
import time
from urllib.parse import quote
from uuid import uuid4
import httpx

from app.core.config import settings
from app.repositories.json_store import repo
from app.schemas import SpeakerIdentityResult
from app.services.cache_service import cache_service
from app.services.ledger_service import record_operation


NEUTRAL_UNENROLLED_SCORE = 50.0


@dataclass
class EidosEnrollOutcome:
    success: bool
    provider_speaker_ref: str | None
    provider_operation_id: str | None
    status: str
    detail: str


@dataclass
class EidosVerifyEvaluation:
    result: SpeakerIdentityResult
    model_status: str  # OK | CACHED | UNENROLLED | UNAVAILABLE | AUTH_ERROR | RATE_LIMITED | TIMEOUT | INVALID_RESPONSE | ERROR


async def enroll_speaker_eidos(
    audio_bytes: bytes,
    speaker_id: str,
    filename: str = "enroll.wav",
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

    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/speakers/enroll"
    headers = {
        "Authorization": f"Bearer {settings.detectif_api_key}",
        "Idempotency-Key": str(uuid4()),
    }
    files = {"file": (filename, audio_bytes, "audio/wav")}
    data = {"speaker_id": speaker_id}
    t0 = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            if resp.status_code in (401, 403):
                return EidosEnrollOutcome(
                    success=False,
                    provider_speaker_ref=None,
                    provider_operation_id=None,
                    status="AUTH_ERROR",
                    detail=f"Eidos authentication failed (HTTP {resp.status_code}).",
                )
            if resp.status_code == 402:
                return EidosEnrollOutcome(
                    success=False,
                    provider_speaker_ref=None,
                    provider_operation_id=None,
                    status="INSUFFICIENT_CREDITS",
                    detail="DetectifAI credit balance exhausted (HTTP 402).",
                )
            if resp.status_code == 429:
                return EidosEnrollOutcome(
                    success=False,
                    provider_speaker_ref=None,
                    provider_operation_id=None,
                    status="RATE_LIMITED",
                    detail="Eidos enrollment rate limit exceeded (HTTP 429).",
                )
            resp.raise_for_status()
            body = resp.json()
    except httpx.TimeoutException:
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status="TIMEOUT",
            detail="Eidos enrollment timed out.",
        )
    except Exception as exc:
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status="ERROR",
            detail=f"Eidos enrollment error: {exc}",
        )

    res = body.get("result") if isinstance(body, dict) else None
    if not isinstance(res, dict):
        return EidosEnrollOutcome(
            success=False,
            provider_speaker_ref=None,
            provider_operation_id=None,
            status="INVALID_RESPONSE",
            detail="Eidos enrollment returned unexpected response structure.",
        )

    op_id = body.get("operation_id") or body.get("request_id") or f"op_enr_{uuid4().hex[:8]}"
    record_operation(
        operation_id=op_id,
        call_id=f"ENROLL-{speaker_id}",
        service="enroll",
        endpoint="/v1/speakers/enroll",
        mode="FRESH",
        status="done",
        cost_credits=float(body.get("credits_used") or body.get("cost_credits") or 200.0),
        latency_ms=latency_ms,
        cached=False,
    )
    return EidosEnrollOutcome(
        success=True,
        provider_speaker_ref=str(res.get("speaker_id", speaker_id)),
        provider_operation_id=op_id,
        status="OK",
        detail="Speaker voiceprint enrolled with DetectifAI Eidos.",
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
                matched_customer_name=enrolled_vp.customer_name,
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
                matched_customer_name=enrolled_vp.customer_name,
                enrolled=True,
                status="UNAVAILABLE",
                provenance="REAL ANALYSIS",
                detail="DETECTIF_API_KEY not configured on server; Eidos verification unavailable.",
            ),
            model_status="UNAVAILABLE",
        )

    speaker_ref = enrolled_vp.provider_speaker_ref or claimed_customer_id
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
    files = {"file": (filename, audio_bytes, "audio/wav")}
    form = {"speaker_id": speaker_ref}
    t0 = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=form)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            if resp.status_code == 404:
                return EidosVerifyEvaluation(
                    result=SpeakerIdentityResult(
                        score=NEUTRAL_UNENROLLED_SCORE,
                        match_confidence=0.5,
                        claimed_customer_id=claimed_customer_id,
                        matched_customer_name=None,
                        enrolled=False,
                        status="WARN",
                        provenance="REAL ANALYSIS",
                        detail=(
                            f"Speaker '{speaker_ref}' is unregistered on DetectifAI Eidos; "
                            f"neutral score {NEUTRAL_UNENROLLED_SCORE:.0f} applied."
                        ),
                    ),
                    model_status="UNENROLLED",
                )
            if resp.status_code in (401, 403):
                return EidosVerifyEvaluation(
                    result=SpeakerIdentityResult(
                        score=None,
                        match_confidence=None,
                        claimed_customer_id=claimed_customer_id,
                        matched_customer_name=enrolled_vp.customer_name,
                        enrolled=True,
                        status="UNAVAILABLE",
                        provenance="REAL ANALYSIS",
                        detail=f"DetectifAI Eidos authentication failed (HTTP {resp.status_code}).",
                    ),
                    model_status="AUTH_ERROR",
                )
            if resp.status_code == 429:
                return EidosVerifyEvaluation(
                    result=SpeakerIdentityResult(
                        score=None,
                        match_confidence=None,
                        claimed_customer_id=claimed_customer_id,
                        matched_customer_name=enrolled_vp.customer_name,
                        enrolled=True,
                        status="UNAVAILABLE",
                        provenance="REAL ANALYSIS",
                        detail="DetectifAI Eidos rate limit exceeded (HTTP 429).",
                    ),
                    model_status="RATE_LIMITED",
                )
            resp.raise_for_status()
            body = resp.json()
    except httpx.TimeoutException:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=enrolled_vp.customer_name,
                enrolled=True,
                status="UNAVAILABLE",
                provenance="REAL ANALYSIS",
                detail="DetectifAI Eidos verification timed out.",
            ),
            model_status="TIMEOUT",
        )
    except Exception as exc:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=enrolled_vp.customer_name,
                enrolled=True,
                status="UNAVAILABLE",
                provenance="REAL ANALYSIS",
                detail=f"DetectifAI Eidos request failed: {exc.__class__.__name__}",
            ),
            model_status="ERROR",
        )

    res = body.get("result") if isinstance(body, dict) else None
    if not isinstance(res, dict) or "decision" not in res or "similarity" not in res:
        return EidosVerifyEvaluation(
            result=SpeakerIdentityResult(
                score=None,
                match_confidence=None,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=enrolled_vp.customer_name,
                enrolled=True,
                status="UNAVAILABLE",
                provenance="REAL ANALYSIS",
                detail="DetectifAI Eidos returned invalid response structure.",
            ),
            model_status="INVALID_RESPONSE",
        )

    similarity = float(res["similarity"])
    decision = str(res["decision"]).lower()
    match_pct = round(max(0.0, min(1.0, similarity)) * 100.0, 1)
    status = "PASS" if decision == "match" else "FAIL"
    op_id = body.get("operation_id") or body.get("request_id")
    credits_used = float(body.get("credits_used") or body.get("cost_credits") or 500.0)

    normalized = SpeakerIdentityResult(
        score=match_pct,
        match_confidence=round(max(-1.0, min(1.0, similarity)), 3),
        claimed_customer_id=claimed_customer_id,
        matched_customer_name=enrolled_vp.customer_name if decision == "match" else None,
        enrolled=True,
        status=status,
        provenance="REAL ANALYSIS",
        detail=(
            f"DetectifAI Eidos decision='{decision}' (similarity {similarity:.3f}, "
            f"match {match_pct:.1f}%)."
        ),
        cache_hit=False,
        request_id=body.get("request_id"),
        operation_id=op_id,
        cost_credits=credits_used,
        latency_ms=latency_ms,
        raw_payload=body,
    )
    if not bypass_cache:
        cache_service.set(cache_key, "eidos_verify", normalized.model_dump())
    if call_id:
        record_operation(
            operation_id=op_id or f"op_eid_{uuid4().hex[:8]}",
            call_id=call_id,
            service="eidos",
            endpoint="/v1/speakers/verify",
            mode="FRESH",
            status="done",
            cost_credits=credits_used,
            latency_ms=latency_ms,
            cached=False,
        )

    return EidosVerifyEvaluation(result=normalized, model_status="OK")
