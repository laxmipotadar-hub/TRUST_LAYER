from __future__ import annotations

from dataclasses import dataclass, field
import io
import time
from uuid import uuid4
import wave
import httpx

from app.core.config import settings
from app.detectif.client import (
    DetectifHttpErrorInfo,
    extract_detectifai_error,
    parse_aletheia_verdict_and_score,
)
from app.schemas import SegmentRiskChunk, VoiceAuthenticityResult
from app.services.cache_service import cache_service
from app.services.ledger_service import record_operation


MIN_DURATION_SEC = 4.0
MAX_DURATION_SEC = 120.0
SLIDING_CHUNK_SEC = 5.0
MAX_FILE_BYTES = 100 * 1024 * 1024


@dataclass
class AletheiaEvaluation:
    result: VoiceAuthenticityResult
    model_status: str  # OK | CACHED | UNAVAILABLE | AUTH_ERROR | RATE_LIMITED | TIMEOUT | INVALID_AUDIO | INVALID_RESPONSE | ERROR
    segments: list[SegmentRiskChunk] = field(default_factory=list)


def inspect_wav_duration_seconds(audio_bytes: bytes) -> float | None:
    """Return WAV duration in seconds if valid RIFF/WAVE header, else None."""
    if len(audio_bytes) < 12 or audio_bytes[:4] != b"RIFF":
        return None
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate <= 0:
                return None
            return frames / float(rate)
    except Exception:
        return None


def split_wav_into_sliding_chunks(
    audio_bytes: bytes,
    chunk_sec: float = SLIDING_CHUNK_SEC,
    min_sec: float = MIN_DURATION_SEC,
) -> list[bytes]:
    """Split WAV audio into >=4s (default 5s) chunks for Aletheia deepfake detection."""
    if audio_bytes[:4] != b"RIFF":
        return [audio_bytes]
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            params = wf.getparams()
            rate = params.framerate
            total_frames = params.nframes
            if rate <= 0 or total_frames <= 0:
                return [audio_bytes]
            total_sec = total_frames / float(rate)
            if total_sec <= MAX_DURATION_SEC and total_sec < chunk_sec * 2:
                return [audio_bytes]

            chunk_frames = int(chunk_sec * rate)
            min_frames = int(min_sec * rate)
            chunks: list[bytes] = []

            offset = 0
            while offset < total_frames:
                end = min(offset + chunk_frames, total_frames)
                if end - offset < min_frames:
                    if not chunks:
                        return [audio_bytes]
                    break
                wf.setpos(offset)
                raw = wf.readframes(end - offset)
                buf = io.BytesIO()
                with wave.open(buf, "wb") as out_wf:
                    out_wf.setparams(params)
                    out_wf.writeframes(raw)
                chunks.append(buf.getvalue())
                offset += chunk_frames
            return chunks or [audio_bytes]
    except Exception:
        return [audio_bytes]


async def _submit_single_chunk(
    audio_bytes: bytes,
    filename: str,
) -> tuple[dict | None, str, str, float, DetectifHttpErrorInfo | None]:
    """Submit a single 4-120s audio clip to POST /v1/deepfake/detect."""
    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/deepfake/detect"
    headers = {
        "Authorization": f"Bearer {settings.detectif_api_key}",
        "Idempotency-Key": str(uuid4()),
    }
    files = {"file": (filename, audio_bytes, "audio/wav")}
    t0 = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, files=files)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            if resp.status_code >= 400:
                err = extract_detectifai_error(resp, service_label="DetectifAI Aletheia")
                return None, err.model_status, err.detail, latency_ms, err
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        err = extract_detectifai_error(exc, service_label="DetectifAI Aletheia")
        return None, err.model_status, err.detail, latency_ms, err
    except httpx.TimeoutException as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        err = extract_detectifai_error(exc, service_label="DetectifAI Aletheia")
        return None, err.model_status, err.detail, latency_ms, err
    except Exception as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        err = extract_detectifai_error(exc, service_label="DetectifAI Aletheia")
        return None, err.model_status, err.detail, latency_ms, err

    result = data.get("result") if isinstance(data, dict) else None
    if not isinstance(result, dict) or "score" not in result or "verdict" not in result:
        return None, "INVALID_RESPONSE", "DetectifAI Aletheia returned unexpected response structure.", latency_ms, None

    return data, "OK", "Live DetectifAI Aletheia deepfake detection completed.", latency_ms, None


