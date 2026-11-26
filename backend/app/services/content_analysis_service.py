from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import re
import time
from typing import Literal
from uuid import uuid4
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings
from app.schemas import (
    AnalysisMode,
    FlaggedPhrase,
    ManipulationAnalysisResult,
    ManipulationCategory,
    ManipulationMarker,
    RiskLevel,
    ScamAnalysisResult,
    TranscriptSegment,
)
from app.services.cache_service import cache_service
from app.services.ledger_service import record_operation


logger = logging.getLogger("aegis.groq")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
_PREFERRED_LLM_FALLBACKS = (
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.1-8b-instant",
)
_MODEL_RESOLUTION_CACHE: dict[str, str] = {}

AllowedTacticType = Literal[
    "urgency",
    "secrecy",
    "authority",
    "payment_pressure",
    "credential_request",
    "fear/threat",
]

_TACTIC_TO_MANIP_CATEGORY: dict[str, ManipulationCategory] = {
    "urgency": "urgency",
    "secrecy": "secrecy",
    "authority": "authority",
    "payment_pressure": "urgency",
    "credential_request": "secrecy",
    "fear/threat": "threat",
}

_TACTIC_LABELS: dict[str, str] = {
    "urgency": "Urgency escalation",
    "secrecy": "Secrecy / isolation demand",
    "authority": "Authority impersonation",
    "payment_pressure": "Payment / transfer pressure",
    "credential_request": "Credential / OTP solicitation",
    "fear/threat": "Fear / account-threat coercion",
}


class GroqTacticItem(BaseModel):
    type: AllowedTacticType
    evidence: str = Field(..., min_length=2, max_length=240)


class GroqLlmAnalysisPayload(BaseModel):
    scam_script_risk: float = Field(..., ge=0, le=100)
    manipulation_risk: float = Field(..., ge=0, le=100)
    tactics: list[GroqTacticItem] = Field(default_factory=list)
    summary: str = Field(..., min_length=3, max_length=400)


GROQ_SYSTEM_PROMPT = """Return JSON only.
You are AEGIS Content & Social-Engineering Risk Analyzer for banking calls.
Inspect the caller transcript and return STRICT JSON matching:
{
  "scam_script_risk": number (0 to 100),
  "manipulation_risk": number (0 to 100),
  "tactics": [
    {
      "type": "urgency" | "secrecy" | "authority" | "payment_pressure" | "credential_request" | "fear/threat",
      "evidence": string (MUST be an EXACT verbatim substring copied directly from the transcript)
    }
  ],
  "summary": string (one concise sentence)
}
Rules:
- Every "evidence" quote MUST appear verbatim inside the input transcript.
- If the call is benign customer service with no coercion, return low scores (0-15) and tactics: []."""


@dataclass
class GroqTranscribeResult:
    text: str
    language: str
    segments: list[dict]
    latency_ms: float
    error: str | None = None


@dataclass
class ContentAnalysisEvaluation:
    transcript: str
    asr_status: str  # OK | CACHED | UNAVAILABLE
    asr_reason: str | None
    scam: ScamAnalysisResult
    manipulation: ManipulationAnalysisResult


def _normalize_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def _evidence_in_transcript(evidence: str, transcript: str) -> bool:
    ev = _normalize_ws(evidence)
    tr = _normalize_ws(transcript)
    return bool(ev) and len(ev) >= 3 and ev in tr


def _guess_upload_meta(audio_bytes: bytes, filename: str) -> tuple[str, str]:
    lower = (filename or "clip.wav").lower()
    if audio_bytes[:4] == b"RIFF":
        return (filename if lower.endswith(".wav") else "clip.wav"), "audio/wav"
    if audio_bytes[:4] == b"\x1a\x45\xdf\xa3" or lower.endswith(".webm"):
        return (filename if lower.endswith(".webm") else "clip.webm"), "audio/webm"
    if lower.endswith(".mp3"):
        return filename, "audio/mpeg"
    if lower.endswith(".ogg"):
        return filename, "audio/ogg"
    return (filename or "clip.wav"), "application/octet-stream"


