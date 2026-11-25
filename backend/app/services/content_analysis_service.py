from __future__ import annotations

import base64
from dataclasses import dataclass
import json
import time
from uuid import uuid4
import httpx

from app.core.config import settings
from app.schemas import (
    AnalysisMode,
    FlaggedPhrase,
    ManipulationAnalysisResult,
    ScamAnalysisResult,
    TranscriptSegment,
)
from app.services.ledger_service import record_operation
from app.services.scam_analysis_service import (
    analyze_scam_transcript,
    extract_manipulation_analysis,
)


GEMINI_AUDIO_PROMPT = """You are AEGIS ASR + Scam-Risk Analyzer for banking security operations.
Transcribe the caller speech in this WAV recording verbatim. If the audio is silent, unintelligible, or has no spoken words, return an empty string "" for "transcript".
Also evaluate the transcribed speech for banking fraud & manipulation (authority impersonation, urgent payment, OTP/password request, account freeze threats, secrecy, remote access, safe-account transfers).

Return STRICT JSON ONLY:
{
  "transcript": string,
  "scam_risk_score": number (0-100),
  "behavioral_pressure_score": number (0-100),
  "detected_patterns": string[],
  "pressure_tactics": string[],
  "evidence": [
    {
      "phrase": string,
      "category": string,
      "severity": "LOW" | "MEDIUM" | "HIGH",
      "weight": integer (1-50),
      "explanation": string
    }
  ],
  "explanation": string,
  "recommended_action": string
}"""


@dataclass
class ContentAnalysisEvaluation:
    transcript: str
    asr_status: str  # OK | UNAVAILABLE
    asr_reason: str | None
    scam: ScamAnalysisResult
    manipulation: ManipulationAnalysisResult


def _unavailable_content(reason: str, provenance: str = "REAL ANALYSIS") -> ContentAnalysisEvaluation:
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
        recommended_action="Provide or enable ASR transcript before relying on script risk.",
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
        transcript="",
        asr_status="UNAVAILABLE",
        asr_reason=reason,
        scam=scam,
        manipulation=manipulation,
    )


async def analyze_call_content(
    *,
    audio_bytes: bytes | None,
    transcript_text: str,
    analysis_mode: AnalysisMode,
    bypass_cache: bool = False,
    call_id: str | None = None,
) -> ContentAnalysisEvaluation:
    """
    Transcribe audio with Gemini (if no manual transcript) and run L3 Script + L4 Manipulation.
    Never sets ASR to 'Done' or L3/L4 to 100.0 when no transcript was obtained.
    """
    manual = transcript_text.strip()
    if manual:
        scam = await analyze_scam_transcript(
            manual,
            analysis_mode=analysis_mode,
            bypass_cache=bypass_cache,
            call_id=call_id,
        )
        segments = [
            TranscriptSegment(
                id="seg-1",
                timestamp_sec=1.0,
                speaker="CALLER",
                text=manual,
                risk_level="LOW" if scam.risk_score is None else ("HIGH" if scam.risk_score >= 60 else ("MEDIUM" if scam.risk_score >= 25 else "LOW")),
                triggers=[fp.phrase for fp in scam.flagged_phrases],
            )
        ]
        manipulation = extract_manipulation_analysis(
            manual,
            transcript_segments=segments,
            provenance="REAL ANALYSIS" if analysis_mode == "REAL" else scam.provenance,
        )
        return ContentAnalysisEvaluation(
            transcript=manual,
            asr_status="OK",
            asr_reason=None,
            scam=scam,
            manipulation=manipulation,
        )

    if analysis_mode != "REAL" or not audio_bytes:
        return _unavailable_content(
            "No transcript available.",
            provenance="CACHED ANALYSIS" if analysis_mode == "CACHED" else "REAL ANALYSIS",
        )

    if not settings.gemini_configured:
        return _unavailable_content("Gemini API key not configured; audio transcription and L3/L4 analysis unavailable.")

    t0 = time.perf_counter()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": GEMINI_AUDIO_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "audio/wav",
                            "data": base64.b64encode(audio_bytes).decode("ascii"),
                        }
                    },
                ],
            }
        ],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        transcribed = str(parsed.get("transcript") or "").strip()
        if not transcribed:
            return _unavailable_content("Audio contained no recognizable speech transcript.")

        risk_score = round(float(max(0, min(100, parsed.get("scam_risk_score", 0)))), 1)
        pressure_score = round(float(max(0, min(100, parsed.get("behavioral_pressure_score", 0)))), 1)
        patterns = list(parsed.get("detected_patterns", []))
        evidence = [FlaggedPhrase(**item) for item in parsed.get("evidence", [])]
        op_id = f"op_gem_{uuid4().hex[:8]}"

        scam = ScamAnalysisResult(
            risk_score=risk_score,
            safety_score=round(100.0 - risk_score, 1),
            behavioral_pressure_score=pressure_score,
            status="PASS",
            categories=patterns,
            detected_patterns=patterns,
            pressure_tactics=list(parsed.get("pressure_tactics", [])),
            flagged_phrases=evidence,
            engine_used=f"Gemini Multimodal ({settings.gemini_model})",
            model_version=settings.gemini_model,
            latency_ms=latency_ms,
            provenance="REAL ANALYSIS",
            summary=str(parsed.get("explanation", "Gemini audio transcription and scam analysis completed.")),
            recommended_action=str(parsed.get("recommended_action", "Follow standard verification.")),
            fallback_used=False,
            fallback_reason=None,
            cache_hit=False,
            operation_id=op_id,
            cost_credits=0.0,
            raw_payload=parsed,
        )
        segments = [
            TranscriptSegment(
                id="seg-1",
                timestamp_sec=1.0,
                speaker="CALLER",
                text=transcribed,
                risk_level="HIGH" if risk_score >= 60 else ("MEDIUM" if risk_score >= 25 else "LOW"),
                triggers=[fp.phrase for fp in evidence],
            )
        ]
        manipulation = extract_manipulation_analysis(
            transcribed,
            transcript_segments=segments,
            provenance="REAL ANALYSIS",
        )
        if call_id:
            record_operation(
                operation_id=op_id,
                call_id=call_id,
                service="gemini",
                endpoint=f"/models/{settings.gemini_model}:generateContent",
                mode="FRESH",
                status="done",
                cost_credits=0.0,
                latency_ms=latency_ms,
                cached=False,
            )
        return ContentAnalysisEvaluation(
            transcript=transcribed,
            asr_status="OK",
            asr_reason=None,
            scam=scam,
            manipulation=manipulation,
        )
    except Exception as exc:
        return _unavailable_content(f"Gemini audio transcription unavailable ({exc.__class__.__name__}).")
