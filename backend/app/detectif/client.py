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
    safe_headers = {
        k: v
        for k, v in response.headers.items()
        if k.lower() not in ("authorization", "x-api-key", "set-cookie", "cookie")
    }
    body_preview = _sanitize_error_text(response.text[:1024] if response.text else "")
    logger.info(
        "DetectifAI RAW response [%s] status=%s headers=%s body=%s",
        endpoint,
        response.status_code,
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


def parse_eidos_enroll_response(body: object, *, fallback_speaker_id: str = "") -> ParsedEidosEnroll:
    """
    Tolerant parser for POST /v1/speakers/enroll:
    - Reads payload from body.get("result") or body.get("data") or body
    - Accepts speaker_id or id
    - Reads operation_id or request_id from body or payload
    - Detects error bodies even when returned with HTTP 200
    - Raises ValueError listing received keys if required fields are missing
    """
    if not isinstance(body, dict):
        raise ValueError(f"Expected JSON object from Eidos enroll, got {type(body).__name__}.")

    top_keys = sorted(str(k) for k in body.keys())

    # Catch error body returned on HTTP 200
    if body.get("error"):
        err = body.get("error")
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise ValueError(f"DetectifAI returned error payload on HTTP 200: {_sanitize_error_text(str(msg))} (keys={top_keys})")
    if str(body.get("status", "")).lower() in ("failed", "rejected", "error"):
        raise ValueError(f"DetectifAI enrollment status='{body.get('status')}' (keys={top_keys})")

    payload = body.get("result")
    if not isinstance(payload, dict):
        payload = body.get("data")
    if not isinstance(payload, dict):
        payload = body

    payload_keys = sorted(str(k) for k in payload.keys()) if isinstance(payload, dict) else []
    combined_keys = sorted(set(top_keys + payload_keys))

    speaker_val = (
        payload.get("speaker_id")
        or payload.get("id")
        or body.get("speaker_id")
        or body.get("id")
    )
    op_val = (
        body.get("operation_id")
        or payload.get("operation_id")
        or body.get("request_id")
        or payload.get("request_id")
    )

    if not speaker_val and op_val and fallback_speaker_id:
        # Provider returned an operation acknowledgement with operation_id only
        speaker_val = fallback_speaker_id

    if not speaker_val:
        raise ValueError(
            f"Missing required speaker identifier ('speaker_id' or 'id') in Eidos enroll response. Received keys: {combined_keys}"
        )

    credits_raw = (
        body.get("credits_used")
        or body.get("credits_charged")
        or body.get("cost_credits")
        or payload.get("credits_used")
        or payload.get("credits_charged")
        or payload.get("cost_credits")
        or 200.0
    )
    samples_raw = payload.get("samples") or body.get("samples")
    return ParsedEidosEnroll(
        speaker_id=str(speaker_val),
        operation_id=str(op_val or ""),
        credits_used=float(credits_raw),
        samples=int(samples_raw) if isinstance(samples_raw, (int, float)) else None,
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
