from __future__ import annotations

from dataclasses import dataclass
import re
import time
from uuid import uuid4

from app.schemas import (
    AnalysisMode,
    AnalysisProvenance,
    FlaggedPhrase,
    ManipulationAnalysisResult,
    ManipulationCategory,
    ManipulationMarker,
    RiskLevel,
    ScamAnalysisResult,
    TranscriptSegment,
)


@dataclass(frozen=True)
class ScamPatternRule:
    pattern: str
    category: str
    severity: RiskLevel
    weight: int
    pressure_weight: int
    pressure_tactic: str
    explanation: str


THREAT_RULES: list[ScamPatternRule] = [
    ScamPatternRule(
        pattern=r"\b(fraud department|central bank|regulatory compliance|senior security officer|bank security|federal investigator)\b",
        category="Authority impersonation",
        severity="MEDIUM",
        weight=16,
        pressure_weight=16,
        pressure_tactic="Unverified institutional authority",
        explanation="Caller claims banking or government authority without standard callback verification.",
    ),
    ScamPatternRule(
        pattern=r"\b(urgent payment|pay immediately|wire transfer now|immediately|right now|within \d+ minutes|expires in)\b",
        category="Urgent payment requests",
        severity="HIGH",
        weight=22,
        pressure_weight=26,
        pressure_tactic="Time-scarcity escalation",
        explanation="Creates artificial time pressure to force immediate payment or transfer action.",
    ),
    ScamPatternRule(
        pattern=r"\b(otp|one[- ]time password|verification code|security code|6[- ]digit code)\b",
        category="OTP requests",
        severity="HIGH",
        weight=32,
        pressure_weight=15,
        pressure_tactic="Direct credential extraction",
        explanation="Solicits one-time authentication codes that bank staff must never request.",
    ),
    ScamPatternRule(
        pattern=r"\b(account (will be )?(frozen|suspended|locked|closed|seized)|compromised account)\b",
        category="Bank-account threats",
        severity="HIGH",
        weight=24,
        pressure_weight=24,
        pressure_tactic="Account loss intimidation",
        explanation="Threatens immediate account freeze or seizure to force compliance.",
    ),
    ScamPatternRule(
        pattern=r"\b(password|passcode|pin number|cvv|login credentials|secret pin)\b",
        category="Password disclosure",
        severity="HIGH",
        weight=34,
        pressure_weight=16,
        pressure_tactic="Secret credential solicitation",
        explanation="Attempts to extract private passwords, PINs, or card security codes.",
    ),
    ScamPatternRule(
        pattern=r"\b(do not tell|don't tell|keep this confidential|do not hang up|stay on the line|speak to nobody)\b",
        category="Secretive instructions",
        severity="HIGH",
        weight=25,
        pressure_weight=26,
        pressure_tactic="Social isolation demand",
        explanation="Instructs target to hide the call from branch staff, family, or verification channels.",
    ),
    ScamPatternRule(
        pattern=r"\b(anydesk|teamviewer|screen share|remote access|quick support|install app)\b",
        category="Remote-access requests",
        severity="HIGH",
        weight=34,
        pressure_weight=16,
        pressure_tactic="Device takeover coercion",
        explanation="Requests remote desktop control to hijack online banking sessions.",
    ),
    ScamPatternRule(
        pattern=r"\b(arrest warrant|legal action|police|federal investigation|before it is too late|prosecution)\b",
        category="Fear-based manipulation",
        severity="HIGH",
        weight=26,
        pressure_weight=28,
        pressure_tactic="Legal/fear coercion",
        explanation="Leverages fear of arrest or legal penalty to override rational scrutiny.",
    ),
    ScamPatternRule(
        pattern=r"\b(safe account|holding account|protect your funds|move (all )?funds|transfer to safe|skip verification|manual exception)\b",
        category="Suspicious financial transfers",
        severity="HIGH",
        weight=35,
        pressure_weight=20,
        pressure_tactic="Manufactured asset-protection urgency",
        explanation="Directs victim or agent to move funds to an unverified account or bypass controls.",
    ),
]


