from __future__ import annotations

from typing import Literal

from app.schemas import (
    CompositeTrustBreakdown,
    EvidenceEvent,
    FactorContribution,
    LivenessCheckResult,
    ScamAnalysisResult,
    SignalStatus,
    SpeakerIdentityResult,
    TrustVerdict,
    VoiceAuthenticityResult,
)


LAYER_WEIGHTS = {
    "voice_authenticity": 0.35,
    "speaker_identity": 0.30,
    "scam_safety": 0.20,
    "behavioral_safety": 0.15,
}

NEUTRAL_SPEAKER_BASELINE = 50.0


def _clamp_100(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def verdict_from_score(score: float) -> TrustVerdict:
    """Apply Phase 3 thresholds: 75-100 SAFE, 40-74.99 CAUTION, 0-39.99 THREAT."""
    if score >= 75.0:
        return "SAFE"
    if score >= 40.0:
        return "CAUTION"
    return "THREAT"


def calculate_trust_score(
    *,
    voice_authenticity: float | None = None,
    synthetic_probability: float | None = None,
    speaker_match: float | None = None,
    speaker_enrolled: bool = True,
    scam_risk_score: float = 0.0,
    behavioral_pressure_score: float = 0.0,
    liveness_passed: bool = True,
    liveness_available: bool = True,
    voice_evidence: list[str] | None = None,
    speaker_evidence: list[str] | None = None,
    scam_evidence: list[str] | None = None,
    behavioral_evidence: list[str] | None = None,
    liveness_evidence: list[str] | None = None,
) -> CompositeTrustBreakdown:
    """
    Pure, frontend-independent AEGIS 4-layer Trust Score calculation engine.

    Formula:
      TRUST SCORE =
        (Voice Authenticity × 0.35)
      + (Speaker Match × 0.30)
      + (Scam Safety × 0.20)
      + (Behavioral Safety × 0.15)

    Challenge Liveness override:
      A failed Challenge Liveness check overrides the final security decision to THREAT
      without modifying the mathematical Trust Score.
    """
    # Layer 1: Voice Authenticity = (1 - Synthetic Probability) * 100
    if voice_authenticity is not None:
        v_score = round(_clamp_100(voice_authenticity), 2)
        syn_prob = (
            round(max(0.0, min(1.0, synthetic_probability)), 4)
            if synthetic_probability is not None
            else round(max(0.0, min(1.0, 1.0 - (v_score / 100.0))), 4)
        )
    elif synthetic_probability is not None:
        syn_prob = round(max(0.0, min(1.0, synthetic_probability)), 4)
        v_score = round(_clamp_100((1.0 - syn_prob) * 100.0), 2)
    else:
        syn_prob = None
        v_score = None

    # Layer 2: Speaker Identity (50 neutral baseline if unenrolled)
    if not speaker_enrolled:
        s_score: float | None = NEUTRAL_SPEAKER_BASELINE
    elif speaker_match is not None:
        s_score = round(_clamp_100(speaker_match), 2)
    else:
        s_score = None

    # Layer 3: Scam Safety = 100 - Scam Risk Score
    clamped_scam_risk = round(_clamp_100(scam_risk_score), 2)
    scam_safety = round(100.0 - clamped_scam_risk, 2)

    # Layer 4: Behavioral Safety = 100 - Behavioral Pressure Score
    clamped_pressure = round(_clamp_100(behavioral_pressure_score), 2)
    behavioral_safety = round(100.0 - clamped_pressure, 2)

    v_status: SignalStatus = (
        "UNAVAILABLE"
        if v_score is None
        else ("PASS" if v_score >= 75.0 else ("WARN" if v_score >= 40.0 else "FAIL"))
    )
    s_status: SignalStatus = (
        "UNAVAILABLE"
        if s_score is None
        else ("WARN" if not speaker_enrolled else ("PASS" if s_score >= 75.0 else ("WARN" if s_score >= 40.0 else "FAIL")))
    )
    scam_status: SignalStatus = (
        "PASS" if scam_safety >= 75.0 else ("WARN" if scam_safety >= 40.0 else "FAIL")
    )
    beh_status: SignalStatus = (
        "PASS" if behavioral_safety >= 75.0 else ("WARN" if behavioral_safety >= 40.0 else "FAIL")
    )

    v_contrib = round((v_score or 0.0) * LAYER_WEIGHTS["voice_authenticity"], 2)
    s_contrib = round((s_score or 0.0) * LAYER_WEIGHTS["speaker_identity"], 2)
    scam_contrib = round(scam_safety * LAYER_WEIGHTS["scam_safety"], 2)
    beh_contrib = round(behavioral_safety * LAYER_WEIGHTS["behavioral_safety"], 2)

    layers = [
        FactorContribution(
            key="voice_authenticity",
            label="Voice Authenticity",
            layer_name="Layer 1 — Voice Authenticity (Aletheia)",
            input_label="Synthetic Probability",
            input_value=syn_prob,
            raw_score=v_score,
            formula=(
                f"(1 - {syn_prob:.2f}) × 100 = {v_score:.2f}"
                if syn_prob is not None and v_score is not None
                else "(1 - Synthetic Probability) × 100 [UNAVAILABLE]"
            ),
            weight=LAYER_WEIGHTS["voice_authenticity"],
            weighted_points=v_contrib,
            weighted_contribution=v_contrib,
            explanation=(
                "Evaluates whether the caller's audio exhibits natural human vocal-tract acoustics "
                "or neural voice-synthesis / vocoder artifacts."
            ),
            evidence=voice_evidence
            or (
                [f"Voice authenticity computed at {v_score:.2f}/100 (synthetic prob {syn_prob:.2f})."]
                if v_score is not None and syn_prob is not None
                else ["Aletheia real-time deepfake telemetry unavailable."]
            ),
            status=v_status,
        ),
        FactorContribution(
            key="speaker_identity",
            label="Speaker Identity",
            layer_name="Layer 2 — Speaker Identity (Eidos)",
            input_label="Eidos Match %",
            input_value=s_score,
            raw_score=s_score,
            formula=(
                f"Neutral baseline = {NEUTRAL_SPEAKER_BASELINE:.2f}"
                if not speaker_enrolled
                else (
                    f"Eidos Match = {s_score:.2f}"
                    if s_score is not None
                    else "Eidos Match % [UNAVAILABLE]"
                )
            ),
            weight=LAYER_WEIGHTS["speaker_identity"],
            weighted_points=s_contrib,
            weighted_contribution=s_contrib,
            explanation=(
                "Compares the caller's voiceprint against the claimed customer's enrolled Eidos "
                "profile, applying a neutral 50.0 baseline when no voiceprint is enrolled."
            ),
            evidence=speaker_evidence
            or (
                [f"Unenrolled customer identity; neutral baseline {NEUTRAL_SPEAKER_BASELINE:.0f} applied."]
                if not speaker_enrolled
                else (
                    [f"Eidos speaker similarity match: {s_score:.2f}%."]
                    if s_score is not None
                    else ["Eidos speaker verification telemetry unavailable."]
                )
            ),
            status=s_status,
        ),
        FactorContribution(
            key="scam_safety",
            label="Scam-Script Safety",
            layer_name="Layer 3 — Scam-Script Risk (Gemini / Rule Engine)",
            input_label="Scam Risk Score",
            input_value=clamped_scam_risk,
            raw_score=scam_safety,
            formula=f"100 - {clamped_scam_risk:.2f} = {scam_safety:.2f}",
            weight=LAYER_WEIGHTS["scam_safety"],
            weighted_points=scam_contrib,
            weighted_contribution=scam_contrib,
            explanation=(
                "Inverts detected social-engineering script risk (OTP harvesting, remote access, "
                "authority impersonation, safe-account transfers) into a positive safety contribution."
            ),
            evidence=scam_evidence
            or [f"Scam risk evaluated at {clamped_scam_risk:.2f}/100 -> safety {scam_safety:.2f}/100."],
            status=scam_status,
        ),
        FactorContribution(
            key="behavioral_safety",
            label="Behavioral Safety",
            layer_name="Layer 4 — Behavioral Pressure",
            input_label="Behavioral Pressure Score",
            input_value=clamped_pressure,
            raw_score=behavioral_safety,
            formula=f"100 - {clamped_pressure:.2f} = {behavioral_safety:.2f}",
            weight=LAYER_WEIGHTS["behavioral_safety"],
            weighted_points=beh_contrib,
            weighted_contribution=beh_contrib,
            explanation=(
                "Measures urgency, coercion, secrecy demands, intimidation, and manipulation tactics "
                "in the caller's speech and converts them into a positive behavioral safety score."
            ),
            evidence=behavioral_evidence
            or [
                f"Behavioral pressure evaluated at {clamped_pressure:.2f}/100 -> safety {behavioral_safety:.2f}/100."
            ],
            status=beh_status,
        ),
    ]

    liveness_state: Literal["PASSED", "FAILED", "UNAVAILABLE"] = (
        "UNAVAILABLE" if not liveness_available else ("PASSED" if liveness_passed else "FAILED")
    )

    if v_score is None or s_score is None:
        drivers: list[str] = []
        if v_score is None:
            drivers.append("Layer 1 (Aletheia) telemetry unavailable")
        if s_score is None:
            drivers.append("Layer 2 (Eidos) telemetry unavailable")
        return CompositeTrustBreakdown(
            composite_score=None,
            score_based_verdict="INCOMPLETE ANALYSIS",
            verdict="INCOMPLETE ANALYSIS",
            final_decision="INCOMPLETE ANALYSIS",
            liveness_override_applied=False,
            liveness_status=liveness_state,
            recommended_action=(
                "Do not auto-approve caller. Required real-time biometric AI service(s) failed or are unavailable; "
                "escalate for manual callback verification."
            ),
            policy_override_applied="Incomplete AI Telemetry: refusing to issue a SAFE verdict without Aletheia & Eidos.",
            factor_contributions=layers,
            primary_risk_drivers=drivers,
        )

    composite_score = round(v_contrib + s_contrib + scam_contrib + beh_contrib, 2)
    score_verdict = verdict_from_score(composite_score)
    final_decision = score_verdict
    liveness_override = False
    policy_override: str | None = None
    drivers = []

    if v_score < 40.0:
        drivers.append(f"Low voice authenticity ({v_score:.2f}/100)")
    if s_score < 40.0:
        drivers.append(f"Low speaker match ({s_score:.2f}%)")
    if scam_safety < 40.0:
        drivers.append(f"High scam-script risk ({clamped_scam_risk:.2f}/100)")
    if behavioral_safety < 40.0:
        drivers.append(f"High behavioral pressure ({clamped_pressure:.2f}/100)")

    if liveness_available and not liveness_passed:
        liveness_override = True
        final_decision = "THREAT"
        policy_override = (
            "Challenge Liveness FAILED: Strong voice authenticity and speaker match cannot establish "
            "that the audio is live. Final security decision overridden from "
            f"{score_verdict} to THREAT (mathematical Trust Score {composite_score:.2f} preserved)."
        )
        drivers.insert(0, "Challenge Liveness FAILED (playback / non-live audio)")
        if liveness_evidence:
            drivers.extend(liveness_evidence)

    if not drivers:
        drivers.append("All four trust layers and Challenge Liveness within SAFE thresholds")

    if final_decision == "SAFE":
        action = "Proceed with standard banking servicing. All four trust layers and liveness verified."
    elif final_decision == "CAUTION":
        action = "Require out-of-band step-up authentication or dynamic Challenge Liveness before sensitive actions."
    else:
        action = (
            "Block high-risk account actions immediately, preserve forensic evidence, and escalate to Fraud SOC."
        )

    return CompositeTrustBreakdown(
        composite_score=composite_score,
        score_based_verdict=score_verdict,
        verdict=final_decision,
        final_decision=final_decision,
        liveness_override_applied=liveness_override,
        liveness_status=liveness_state,
        recommended_action=action,
        policy_override_applied=policy_override,
        factor_contributions=layers,
        primary_risk_drivers=drivers,
    )


def compute_composite_trust(
    voice: VoiceAuthenticityResult,
    identity: SpeakerIdentityResult,
    scam: ScamAnalysisResult,
    liveness: LivenessCheckResult,
) -> CompositeTrustBreakdown:
    """Adapt service result models into the pure 4-layer Trust Score engine."""
    voice_ev = [voice.detail] + list(voice.artifacts_detected)
    speaker_ev = [identity.detail]
    scam_ev = [scam.summary] + [
        f'"{fp.phrase}" ({fp.category}, +{fp.weight} risk)' for fp in scam.flagged_phrases
    ]
    beh_ev = [
        f"Behavioral pressure score: {scam.behavioral_pressure_score:.1f}/100",
        *[f"Tactic: {t}" for t in scam.pressure_tactics],
    ]
    live_ev = [liveness.signal_notes]

    return calculate_trust_score(
        voice_authenticity=voice.score,
        synthetic_probability=voice.deepfake_probability,
        speaker_match=identity.score,
        speaker_enrolled=identity.enrolled,
        scam_risk_score=scam.risk_score,
        behavioral_pressure_score=scam.behavioral_pressure_score,
        liveness_passed=liveness.passed and not liveness.replay_detected,
        liveness_available=liveness.status != "UNAVAILABLE",
        voice_evidence=voice_ev,
        speaker_evidence=speaker_ev,
        scam_evidence=scam_ev,
        behavioral_evidence=beh_ev,
        liveness_evidence=live_ev,
    )


def build_evidence_timeline(
    voice: VoiceAuthenticityResult,
    identity: SpeakerIdentityResult,
    scam: ScamAnalysisResult,
    liveness: LivenessCheckResult,
    trust: CompositeTrustBreakdown,
) -> list[EvidenceEvent]:
    voice_title = (
        f"Aletheia Voice Authenticity: {voice.score:.2f}/100"
        if voice.score is not None
        else "Aletheia Voice Check: UNAVAILABLE"
    )
    identity_title = (
        f"Eidos Speaker Match: {identity.score:.2f}% ({identity.claimed_customer_id})"
        if identity.score is not None
        else f"Eidos Speaker Match: UNAVAILABLE ({identity.claimed_customer_id})"
    )
    score_label = f"{trust.composite_score:.2f}/100" if trust.composite_score is not None else "N/A"

    return [
        EvidenceEvent(
            id="ev-voice",
            timestamp_sec=2.4,
            category="VOICE",
            severity="CRITICAL" if voice.status == "FAIL" else ("WARNING" if voice.status in ("WARN", "UNAVAILABLE") else "INFO"),
            title=voice_title,
            description=voice.detail,
            provenance=voice.provenance,
        ),
        EvidenceEvent(
            id="ev-identity",
            timestamp_sec=4.8,
            category="IDENTITY",
            severity="CRITICAL" if identity.status == "FAIL" else ("WARNING" if identity.status in ("WARN", "UNAVAILABLE") else "INFO"),
            title=identity_title,
            description=identity.detail,
            provenance=identity.provenance,
        ),
        EvidenceEvent(
            id="ev-liveness",
            timestamp_sec=6.2,
            category="LIVENESS",
            severity="CRITICAL" if not liveness.passed else ("WARNING" if liveness.status == "UNAVAILABLE" else "INFO"),
            title=(
                "Challenge Liveness: FAILED (Playback / Replay Detected)"
                if (liveness.replay_detected or not liveness.passed) and liveness.status != "UNAVAILABLE"
                else ("Challenge Liveness: Unavailable" if liveness.status == "UNAVAILABLE" else "Challenge Liveness: PASSED")
            ),
            description=liveness.signal_notes,
            provenance=liveness.provenance,
        ),
        EvidenceEvent(
            id="ev-scam",
            timestamp_sec=9.5,
            category="SCAM",
            severity="CRITICAL" if scam.risk_score >= 60 else ("WARNING" if scam.risk_score >= 25 else "INFO"),
            title=f"Scam & Pressure Analysis: Risk {scam.risk_score:.0f} / Pressure {scam.behavioral_pressure_score:.0f}",
            description=scam.summary,
            provenance=scam.provenance,
        ),
        EvidenceEvent(
            id="ev-policy",
            timestamp_sec=11.0,
            category="POLICY",
            severity="CRITICAL" if trust.final_decision == "THREAT" else ("WARNING" if trust.final_decision in ("CAUTION", "INCOMPLETE ANALYSIS") else "INFO"),
            title=(
                f"Trust Score {score_label} ({trust.score_based_verdict}) → Final Decision: {trust.final_decision}"
            ),
            description=trust.policy_override_applied or trust.recommended_action,
            provenance=scam.provenance,
        ),
    ]
