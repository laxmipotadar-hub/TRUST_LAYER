from __future__ import annotations

from dataclasses import dataclass
import hashlib
import logging
import re
import uuid
import httpx

from app.core.config import settings


logger = logging.getLogger("aegis.detectif")

_SPEAKER_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


def validate_speaker_id(speaker_id: str) -> str:
    clean = speaker_id.strip()
    if not _SPEAKER_ID_RE.match(clean):
        raise ValueError(
            f"Invalid speaker_id '{clean}'. Must match ^[A-Za-z0-9_.:-]{{1,64}}$."
        )
    return clean


def stable_enrollment_idempotency_key(speaker_id: str, audio_bytes: bytes) -> str:
    """Deterministic per-attempt Idempotency-Key so duplicate retries never double-charge."""
    digest = hashlib.sha256(speaker_id.encode("utf-8") + b":" + audio_bytes).hexdigest()
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"aegis:enroll:{digest}"))


def log_raw_detectifai_response(
    endpoint: str,
    response: httpx.Response,
) -> None:
    """Safely log raw status, non-auth headers, and truncated response body before parsing."""
    raw_headers = getattr(response, "headers", None)
    safe_headers: dict[str, str] = {}
    try:
        items = raw_headers.items() if raw_headers is not None else ()
        if not isinstance(items, (list, tuple)) and not hasattr(items, "__iter__"):
            items = ()
        for k, v in items:
            ks = str(k)
            if ks.lower() not in ("authorization", "x-api-key", "set-cookie", "cookie"):
                safe_headers[ks] = str(v)
    except Exception:
        safe_headers = {}
    raw_text = getattr(response, "text", "")
    preview_src = raw_text[:1024] if isinstance(raw_text, str) else ""
    body_preview = _sanitize_error_text(preview_src)
    logger.info(
        "DetectifAI RAW response [%s] status=%s headers=%s body=%s",
        endpoint,
        getattr(response, "status_code", "?"),
        safe_headers,
        body_preview,
    )


@dataclass(frozen=True)
class ParsedEidosEnroll:
    speaker_id: str
    operation_id: str
    credits_used: float
    samples: int | None
    raw_keys: list[str]


@dataclass(frozen=True)
class ParsedEidosVerify:
    decision: str  # MATCH | NO_MATCH | normalized lowercase
    similarity: float
    operation_id: str
    credits_used: float
    duration_seconds: float | None
    raw_keys: list[str]


def parse_eidos_enroll_response(body: object, *, fallback_speaker_id: str = "") -> ParsedEidosEnroll:
    """
    Tolerant parser for POST /v1/speakers/enroll:
    - Inspects nested speaker.speaker_id (body["speaker"], result["speaker"], data["speaker"]),
      plus result, data, and top-level objects
    - Accepts speaker_id or id
    - Reads operation_id or request_id from body or nested objects
    - Refuses pending/failed/error responses even when HTTP 200
    - Never fabricates an active enrollment if no provider speaker_id was returned
    """
    if not isinstance(body, dict):
        raise ValueError(f"Expected JSON object from Eidos enroll, got {type(body).__name__}.")

    top_keys = sorted(str(k) for k in body.keys())

    # Catch error or non-confirmed status returned on HTTP 200
    if body.get("error"):
        err = body.get("error")
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise ValueError(
            f"DetectifAI returned error payload on HTTP 200: {_sanitize_error_text(str(msg))} (keys={top_keys})"
        )
    raw_status = str(body.get("status", "")).lower()
    if raw_status in ("failed", "rejected", "error", "pending", "processing"):
        raise ValueError(f"DetectifAI enrollment status='{body.get('status')}' (keys={top_keys})")

    nested_result = body.get("result") if isinstance(body.get("result"), dict) else None
    nested_data = body.get("data") if isinstance(body.get("data"), dict) else None
    payload = nested_result or nested_data or body

    speaker_obj = (
        (body.get("speaker") if isinstance(body.get("speaker"), dict) else None)
        or (payload.get("speaker") if isinstance(payload.get("speaker"), dict) else None)
    )

    collected_keys: set[str] = set(top_keys)
    for d in (nested_result, nested_data, speaker_obj):
        if isinstance(d, dict):
            collected_keys.update(str(k) for k in d.keys())
    combined_keys = sorted(collected_keys)

    speaker_val = None
    for source in (speaker_obj, nested_result, nested_data, body):
        if isinstance(source, dict):
            cand = source.get("speaker_id") or source.get("id")
            if isinstance(cand, str) and cand.strip():
                speaker_val = cand.strip()
                break

    op_val = ""
    for source in (body, nested_result, nested_data, speaker_obj):
        if isinstance(source, dict):
            cand = source.get("operation_id") or source.get("request_id")
            if isinstance(cand, str) and cand.strip():
                op_val = cand.strip()
                break

    if not speaker_val:
        raise ValueError(
            f"Missing provider speaker_id ('speaker.speaker_id', 'result.speaker_id', or 'speaker_id') in Eidos enroll response. Received keys: {combined_keys}"
        )

    credits_raw = None
    for source in (body, nested_result, nested_data, speaker_obj):
        if isinstance(source, dict):
            credits_obj = source.get("credits")
            if isinstance(credits_obj, dict) and credits_obj.get("charged") is not None:
                credits_raw = credits_obj.get("charged")
                break
            val = source.get("credits_used") or source.get("credits_charged") or source.get("cost_credits")
            if val is not None:
                credits_raw = val
                break
    if credits_raw is None:
        credits_raw = 200.0

    samples_raw = None
    for source in (speaker_obj, nested_result, nested_data, body):
        if isinstance(source, dict):
            val = source.get("samples") or source.get("sample_count")
            if isinstance(val, (int, float)):
                samples_raw = int(val)
                break

    return ParsedEidosEnroll(
        speaker_id=speaker_val,
        operation_id=op_val,
        credits_used=float(credits_raw),
        samples=samples_raw,
        raw_keys=combined_keys,
    )