def run_deterministic_scam_fallback(
    transcript_text: str,
    provenance: str = "SIMULATION",
    fallback_reason: str | None = None,
) -> ScamAnalysisResult:
    """Deterministic local keyword & weighted-rule analyzer across all 9 banking threat categories."""
    text = transcript_text.strip()
    evidence: list[FlaggedPhrase] = []
    detected_patterns: list[str] = []
    tactics: list[str] = []

    raw_risk = 0
    raw_pressure = 0

    for rule in THREAT_RULES:
        match = re.search(rule.pattern, text, flags=re.IGNORECASE)
        if match:
            evidence.append(
                FlaggedPhrase(
                    phrase=match.group(0),
                    category=rule.category,
                    severity=rule.severity,
                    weight=rule.weight,
                    explanation=rule.explanation,
                )
            )
            if rule.category not in detected_patterns:
                detected_patterns.append(rule.category)
            if rule.pressure_tactic not in tactics:
                tactics.append(rule.pressure_tactic)
            raw_risk += rule.weight
            raw_pressure += rule.pressure_weight

    if text.count("!") >= 2 and raw_pressure > 0:
        raw_pressure += min(12, text.count("!") * 3)

    risk_score = round(float(min(100, raw_risk)), 1)
    pressure_score = round(float(min(100, raw_pressure)), 1)
    safety_score = round(max(0.0, 100.0 - risk_score), 1)

    if risk_score >= 65:
        explanation = (
            f"High-risk social engineering detected across {len(detected_patterns)} threat "
            f"categories: {', '.join(detected_patterns[:4])}."
        )
        recommended_action = "Block fund movement immediately and escalate to Fraud SOC."
    elif risk_score >= 25:
        explanation = (
            f"Moderate linguistic fraud risk detected ({', '.join(detected_patterns)})."
        )
        recommended_action = "Initiate out-of-band customer step-up verification."
    else:
        explanation = "No social-engineering patterns or coercive pressure indicators detected."
        recommended_action = "Language check clear; rely on biometric and liveness pillars."

    prov = "CACHED ANALYSIS" if provenance == "CACHED ANALYSIS" else "SIMULATION"
    fallback_used = prov != "CACHED ANALYSIS"

    return ScamAnalysisResult(
        risk_score=risk_score,
        safety_score=safety_score,
        behavioral_pressure_score=pressure_score,
        status="PASS" if risk_score < 40 else ("WARN" if risk_score < 70 else "FAIL"),
        categories=detected_patterns,
        detected_patterns=detected_patterns,
        pressure_tactics=tactics,
        flagged_phrases=evidence,
        engine_used="Deterministic Keyword & Weighted-Rule Fallback"
        if fallback_used
        else "Cached Scenario Scam Fixture",
        provenance=prov,  # type: ignore[arg-type]
        summary=explanation,
        recommended_action=recommended_action,
        fallback_used=fallback_used,
        fallback_reason=fallback_reason,
        cache_hit=prov == "CACHED ANALYSIS",
    )


def format_scam_contract_dict(scam: ScamAnalysisResult) -> dict:
    """Return the structured JSON contract for Script & Scam Analysis."""
    return {
        "scam_risk_score": scam.risk_score,
        "behavioral_pressure_score": scam.behavioral_pressure_score,
        "detected_patterns": scam.detected_patterns,
        "evidence": [fp.model_dump() for fp in scam.flagged_phrases],
        "explanation": scam.summary,
        "recommended_action": scam.recommended_action,
        "engine_used": scam.engine_used,
        "fallback_used": scam.fallback_used,
        "fallback_reason": scam.fallback_reason,
        "provenance": scam.provenance,
        "cache_hit": scam.cache_hit,
    }


async def analyze_scam_transcript(
    transcript_text: str,
    analysis_mode: AnalysisMode,
    bypass_cache: bool = False,
    call_id: str | None = None,
) -> ScamAnalysisResult:
    """Analyze transcript with Groq LLM in REAL mode, or cached/deterministic fallback in DEMO/CACHED."""
    from app.services.content_analysis_service import analyse_text

    t0 = time.perf_counter()
    cleaned = transcript_text.strip()

    if analysis_mode == "SIMULATION":
        det = run_deterministic_scam_fallback(
            cleaned,
            provenance="SIMULATION",
            fallback_reason="SIMULATION mode active: deterministic keyword & weighted-rule analyzer executed.",
        )
        return det.model_copy(
            update={
                "latency_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                "model_version": "rule-engine-v1",
                "raw_payload": format_scam_contract_dict(det),
            }
        )

    if analysis_mode == "CACHED":
        det = run_deterministic_scam_fallback(
            cleaned,
            provenance="CACHED ANALYSIS",
            fallback_reason="CACHED mode active: rule analyzer on cached transcript.",
        )
        return det.model_copy(
            update={
                "latency_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                "model_version": "rule-engine-v1",
                "raw_payload": format_scam_contract_dict(det),
            }
        )

    scam, _ = await analyse_text(
        cleaned,
        analysis_mode="REAL",
        bypass_cache=bypass_cache,
        call_id=call_id,
    )
    return scam