async def detect_deepfake_aletheia(
    audio_bytes: bytes,
    filename: str = "call_audio.wav",
    duration_hint_sec: float | None = None,
    use_sliding_chunks: bool = False,
    bypass_cache: bool = False,
    call_id: str | None = None,
) -> AletheiaEvaluation:
    """Validate audio, check cache, and invoke DetectifAI Aletheia POST /v1/deepfake/detect."""
    if not audio_bytes:
        return AletheiaEvaluation(
            result=VoiceAuthenticityResult(
                score=None,
                deepfake_probability=None,
                status="UNAVAILABLE",
                artifacts_detected=["Empty audio payload"],
                provenance="REAL ANALYSIS",
                detail="Audio payload is empty; cannot evaluate deepfake probability.",
            ),
            model_status="INVALID_AUDIO",
        )

    if len(audio_bytes) > MAX_FILE_BYTES:
        return AletheiaEvaluation(
            result=VoiceAuthenticityResult(
                score=None,
                deepfake_probability=None,
                status="UNAVAILABLE",
                artifacts_detected=["Audio exceeds 100 MB limit"],
                provenance="REAL ANALYSIS",
                detail="Audio file exceeds DetectifAI Aletheia 100 MB upload limit.",
            ),
            model_status="INVALID_AUDIO",
        )

    detected_duration = inspect_wav_duration_seconds(audio_bytes)
    effective_duration = detected_duration if detected_duration is not None else duration_hint_sec

    if effective_duration is not None:
        if effective_duration < MIN_DURATION_SEC:
            return AletheiaEvaluation(
                result=VoiceAuthenticityResult(
                    score=None,
                    deepfake_probability=None,
                    status="UNAVAILABLE",
                    artifacts_detected=[f"Duration {effective_duration:.2f}s < 4.0s minimum"],
                    provenance="REAL ANALYSIS",
                    detail=(
                        f"Audio duration ({effective_duration:.2f}s) is below DetectifAI Aletheia's "
                        f"minimum 4.0s requirement."
                    ),
                ),
                model_status="INVALID_AUDIO",
            )
        if effective_duration > MAX_DURATION_SEC and not use_sliding_chunks:
            use_sliding_chunks = True

    if not settings.detectifai_configured:
        return AletheiaEvaluation(
            result=VoiceAuthenticityResult(
                score=None,
                deepfake_probability=None,
                status="UNAVAILABLE",
                artifacts_detected=["DETECTIF_API_KEY missing"],
                provenance="REAL ANALYSIS",
                detail="DETECTIF_API_KEY is not configured on backend server.",
            ),
            model_status="UNAVAILABLE",
        )

    cache_key = cache_service.compute_request_hash(
        provider="aletheia",
        params={"use_sliding_chunks": use_sliding_chunks},
        audio_bytes=audio_bytes,
    )
    if not bypass_cache:
        cached = cache_service.get(cache_key)
        if cached and isinstance(cached.get("payload"), dict):
            p = cached["payload"]
            res_obj = VoiceAuthenticityResult(**{**p, "cache_hit": True, "cost_credits": 0.0})
            if call_id:
                record_operation(
                    operation_id=res_obj.operation_id or res_obj.request_id or f"cache_{uuid4().hex[:8]}",
                    call_id=call_id,
                    service="aletheia",
                    endpoint="/v1/deepfake/detect",
                    mode="CACHED",
                    status="done",
                    cost_credits=0.0,
                    latency_ms=0.0,
                    cached=True,
                )
            return AletheiaEvaluation(result=res_obj, model_status="CACHED")

    chunks = split_wav_into_sliding_chunks(audio_bytes) if use_sliding_chunks else [audio_bytes]
    chunk_scores: list[float] = []
    chunk_artifacts: list[str] = []
    segment_chunks: list[SegmentRiskChunk] = []
    last_request_id: str | None = None
    last_operation_id: str | None = None
    total_credits = 0.0
    total_latency_ms = 0.0
    raw_responses: list[dict] = []
    chunk_verdicts: list[str] = []

    for idx, chunk in enumerate(chunks):
        chunk_name = filename if len(chunks) == 1 else f"chunk_{idx}_{filename}"
        data, status_code, message, chunk_latency, err_info = await _submit_single_chunk(chunk, chunk_name)
        total_latency_ms += chunk_latency
        if data is None:
            return AletheiaEvaluation(
                result=VoiceAuthenticityResult(
                    score=None,
                    deepfake_probability=None,
                    verdict=None,
                    status="UNAVAILABLE",
                    artifacts_detected=[message],
                    provenance="REAL ANALYSIS",
                    detail=message,
                    latency_ms=round(total_latency_ms, 2),
                    error_code=err_info.error_code if err_info else status_code.lower(),
                    http_status=err_info.status_code if err_info else None,
                ),
                model_status=status_code,
            )

        raw_responses.append(data)
        res = data["result"]
        last_request_id = data.get("request_id")
        last_operation_id = data.get("operation_id") or last_request_id
        total_credits += float(data.get("credits_used") or data.get("cost_credits") or 24.0)
        chunk_score = float(max(0.0, min(1.0, float(res["score"]))))
        verdict, chunk_syn_prob, chunk_auth, _ = parse_aletheia_verdict_and_score(
            res.get("verdict"), chunk_score
        )
        chunk_scores.append(chunk_syn_prob)
        chunk_verdicts.append(verdict)
        if verdict == "fake":
            chunk_artifacts.append(f"Chunk {idx + 1}: verdict=fake (synthetic {chunk_syn_prob:.2f})")
        for seg_idx, seg in enumerate(res.get("segments", []) or []):
            seg_raw_score = float(seg.get("score", 0.0))
            seg_verdict, seg_syn_prob, seg_auth, _ = parse_aletheia_verdict_and_score(
                seg.get("verdict", verdict), seg_raw_score
            )
            if seg_verdict == "fake":
                chunk_artifacts.append(
                    f"Segment {seg.get('start', 0):.1f}s-{seg.get('end', 0):.1f}s flagged synthetic ({seg_syn_prob:.2f})"
                )
            segment_chunks.append(
                SegmentRiskChunk(
                    chunk_index=len(segment_chunks) + 1,
                    start_sec=float(seg.get("start", seg_idx * 5.0)),
                    end_sec=float(seg.get("end", (seg_idx + 1) * 5.0)),
                    label=f"Aletheia segment verdict: {seg_verdict}",
                    risk_level=(
                        "HIGH"
                        if seg_verdict == "fake"
                        else ("MEDIUM" if seg_verdict == "not_sure" or seg_syn_prob >= 0.35 else "LOW")
                    ),
                    score=seg_auth,
                    provenance="REAL ANALYSIS",
                )
            )

    overall_verdict = (
        "fake"
        if "fake" in chunk_verdicts
        else ("not_sure" if "not_sure" in chunk_verdicts else "real")
    )
    if overall_verdict == "real":
        max_fake_prob = round(max(chunk_scores), 3)
        authenticity_score = round((1.0 - max_fake_prob) * 100.0, 1)
        signal_status = "PASS"
    elif overall_verdict == "fake":
        max_fake_prob = round(max(chunk_scores), 3)
        authenticity_score = round((1.0 - max_fake_prob) * 100.0, 1)
        signal_status = "FAIL"
    else:
        max_fake_prob = round(max(chunk_scores), 3)
        authenticity_score = round((1.0 - max_fake_prob) * 100.0, 1)
        signal_status = "WARN"

    normalized = VoiceAuthenticityResult(
        score=authenticity_score,
        deepfake_probability=max_fake_prob,
        verdict=overall_verdict,
        status=signal_status,
        artifacts_detected=chunk_artifacts,
        provenance="REAL ANALYSIS",
        detail=(
            f"DetectifAI Aletheia verdict='{overall_verdict}' across {len(chunks)} clip(s): "
            f"authenticity {authenticity_score:.1f}/100, synthetic likelihood {max_fake_prob:.3f}."
        ),
        cache_hit=False,
        request_id=last_request_id,
        operation_id=last_operation_id,
        cost_credits=round(total_credits, 2),
        latency_ms=round(total_latency_ms, 2),
        raw_payload=raw_responses[-1] if len(raw_responses) == 1 else {"chunks": raw_responses},
    )
    cache_service.set(cache_key, "aletheia", normalized.model_dump())
    if call_id:
        record_operation(
            operation_id=last_operation_id or f"op_ale_{uuid4().hex[:8]}",
            call_id=call_id,
            service="aletheia",
            endpoint="/v1/deepfake/detect",
            mode="FRESH",
            status="done",
            cost_credits=normalized.cost_credits,
            latency_ms=normalized.latency_ms or 0.0,
            cached=False,
        )

    return AletheiaEvaluation(result=normalized, model_status="OK", segments=segment_chunks)