async def resolve_groq_llm_model(client: httpx.AsyncClient) -> str:
    """Verify configured GROQ_LLM_MODEL against GET /openai/v1/models and fall back cleanly if absent."""
    configured = settings.groq_llm_model.strip() or "llama-3.3-70b-versatile"
    cached_choice = _MODEL_RESOLUTION_CACHE.get(configured)
    if cached_choice:
        return cached_choice

    try:
        resp = await client.get(
            f"{GROQ_BASE_URL}/models",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            timeout=10.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            ids = {
                str(m.get("id"))
                for m in (data.get("data") or [])
                if isinstance(m, dict) and m.get("id")
            }
            if configured in ids:
                _MODEL_RESOLUTION_CACHE[configured] = configured
                return configured
            for candidate in _PREFERRED_LLM_FALLBACKS:
                if candidate in ids:
                    _MODEL_RESOLUTION_CACHE[configured] = candidate
                    return candidate
            chat_candidates = sorted(
                mid for mid in ids if "whisper" not in mid and "orpheus" not in mid and "prompt-guard" not in mid
            )
            if chat_candidates:
                _MODEL_RESOLUTION_CACHE[configured] = chat_candidates[0]
                return chat_candidates[0]
    except Exception:
        pass
    return configured


def _unavailable_content(
    reason: str,
    provenance: str = "REAL ANALYSIS",
    *,
    transcript: str = "",
    asr_status: str = "UNAVAILABLE",
) -> ContentAnalysisEvaluation:
    scam = ScamAnalysisResult(
        risk_score=None,
        safety_score=None,
        behavioral_pressure_score=None,
        status="UNAVAILABLE",
        categories=[],
        detected_patterns=[],
        pressure_tactics=[],
        flagged_phrases=[],
        engine_used="Unavailable",
        model_version="unavailable",
        latency_ms=0.0,
        provenance=provenance,  # type: ignore[arg-type]
        summary=reason,
        recommended_action="Capture spoken transcript or verify Groq configuration before relying on script risk.",
        fallback_used=False,
        fallback_reason=reason,
        cache_hit=False,
    )
    manipulation = ManipulationAnalysisResult(
        score=None,
        safety_score=None,
        status="UNAVAILABLE",
        model_version="unavailable",
        latency_ms=0.0,
        category_counts={"urgency": 0, "secrecy": 0, "authority": 0, "threat": 0},
        markers=[],
        sparkline=[],
        provenance=provenance,  # type: ignore[arg-type]
        raw_payload={"status": "UNAVAILABLE", "reason": reason},
    )
    return ContentAnalysisEvaluation(
        transcript=transcript,
        asr_status=asr_status,
        asr_reason=reason,
        scam=scam,
        manipulation=manipulation,
    )


async def transcribe(
    audio_bytes: bytes,
    filename: str = "clip.wav",
    content_type: str | None = None,
    *,
    call_id: str | None = None,
) -> GroqTranscribeResult:
    """Transcribe audio via Groq Whisper (`whisper-large-v3-turbo`)."""
    if not audio_bytes:
        return GroqTranscribeResult(text="", language="", segments=[], latency_ms=0.0, error="Audio payload is empty.")
    if not settings.groq_configured:
        return GroqTranscribeResult(text="", language="", segments=[], latency_ms=0.0, error="GROQ_API_KEY not configured on server.")

    upload_name, guessed_type = _guess_upload_meta(audio_bytes, filename)
    mime = content_type or guessed_type
    t0 = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                f"{GROQ_BASE_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (upload_name, audio_bytes, mime)},
                data={
                    "model": settings.groq_stt_model,
                    "response_format": "verbose_json",
                    "temperature": "0",
                },
            )
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            if resp.status_code >= 400:
                return GroqTranscribeResult(
                    text="",
                    language="",
                    segments=[],
                    latency_ms=latency_ms,
                    error=f"Groq Whisper returned HTTP {resp.status_code}.",
                )
            data = resp.json()
            text = str(data.get("text") or "").strip()
            language = str(data.get("language") or "en").strip()
            segments = list(data.get("segments") or [])
            if call_id:
                record_operation(
                    operation_id=f"op_groq_stt_{uuid4().hex[:8]}",
                    call_id=call_id,
                    service="groq",
                    endpoint="/audio/transcriptions",
                    mode="FRESH",
                    status="done",
                    cost_credits=0.0,
                    latency_ms=latency_ms,
                    cached=False,
                )
            return GroqTranscribeResult(
                text=text,
                language=language,
                segments=segments,
                latency_ms=latency_ms,
            )
    except Exception as exc:
        return GroqTranscribeResult(
            text="",
            language="",
            segments=[],
            latency_ms=round((time.perf_counter() - t0) * 1000.0, 2),
            error=f"Groq Whisper request failed ({exc.__class__.__name__}).",
        )