def parse_eidos_verify_response(body: object) -> ParsedEidosVerify:
    """
    Tolerant parser for POST /v1/speakers/verify:
    Reads result.decision / result.similarity (plus data or top-level fallbacks) and operation_id.
    """
    if not isinstance(body, dict):
        raise ValueError(f"Expected JSON object from Eidos verify, got {type(body).__name__}.")

    top_keys = sorted(str(k) for k in body.keys())
    if body.get("error"):
        err = body.get("error")
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise ValueError(f"DetectifAI Eidos error: {_sanitize_error_text(str(msg))} (keys={top_keys})")

    nested_result = body.get("result") if isinstance(body.get("result"), dict) else None
    nested_data = body.get("data") if isinstance(body.get("data"), dict) else None
    payload = nested_result or nested_data or body

    combined_keys = sorted(set(top_keys) | set(str(k) for k in payload.keys()))
    decision_raw = payload.get("decision") or body.get("decision")
    similarity_raw = payload.get("similarity")
    if similarity_raw is None:
        similarity_raw = body.get("similarity")

    if decision_raw is None or similarity_raw is None:
        raise ValueError(
            f"Missing required Eidos verify fields ('decision' and 'similarity'). Received keys: {combined_keys}"
        )

    op_val = str(
        body.get("operation_id")
        or payload.get("operation_id")
        or body.get("request_id")
        or payload.get("request_id")
        or ""
    ).strip()
    credits_obj = body.get("credits") if isinstance(body.get("credits"), dict) else {}
    credits_raw = (
        credits_obj.get("charged")
        or body.get("credits_used")
        or body.get("credits_charged")
        or body.get("cost_credits")
        or payload.get("credits_used")
        or 500.0
    )
    dur_raw = payload.get("duration_seconds") or body.get("duration_seconds")
    return ParsedEidosVerify(
        decision=str(decision_raw).strip().lower(),
        similarity=float(similarity_raw),
        operation_id=op_val,
        credits_used=float(credits_raw),
        duration_seconds=float(dur_raw) if isinstance(dur_raw, (int, float)) else None,
        raw_keys=combined_keys,
    )


def parse_aletheia_verdict_and_score(
    raw_verdict: str | None,
    raw_score: float,
) -> tuple[str, float, float, str]:
    """
    Map DetectifAI Aletheia (verdict, score) into canonical:
      (verdict, synthetic_likelihood [0..1], voice_authenticity [0..100], signal_status)

    Decision MUST come strictly from `verdict` ("real", "fake", "not_sure"),
    never from blindly assuming raw_score > 0.5 means fake.
    """
    verdict = str(raw_verdict or "").strip().lower()
    if verdict not in ("real", "fake", "not_sure"):
        verdict = "fake" if raw_score >= 0.5 else "real"

    clamped = max(0.0, min(1.0, float(raw_score)))

    if verdict == "real":
        # Some endpoints/models report 0.01..0.05 (synthetic prob), while high >0.5 scores on "real"
        # represent confidence in authenticity (e.g. 0.99 = 99% real).
        if clamped > 0.5:
            authenticity = round(clamped * 100.0, 1)
            synthetic_prob = round(max(0.0, 1.0 - clamped), 4)
        else:
            synthetic_prob = round(clamped, 4)
            authenticity = round((1.0 - clamped) * 100.0, 1)
        signal_status = "PASS"
    elif verdict == "fake":
        if clamped >= 0.5:
            synthetic_prob = round(clamped, 4)
            authenticity = round((1.0 - clamped) * 100.0, 1)
        else:
            authenticity = round(clamped * 100.0, 1)
            synthetic_prob = round(1.0 - clamped, 4)
        signal_status = "FAIL"
    else:
        synthetic_prob = round(clamped, 4)
        authenticity = round((1.0 - clamped) * 100.0, 1)
        signal_status = "WARN"

    return verdict, synthetic_prob, authenticity, signal_status


@dataclass(frozen=True)
class DetectifHttpErrorInfo:
    status_code: int | None
    error_code: str
    model_status: str
    provider_message: str
    detail: str


_BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9._-]+", re.IGNORECASE)