_CATEGORY_MAP: dict[str, ManipulationCategory] = {
    "Urgent payment requests": "urgency",
    "Secretive instructions": "secrecy",
    "Authority impersonation": "authority",
    "Bank-account threats": "threat",
    "Fear-based manipulation": "threat",
    "OTP requests": "urgency",
    "Password disclosure": "secrecy",
    "Remote-access requests": "threat",
    "Suspicious financial transfers": "urgency",
}


def extract_manipulation_analysis(
    transcript_text: str,
    transcript_segments: list[TranscriptSegment] | None = None,
    provenance: AnalysisProvenance = "SIMULATION",
) -> ManipulationAnalysisResult:
    """Layer 4 extractor: maps transcript into urgency/secrecy/authority/threat markers + sparkline."""
    t0 = time.perf_counter()
    cleaned_text = transcript_text.strip()
    valid_segments = [
        seg for seg in (transcript_segments or [])
        if seg.text.strip() and not seg.text.strip().startswith("[Audio sample:")
    ]
    if not cleaned_text and not valid_segments:
        return ManipulationAnalysisResult(
            score=None,
            safety_score=None,
            status="UNAVAILABLE",
            model_version="unavailable",
            latency_ms=round((time.perf_counter() - t0) * 1000.0, 2),
            category_counts={"urgency": 0, "secrecy": 0, "authority": 0, "threat": 0},
            markers=[],
            sparkline=[],
            provenance=provenance,
            raw_payload={"status": "UNAVAILABLE", "reason": "No transcript supplied."},
        )

    segments = transcript_segments or [
        TranscriptSegment(
            id="seg-1",
            timestamp_sec=1.0,
            speaker="CALLER",
            text=cleaned_text,
        )
    ]

    markers: list[ManipulationMarker] = []
    counts: dict[str, int] = {"urgency": 0, "secrecy": 0, "authority": 0, "threat": 0}
    sparkline: list[float] = []
    cumulative_pressure = 0.0

    for seg in segments:
        if seg.speaker != "CALLER":
            sparkline.append(round(min(100.0, cumulative_pressure), 1))
            continue
        seg_text = seg.text.strip()
        for rule in THREAT_RULES:
            match = re.search(rule.pattern, seg_text, flags=re.IGNORECASE)
            if match:
                cat = _CATEGORY_MAP.get(rule.category, "threat")
                counts[cat] = counts.get(cat, 0) + 1
                cumulative_pressure = min(100.0, cumulative_pressure + rule.pressure_weight)
                excerpt = seg_text if len(seg_text) <= 140 else f"{seg_text[:137].rstrip()}..."
                markers.append(
                    ManipulationMarker(
                        category=cat,
                        phrase=match.group(0),
                        excerpt=excerpt,
                        timestamp_sec=seg.timestamp_sec,
                        weight=rule.pressure_weight,
                        severity=rule.severity,
                    )
                )
        if seg_text.count("!") >= 1 and cumulative_pressure > 0:
            cumulative_pressure = min(100.0, cumulative_pressure + 6.0)
        sparkline.append(round(min(100.0, cumulative_pressure), 1))

    score = round(min(100.0, cumulative_pressure), 1)
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return ManipulationAnalysisResult(
        score=score,
        safety_score=round(max(0.0, 100.0 - score), 1),
        model_version="aegis-manipulation-v1",
        latency_ms=latency_ms,
        category_counts=counts,
        markers=markers,
        sparkline=sparkline or [score],
        provenance=provenance,
        raw_payload={
            "score": score,
            "category_counts": counts,
            "markers": [m.model_dump() for m in markers],
            "sparkline": sparkline,
        },
    )