async def analyse_text(
    transcript: str,
    *,
    analysis_mode: AnalysisMode = "REAL",
    bypass_cache: bool = False,
    call_id: str | None = None,
) -> tuple[ScamAnalysisResult, ManipulationAnalysisResult]:
    """Analyze transcript via Groq Chat Completions JSON mode; drop unverified quotes & score 25*distinct_tactics."""
    cleaned = transcript.strip()
    if not cleaned:
        unavailable = _unavailable_content("No speech detected")
        return unavailable.scam, unavailable.manipulation

    if not settings.groq_configured:
        unavailable = _unavailable_content("GROQ_API_KEY not configured on server.", transcript=cleaned, asr_status="OK")
        return unavailable.scam, unavailable.manipulation

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            model_id = await resolve_groq_llm_model(client)
            resp = await client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": model_id,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                        {"role": "user", "content": f"TRANSCRIPT:\n{cleaned}"},
                    ],
                },
            )
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            if resp.status_code >= 400:
                unavailable = _unavailable_content(
                    f"Groq LLM returned HTTP {resp.status_code}.",
                    transcript=cleaned,
                    asr_status="OK",
                )
                return unavailable.scam, unavailable.manipulation

            raw_json = resp.json()
            content_str = raw_json["choices"][0]["message"]["content"]
            parsed_model = GroqLlmAnalysisPayload(**json.loads(content_str))
    except Exception as exc:
        unavailable = _unavailable_content(
            f"Groq LLM analysis failed ({exc.__class__.__name__}).",
            transcript=cleaned,
            asr_status="OK",
        )
        return unavailable.scam, unavailable.manipulation

    # Enforce strict grounding: drop any tactic whose evidence is not verbatim in transcript
    verified_tactics = [
        t for t in parsed_model.tactics if _evidence_in_transcript(t.evidence, cleaned)
    ]
    distinct_types = {t.type for t in verified_tactics}
    behavioral_score = round(min(100.0, float(len(distinct_types) * 25)), 1)
    # Use verified manipulation score cleanly
    scam_risk = round(float(max(0.0, min(100.0, parsed_model.scam_script_risk))), 1)
    scam_safety = round(100.0 - scam_risk, 1)
    beh_safety = round(100.0 - behavioral_score, 1)

    flagged_phrases: list[FlaggedPhrase] = []
    markers: list[ManipulationMarker] = []
    counts: dict[str, int] = {"urgency": 0, "secrecy": 0, "authority": 0, "threat": 0}
    sparkline: list[float] = []
    running_pressure = 0.0

    for idx, t in enumerate(verified_tactics):
        label = _TACTIC_LABELS.get(t.type, t.type)
        sev: RiskLevel = "HIGH" if t.type in ("credential_request", "payment_pressure", "fear/threat") else "MEDIUM"
        flagged_phrases.append(
            FlaggedPhrase(
                phrase=t.evidence,
                category=label,
                severity=sev,
                weight=25,
                explanation=f"Groq LLM grounded quote for {t.type}.",
            )
        )
        m_cat = _TACTIC_TO_MANIP_CATEGORY.get(t.type, "threat")
        counts[m_cat] = counts.get(m_cat, 0) + 1
        running_pressure = min(100.0, float(len({vt.type for vt in verified_tactics[: idx + 1]}) * 25))
        sparkline.append(running_pressure)
        markers.append(
            ManipulationMarker(
                category=m_cat,
                phrase=t.evidence,
                excerpt=t.evidence,
                timestamp_sec=float(idx + 1),
                weight=25,
                severity=sev,
            )
        )

    categories = [_TACTIC_LABELS.get(dt, dt) for dt in sorted(distinct_types)]
    op_id = f"op_groq_llm_{uuid4().hex[:8]}"
    prov = "CACHED ANALYSIS" if analysis_mode == "CACHED" else "REAL ANALYSIS"

    scam = ScamAnalysisResult(
        risk_score=scam_risk,
        safety_score=scam_safety,
        behavioral_pressure_score=behavioral_score,
        status="PASS" if scam_risk < 40 else ("WARN" if scam_risk < 70 else "FAIL"),
        categories=categories,
        detected_patterns=categories,
        pressure_tactics=sorted(distinct_types),
        flagged_phrases=flagged_phrases,
        engine_used="Groq Whisper + LLM",
        model_version=model_id,
        latency_ms=latency_ms,
        provenance=prov,
        summary=parsed_model.summary,
        recommended_action=(
            "Require out-of-band verification."
            if scam_risk >= 45 or behavioral_score >= 50
            else "No elevated social-engineering risk detected."
        ),
        fallback_used=False,
        fallback_reason=None,
        cache_hit=False,
        operation_id=op_id,
        cost_credits=0.0,
        raw_payload={
            "model": model_id,
            "scam_script_risk": scam_risk,
            "manipulation_risk_raw": parsed_model.manipulation_risk,
            "behavioural_score_computed": behavioral_score,
            "tactics_verified": [t.model_dump() for t in verified_tactics],
            "tactics_dropped": len(parsed_model.tactics) - len(verified_tactics),
            "summary": parsed_model.summary,
        },
    )

    manipulation = ManipulationAnalysisResult(
        score=behavioral_score,
        safety_score=beh_safety,
        status="PASS" if behavioral_score < 40 else ("WARN" if behavioral_score < 70 else "FAIL"),
        model_version=model_id,
        latency_ms=latency_ms,
        category_counts=counts,
        markers=markers,
        sparkline=sparkline or [behavioral_score],
        provenance=prov,
        raw_payload={
            "model": model_id,
            "score": behavioral_score,
            "category_counts": counts,
            "markers": [m.model_dump() for m in markers],
        },
    )

    if call_id:
        record_operation(
            operation_id=op_id,
            call_id=call_id,
            service="groq",
            endpoint="/chat/completions",
            mode="FRESH",
            status="done",
            cost_credits=0.0,
            latency_ms=latency_ms,
            cached=False,
        )

    return scam, manipulation