def _sanitize_error_text(text: str) -> str:
    """Redact any API key / bearer token before returning error text to logs or UI."""
    cleaned = _BEARER_RE.sub("Bearer [REDACTED]", text or "")
    if settings.detectif_api_key:
        cleaned = cleaned.replace(settings.detectif_api_key, "[REDACTED]")
    return cleaned.strip()[:320]


def _extract_provider_message(response: httpx.Response | None) -> str:
    if response is None:
        return ""
    try:
        data = response.json()
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                msg = err.get("message") or err.get("detail") or err.get("code")
                if msg:
                    return _sanitize_error_text(str(msg))
            elif isinstance(err, str) and err.strip():
                return _sanitize_error_text(err)
            for key in ("detail", "message", "error_description"):
                val = data.get(key)
                if val:
                    return _sanitize_error_text(str(val))
    except Exception:
        pass
    try:
        txt = response.text or ""
        return _sanitize_error_text(txt)
    except Exception:
        return ""


def map_http_status_to_error(
    status_code: int,
    provider_message: str = "",
    *,
    service_label: str = "DetectifAI Eidos",
    speaker_ref: str | None = None,
) -> DetectifHttpErrorInfo:
    """Map DetectifAI HTTP status codes to clear, typed errors with safe provider detail."""
    suffix = f": {provider_message}" if provider_message else ""
    if status_code == 401:
        return DetectifHttpErrorInfo(
            status_code=401,
            error_code="unauthorized",
            model_status="AUTH_ERROR",
            provider_message=provider_message,
            detail=f"{service_label} authentication failed (HTTP 401 — invalid API key){suffix}.",
        )
    if status_code == 402:
        return DetectifHttpErrorInfo(
            status_code=402,
            error_code="insufficient_credits",
            model_status="INSUFFICIENT_CREDITS",
            provider_message=provider_message,
            detail=f"{service_label} credit balance exhausted (HTTP 402){suffix}.",
        )
    if status_code == 403:
        return DetectifHttpErrorInfo(
            status_code=403,
            error_code="forbidden_scope",
            model_status="AUTH_ERROR",
            provider_message=provider_message,
            detail=f"{service_label} permission denied (HTTP 403 — missing scope or unverified account){suffix}.",
        )
    if status_code == 404:
        spk_hint = f" '{speaker_ref}'" if speaker_ref else ""
        return DetectifHttpErrorInfo(
            status_code=404,
            error_code="speaker_not_found",
            model_status="NOT_FOUND",
            provider_message=provider_message,
            detail=f"{service_label} speaker{spk_hint} is not enrolled on DetectifAI (HTTP 404){suffix}.",
        )
    if status_code == 429:
        return DetectifHttpErrorInfo(
            status_code=429,
            error_code="rate_limited",
            model_status="RATE_LIMITED",
            provider_message=provider_message,
            detail=f"{service_label} rate limit exceeded (HTTP 429){suffix}.",
        )
    if 500 <= status_code < 600:
        return DetectifHttpErrorInfo(
            status_code=status_code,
            error_code="provider_5xx",
            model_status="PROVIDER_ERROR",
            provider_message=provider_message,
            detail=f"{service_label} upstream server error (HTTP {status_code}){suffix}.",
        )
    return DetectifHttpErrorInfo(
        status_code=status_code,
        error_code=f"http_{status_code}",
        model_status="ERROR",
        provider_message=provider_message,
        detail=f"{service_label} HTTP {status_code}{suffix}.",
    )


def extract_detectifai_error(
    exc_or_resp: httpx.HTTPStatusError | httpx.Response | Exception,
    *,
    service_label: str = "DetectifAI Eidos",
    speaker_ref: str | None = None,
) -> DetectifHttpErrorInfo:
    """Safely inspect HTTPStatusError / Response / network Exception without ever exposing API keys."""
    raw_status = getattr(exc_or_resp, "status_code", None)
    if isinstance(exc_or_resp, httpx.Response) or (
        isinstance(raw_status, int) and not isinstance(exc_or_resp, Exception)
    ):
        msg = _extract_provider_message(exc_or_resp)  # type: ignore[arg-type]
        return map_http_status_to_error(
            int(raw_status),
            msg,
            service_label=service_label,
            speaker_ref=speaker_ref,
        )
    if isinstance(exc_or_resp, httpx.HTTPStatusError):
        resp = exc_or_resp.response
        status_code = resp.status_code if resp is not None else 500
        msg = _extract_provider_message(resp)
        return map_http_status_to_error(
            status_code,
            msg,
            service_label=service_label,
            speaker_ref=speaker_ref,
        )
    if isinstance(exc_or_resp, httpx.TimeoutException):
        return DetectifHttpErrorInfo(
            status_code=None,
            error_code="timeout",
            model_status="TIMEOUT",
            provider_message="",
            detail=f"{service_label} request timed out.",
        )
    return DetectifHttpErrorInfo(
        status_code=None,
        error_code="request_failed",
        model_status="ERROR",
        provider_message="",
        detail=f"{service_label} request failed ({exc_or_resp.__class__.__name__}).",
    )
