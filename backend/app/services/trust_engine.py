from __future__ import annotations

from typing import Literal

from app.schemas import (
    CallDecision,
    CompositeTrustBreakdown,
    EvidenceEvent,
    FactorContribution,
    FusionBand,
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


def verdict_from_score(
    score: float,
    safe_threshold: float = 75.0,
    review_threshold: float = 40.0,
) -> TrustVerdict:
    """Apply configurable fusion thresholds (defaults: 75+ SAFE, 40-74.99 CAUTION/REVIEW, <40 THREAT)."""
    if score >= safe_threshold:
        return "SAFE"
    if score >= review_threshold:
        return "CAUTION"
    return "THREAT"


def _to_fusion_band(verdict: TrustVerdict) -> FusionBand:
    if verdict == "CAUTION":
        return "REVIEW"
    return verdict


def _to_decision(verdict: TrustVerdict) -> CallDecision:
    if verdict == "SAFE":
        return "ALLOW"
    if verdict == "CAUTION":
        return "STEP_UP"
    if verdict == "THREAT":
        return "BLOCK"
    return "INCOMPLETE ANALYSIS"


def _normalize_weights(custom: dict[str, float] | None) -> dict[str, float]:
    base = dict(LAYER_WEIGHTS)
    if custom:
        for k in base:
            if k in custom and custom[k] >= 0:
                base[k] = float(custom[k])
    total = sum(base.values())
    if total <= 0:
        return dict(LAYER_WEIGHTS)
    return {k: round(v / total, 4) for k, v in base.items()}


def calculate_trust_score(
    *,
    voice_authenticity: float | None = None,
    synthetic_probability: float | None = None,
    speaker_match: float | None = None,
    speaker_enrolled: bool = True,
    eidos_skipped: bool = False,
    eidos_skip_reason: str | None = None,
    scam_risk_score: float | None = 0.0,
    behavioral_pressure_score: float | None = 0.0,
    liveness_passed: bool = True,
    liveness_available: bool = True,
    voice_evidence: list[str] | None = None,
    speaker_evidence: list[str] | None = None,
    scam_evidence: list[str] | None = None,
    behavioral_evidence: list[str] | None = None,
    liveness_evidence: list[str] | None = None,
    weights: dict[str, float] | None = None,
    safe_threshold: float = 75.0,
    review_threshold: float = 40.0,
    ema_alpha: float = 0.45,
    previous_score: float | None = None,
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

    # Layer 2: Speaker Identity (skipped OR 50 neutral baseline if unenrolled)
    if eidos_skipped:
        s_score: float | None = None
    elif not speaker_enrolled:
        s_score = NEUTRAL_SPEAKER_BASELINE
    elif speaker_match is not None:
        s_score = round(_clamp_100(speaker_match), 2)
    else:
        s_score = None

    # Layer 3: Scam Safety = 100 - Scam Risk Score (None when transcript unavailable)
    if scam_risk_score is None:
        clamped_scam_risk: float | None = None
        scam_safety: float | None = None
    else:
        clamped_scam_risk = round(_clamp_100(scam_risk_score), 2)
        scam_safety = round(100.0 - clamped_scam_risk, 2)

    # Layer 4: Behavioral Safety = 100 - Behavioral Pressure Score (None when transcript unavailable)
    if behavioral_pressure_score is None:
        clamped_pressure: float | None = None
        behavioral_safety: float | None = None
    else:
        clamped_pressure = round(_clamp_100(behavioral_pressure_score), 2)
        behavioral_safety = round(100.0 - clamped_pressure, 2)

    v_status: SignalStatus = (
        "UNAVAILABLE"
        if v_score is None
        else ("PASS" if v_score >= 75.0 else ("WARN" if v_score >= 40.0 else "FAIL"))
    )
    s_status: SignalStatus = (
        "skipped"
        if eidos_skipped
        else (
            "UNAVAILABLE"
            if s_score is None
            else ("WARN" if not speaker_enrolled else ("PASS" if s_score >= 75.0 else ("WARN" if s_score >= 40.0 else "FAIL")))
        )
    )
    scam_status: SignalStatus = (
        "UNAVAILABLE"
        if scam_safety is None
        else ("PASS" if scam_safety >= 75.0 else ("WARN" if scam_safety >= 40.0 else "FAIL"))
    )
    beh_status: SignalStatus = (
        "UNAVAILABLE"
        if behavioral_safety is None
        else ("PASS" if behavioral_safety >= 75.0 else ("WARN" if behavioral_safety >= 40.0 else "FAIL"))
    )

    active_weights = _normalize_weights(weights)
    v_contrib = round((v_score or 0.0) * active_weights["voice_authenticity"], 2)
    s_contrib = round((s_score or 0.0) * active_weights["speaker_identity"], 2) if not eidos_skipped else 0.0
    scam_contrib = round(scam_safety * active_weights["scam_safety"], 2) if scam_safety is not None else 0.0
    beh_contrib = round(behavioral_safety * active_weights["behavioral_safety"], 2) if behavioral_safety is not None else 0.0

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
            weight=active_weights["voice_authenticity"],
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
                f"Skipped ({eidos_skip_reason or 'gated'}) -> +0.0 pts"
                if eidos_skipped
                else (
                    f"Neutral baseline = {NEUTRAL_SPEAKER_BASELINE:.2f}"
                    if not speaker_enrolled
                    else (
                        f"Eidos Match = {s_score:.2f}"
                        if s_score is not None
                        else "Eidos Match % [UNAVAILABLE]"
                    )
                )
            ),
            weight=active_weights["speaker_identity"],
            weighted_points=s_contrib,
            weighted_contribution=s_contrib,
            explanation=(
                "Compares the caller's voiceprint against the claimed customer's enrolled Eidos "
                "profile, skipping cleanly when gated by Aletheia or when no live Voice ID exists."
            ),
            evidence=speaker_evidence
            or (
                [f"Skipped ({eidos_skip_reason or 'gated'})."]
                if eidos_skipped
                else (
                    [f"Unenrolled customer identity; neutral baseline {NEUTRAL_SPEAKER_BASELINE:.0f} applied."]
                    if not speaker_enrolled
                    else (
                        [f"Eidos speaker similarity match: {s_score:.2f}%."]
                        if s_score is not None
                        else ["Eidos speaker verification telemetry unavailable."]
                    )
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
            formula=(
                f"100 - {clamped_scam_risk:.2f} = {scam_safety:.2f}"
                if clamped_scam_risk is not None and scam_safety is not None
                else "100 - Scam Risk [UNAVAILABLE] (+0.0 pts)"
            ),
            weight=active_weights["scam_safety"],
            weighted_points=scam_contrib,
            weighted_contribution=scam_contrib,
            explanation=(
                "Inverts detected social-engineering script risk (OTP harvesting, remote access, "
                "authority impersonation, safe-account transfers) into a positive safety contribution."
            ),
            evidence=scam_evidence
            or (
                [f"Scam risk evaluated at {clamped_scam_risk:.2f}/100 -> safety {scam_safety:.2f}/100."]
                if clamped_scam_risk is not None and scam_safety is not None
                else ["L3 Script Analysis unavailable (no caller transcript supplied)."]
            ),
            status=scam_status,
        ),
        FactorContribution(
            key="behavioral_safety",
            label="Behavioral Safety",
            layer_name="Layer 4 — Behavioral Pressure",
            input_label="Behavioral Pressure Score",
            input_value=clamped_pressure,
            raw_score=behavioral_safety,
            formula=(
                f"100 - {clamped_pressure:.2f} = {behavioral_safety:.2f}"
                if clamped_pressure is not None and behavioral_safety is not None
                else "100 - Behavioral Pressure [UNAVAILABLE] (+0.0 pts)"
            ),
            weight=active_weights["behavioral_safety"],
            weighted_points=beh_contrib,
            weighted_contribution=beh_contrib,
            explanation=(
                "Measures urgency, coercion, secrecy demands, intimidation, and manipulation tactics "
                "in the caller's speech and converts them into a positive behavioral safety score."
            ),
            evidence=behavioral_evidence
            or (
                [
                    f"Behavioral pressure evaluated at {clamped_pressure:.2f}/100 -> safety {behavioral_safety:.2f}/100."
                ]
                if clamped_pressure is not None and behavioral_safety is not None
                else ["L4 Manipulation Analysis unavailable (no caller transcript supplied)."]
            ),
            status=beh_status,
        ),
    ]

    liveness_state: Literal["PASSED", "FAILED", "UNAVAILABLE"] = (
        "UNAVAILABLE" if not liveness_available else ("PASSED" if liveness_passed else "FAILED")
    )

    if v_score is None or (s_score is None and not eidos_skipped):
        drivers: list[str] = []
        if v_score is None:
            drivers.append("Layer 1 (Aletheia) telemetry unavailable")
        if s_score is None and not eidos_skipped:
            drivers.append("Layer 2 (Eidos) telemetry unavailable")
        return CompositeTrustBreakdown(
            composite_score=None,
            raw_composite_score=None,
            score_based_verdict="INCOMPLETE ANALYSIS",
            verdict="INCOMPLETE ANALYSIS",
            final_decision="INCOMPLETE ANALYSIS",
            band="INCOMPLETE ANALYSIS",
            decision="INCOMPLETE ANALYSIS",
            decision_reason="Required biometric AI telemetry is unavailable.",
            weights_used=active_weights,
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

    available_weight = (
        active_weights["voice_authenticity"]
        + (0.0 if eidos_skipped or s_score is None else active_weights["speaker_identity"])
        + (0.0 if scam_safety is None else active_weights["scam_safety"])
        + (0.0 if behavioral_safety is None else active_weights["behavioral_safety"])
    )
    weighted_sum = v_contrib + s_contrib + scam_contrib + beh_contrib
    if available_weight > 0 and available_weight < 0.999:
        raw_composite = round(_clamp_100(weighted_sum / available_weight), 2)
    else:
        raw_composite = round(weighted_sum, 2)
    ema_applied = previous_score is not None
    composite_score = (
        round(ema_alpha * raw_composite + (1.0 - ema_alpha) * float(previous_score), 2)
        if previous_score is not None
        else raw_composite
    )
    score_verdict = verdict_from_score(
        composite_score,
        safe_threshold=safe_threshold,
        review_threshold=review_threshold,
    )
    final_decision = score_verdict
    liveness_override = False
    voice_clone_override = False
    conflict_overrides: list[str] = []
    policy_override: str | None = None
    decision_reason: str | None = None
    drivers = []

    if v_score < 40.0:
        drivers.append(f"Low voice authenticity ({v_score:.2f}/100)")
    if s_score is not None and s_score < 40.0:
        drivers.append(f"Low speaker match ({s_score:.2f}%)")
    if scam_safety is not None and clamped_scam_risk is not None and scam_safety < 40.0:
        drivers.append(f"High scam-script risk ({clamped_scam_risk:.2f}/100)")
    if behavioral_safety is not None and clamped_pressure is not None and behavioral_safety < 40.0:
        drivers.append(f"High behavioral pressure ({clamped_pressure:.2f}/100)")

    # Explicit conflict override: Aletheia synthetic + Eidos match -> voice-clone override
    # Never trigger when Eidos was skipped!
    if (
        not eidos_skipped
        and s_score is not None
        and ((syn_prob is not None and syn_prob >= 0.50) or v_score < 50.0)
        and speaker_enrolled
        and s_score >= 65.0
    ):
        voice_clone_override = True
        final_decision = "THREAT"
        override_msg = "Aletheia synthetic + Eidos match -> voice-clone override"
        conflict_overrides.append(override_msg)
        policy_override = override_msg
        drivers.insert(0, override_msg)

    if liveness_available and not liveness_passed and not (eidos_skipped and eidos_skip_reason == "aletheia_fake"):
        liveness_override = True
        final_decision = "THREAT"
        liveness_msg = (
            "Challenge Liveness FAILED: Strong voice authenticity and speaker match cannot establish "
            "that the audio is live. Final security decision overridden from "
            f"{score_verdict} to THREAT (mathematical Trust Score {composite_score:.2f} preserved)."
        )
        conflict_overrides.append("Challenge Liveness FAILED -> replay override")
        policy_override = liveness_msg if not policy_override else f"{policy_override} | {liveness_msg}"
        drivers.insert(0, "Challenge Liveness FAILED (playback / non-live audio)")
        if liveness_evidence:
            drivers.extend(liveness_evidence)

    # Gate decisions cleanly when Eidos was skipped
    mapped_decision = _to_decision(final_decision)
    if eidos_skipped and eidos_skip_reason == "aletheia_fake":
        final_decision = "THREAT"
        mapped_decision = "END_CALL"
        decision_reason = "Possible synthetic speech - signal, not proof."
        action = decision_reason
        if not drivers:
            drivers.append(decision_reason)
    elif eidos_skipped and eidos_skip_reason == "no_voice_id":
        if final_decision == "SAFE":
            final_decision = "CAUTION"
        if final_decision != "THREAT":
            mapped_decision = "STEP_UP"
            decision_reason = "Voice match unavailable. Enroll a live Voice ID first."
            action = decision_reason
        else:
            mapped_decision = "END_CALL"
            decision_reason = "High risk detected without enrolled Voice ID."
            action = decision_reason
        drivers.insert(0, "Eidos skipped: no live Voice ID enrolled")
    else:
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
        decision_reason = action

    return CompositeTrustBreakdown(
        composite_score=composite_score,
        raw_composite_score=raw_composite,
        ema_applied=ema_applied,
        previous_smoothed_score=previous_score,
        score_based_verdict=score_verdict,
        verdict=final_decision,
        final_decision=final_decision,
        band=_to_fusion_band(final_decision),
        decision=mapped_decision,
        decision_reason=decision_reason,
        liveness_override_applied=liveness_override,
        voice_clone_override_applied=voice_clone_override,
        conflict_overrides=conflict_overrides,
        weights_used=active_weights,
        liveness_status=liveness_state,
        formula_summary=(
            f"TRUST SCORE = (Voice × {active_weights['voice_authenticity']:.2f}) "
            f"+ (Speaker × {active_weights['speaker_identity']:.2f}) "
            f"+ (Scam × {active_weights['scam_safety']:.2f}) "
            f"+ (Behavioral × {active_weights['behavioral_safety']:.2f})"
        ),
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
    *,
    weights: dict[str, float] | None = None,
    safe_threshold: float = 75.0,
    review_threshold: float = 40.0,
    ema_alpha: float = 0.45,
    previous_score: float | None = None,
) -> CompositeTrustBreakdown:
    """Adapt service result models into the pure 4-layer Trust Score engine."""
    voice_ev = [voice.detail] + list(voice.artifacts_detected)
    speaker_ev = [identity.detail]
    scam_ev = [scam.summary] + [
        f'"{fp.phrase}" ({fp.category}, +{fp.weight} risk)' for fp in scam.flagged_phrases
    ]
    beh_ev = (
        [
            f"Behavioral pressure score: {scam.behavioral_pressure_score:.1f}/100",
            *[f"Tactic: {t}" for t in scam.pressure_tactics],
        ]
        if scam.behavioral_pressure_score is not None
        else ["Behavioral pressure unavailable (no transcript supplied)."]
    )
    live_ev = [liveness.signal_notes]

    eidos_skipped = str(identity.status).lower() == "skipped"
    return calculate_trust_score(
        voice_authenticity=voice.score,
        synthetic_probability=voice.deepfake_probability,
        speaker_match=identity.score,
        speaker_enrolled=identity.enrolled,
        eidos_skipped=eidos_skipped,
        eidos_skip_reason=identity.skip_reason,
        scam_risk_score=scam.risk_score,
        behavioral_pressure_score=scam.behavioral_pressure_score,
        liveness_passed=liveness.passed and not liveness.replay_detected,
        liveness_available=liveness.status not in ("UNAVAILABLE", "INCOMPLETE"),
        voice_evidence=voice_ev,
        speaker_evidence=speaker_ev,
        scam_evidence=scam_ev,
        behavioral_evidence=beh_ev,
        liveness_evidence=live_ev,
        weights=weights,
        safe_threshold=safe_threshold,
        review_threshold=review_threshold,
        ema_alpha=ema_alpha,
        previous_score=previous_score,
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
    if str(identity.status).lower() == "skipped":
        identity_title = f"Eidos Speaker Match: SKIPPED ({identity.skip_reason or 'gated'})"
    elif identity.score is not None:
        identity_title = f"Eidos Speaker Match: {identity.score:.2f}% ({identity.claimed_customer_id})"
    else:
        identity_title = f"Eidos Speaker Match: UNAVAILABLE ({identity.claimed_customer_id})"
    score_label = f"{trust.composite_score:.2f}/100" if trust.composite_score is not None else "N/A"
    scam_sev: Literal["INFO", "WARNING", "CRITICAL"] = (
        "WARNING"
        if scam.risk_score is None
        else ("CRITICAL" if scam.risk_score >= 60 else ("WARNING" if scam.risk_score >= 25 else "INFO"))
    )
    scam_title = (
        f"Scam & Pressure Analysis: Risk {scam.risk_score:.0f} / Pressure {(scam.behavioral_pressure_score or 0.0):.0f}"
        if scam.risk_score is not None
        else "Scam & Pressure Analysis: UNAVAILABLE (no transcript)"
    )

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
            severity=(
                "CRITICAL"
                if identity.status == "FAIL"
                else (
                    "INFO"
                    if str(identity.status).lower() == "skipped" and identity.skip_reason == "aletheia_fake"
                    else ("WARNING" if identity.status in ("WARN", "UNAVAILABLE", "error", "skipped", "SKIPPED") else "INFO")
                )
            ),
            title=identity_title,
            description=identity.detail,
            provenance=identity.provenance,
        ),
        EvidenceEvent(
            id="ev-liveness",
            timestamp_sec=6.2,
            category="LIVENESS",
            severity=(
                "WARNING"
                if liveness.status in ("UNAVAILABLE", "INCOMPLETE")
                else ("CRITICAL" if not liveness.passed else "INFO")
            ),
            title=(
                "Challenge Liveness: FAILED (Playback / Replay Detected)"
                if (liveness.replay_detected or not liveness.passed) and liveness.status not in ("UNAVAILABLE", "INCOMPLETE")
                else (
                    f"Challenge Liveness: {liveness.status}"
                    if liveness.status in ("UNAVAILABLE", "INCOMPLETE")
                    else "Challenge Liveness: PASSED"
                )
            ),
            description=liveness.signal_notes,
            provenance=liveness.provenance,
        ),
        EvidenceEvent(
            id="ev-scam",
            timestamp_sec=9.5,
            category="SCAM",
            severity=scam_sev,
            title=scam_title,
            description=scam.summary,
            provenance=scam.provenance,
        ),
        EvidenceEvent(
            id="ev-policy",
            timestamp_sec=11.0,
            category="POLICY",
            severity="CRITICAL" if trust.final_decision == "THREAT" else ("WARNING" if trust.final_decision in ("CAUTION", "INCOMPLETE ANALYSIS") else "INFO"),
            title=(
                f"Trust Score {score_label} ({trust.score_based_verdict}) → Final Decision: {trust.decision}"
            ),
            description=trust.decision_reason or trust.policy_override_applied or trust.recommended_action,
            provenance=scam.provenance,
        ),
    ]