def _store_content_cache(
    cache_key: str,
    evaluation: ContentAnalysisEvaluation,
) -> None:
    cache_service.set(
        cache_key,
        "groq_content",
        {
            "transcript": evaluation.transcript,
            "asr_status": evaluation.asr_status,
            "asr_reason": evaluation.asr_reason,
            "scam": evaluation.scam.model_dump(),
            "manipulation": evaluation.manipulation.model_dump(),
        },
    )


def load_cached_content_evaluation(
    *,
    audio_bytes: bytes | None,
    transcript_text: str,
    call_id: str | None = None,
) -> ContentAnalysisEvaluation | None:
    """Return SHA-256 cached Groq content evaluation (0 provider calls / 0 credits)."""
    if not audio_bytes and not transcript_text.strip():
        return None
    cache_key = cache_service.compute_request_hash(
        provider="groq_content",
        params={"stt": settings.groq_stt_model, "llm": settings.groq_llm_model},
        audio_bytes=audio_bytes,
        text=transcript_text.strip(),
    )
    cached = cache_service.get(cache_key)
    if not cached or not isinstance(cached.get("payload"), dict):
        return None
    p = cached["payload"]
    scam_data = {**p["scam"], "provenance": "CACHED ANALYSIS", "cache_hit": True, "cost_credits": 0.0}
    manip_data = {**p["manipulation"], "provenance": "CACHED ANALYSIS"}
    if call_id and scam_data.get("status") != "UNAVAILABLE":
        record_operation(
            operation_id=scam_data.get("operation_id") or f"cache_groq_{uuid4().hex[:8]}",
            call_id=call_id,
            service="groq",
            endpoint="/chat/completions",
            mode="CACHED",
            status="done",
            cost_credits=0.0,
            latency_ms=0.0,
            cached=True,
        )
    return ContentAnalysisEvaluation(
        transcript=str(p.get("transcript") or ""),
        asr_status="CACHED" if p.get("asr_status") == "OK" else str(p.get("asr_status") or "UNAVAILABLE"),
        asr_reason=p.get("asr_reason"),
        scam=ScamAnalysisResult(**scam_data),
        manipulation=ManipulationAnalysisResult(**manip_data),
    )


async def finalize_content_after_transcribe(
    *,
    audio_bytes: bytes | None,
    transcript_text: str,
    stt_result: GroqTranscribeResult | None,
    analysis_mode: AnalysisMode,
    bypass_cache: bool,
    call_id: str | None = None,
) -> ContentAnalysisEvaluation:
    """Complete Groq LLM evaluation after parallel STT and persist SHA-256 cache."""
    cache_key = cache_service.compute_request_hash(
        provider="groq_content",
        params={"stt": settings.groq_stt_model, "llm": settings.groq_llm_model},
        audio_bytes=audio_bytes,
        text=transcript_text.strip(),
    )

    # Check SHA-256 cache for Groq so repeat runs never re-call Groq unless transcript changed
    if analysis_mode == "CACHED" or (not bypass_cache and audio_bytes):
        cached = load_cached_content_evaluation(
            audio_bytes=audio_bytes,
            transcript_text=transcript_text,
            call_id=call_id,
        )
        if cached is not None:
            return cached

    manual = transcript_text.strip()
    if manual:
        scam, manip = await analyse_text(manual, analysis_mode=analysis_mode, call_id=call_id)
        ev = ContentAnalysisEvaluation(
            transcript=manual,
            asr_status="OK",
            asr_reason=None,
            scam=scam,
            manipulation=manip,
        )
        _store_content_cache(cache_key, ev)
        return ev

    if stt_result is None:
        return _unavailable_content("No audio recording supplied for transcription.")
    if stt_result.error:
        return _unavailable_content(stt_result.error)
    if not stt_result.text.strip():
        return _unavailable_content("No speech detected")

    scam, manip = await analyse_text(stt_result.text, analysis_mode=analysis_mode, call_id=call_id)
    ev = ContentAnalysisEvaluation(
        transcript=stt_result.text,
        asr_status="OK",
        asr_reason=None,
        scam=scam,
        manipulation=manip,
    )
    if scam.status != "UNAVAILABLE":
        _store_content_cache(cache_key, ev)
    return ev


async def analyze_call_content(
    *,
    audio_bytes: bytes | None,
    transcript_text: str,
    analysis_mode: AnalysisMode,
    bypass_cache: bool = False,
    call_id: str | None = None,
) -> ContentAnalysisEvaluation:
    """Convenience wrapper executing transcribe -> analyse_text -> SHA-256 cache."""
    cached = load_cached_content_evaluation(
        audio_bytes=audio_bytes,
        transcript_text=transcript_text,
        call_id=call_id,
    )
    if cached is not None:
        return cached
    stt = (
        await transcribe(audio_bytes, call_id=call_id)
        if (audio_bytes and not transcript_text.strip() and analysis_mode == "REAL")
        else None
    )
    return await finalize_content_after_transcribe(
        audio_bytes=audio_bytes,
        transcript_text=transcript_text,
        stt_result=stt,
        analysis_mode=analysis_mode,
        bypass_cache=bypass_cache,
        call_id=call_id,
    )
