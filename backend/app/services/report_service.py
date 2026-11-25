from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.repositories.json_store import repo
from app.schemas import CallReportResponse, CallSession


VERDICT_TRANSLATIONS = {
    "SAFE": {
        "en": "SAFE — Caller voice, identity, liveness, and intent verified.",
        "es": "SEGURO — Voz, identidad, presencia en vivo e intención verificadas.",
        "fr": "SÛR — Voix, identité, vivacité et intention vérifiées.",
        "de": "SICHER — Stimme, Identität, Lebendigkeit und Absicht bestätigt.",
    },
    "CAUTION": {
        "en": "CAUTION — Step-up customer authentication required.",
        "es": "PRECAUCIÓN — Se requiere verificación adicional.",
        "fr": "PRUDENCE — Authentification renforcée requise.",
        "de": "VORSICHT — Zusätzliche Kundenprüfung erforderlich.",
    },
    "THREAT": {
        "en": "THREAT — Critical deepfake, replay/liveness failure, or social-engineering threat.",
        "es": "AMENAZA — Alerta crítica de deepfake, reproducción o fraude.",
        "fr": "MENACE — Alerte critique de synthèse vocale, rejeu ou fraude.",
        "de": "BEDROHUNG — Kritische Deepfake-, Replay- oder Betrugsgefahr.",
    },
    "INCOMPLETE ANALYSIS": {
        "en": "INCOMPLETE ANALYSIS — Required real-time AI model telemetry unavailable.",
        "es": "ANÁLISIS INCOMPLETO — Telemetría de IA en tiempo real no disponible.",
        "fr": "ANALYSE INCOMPLÈTE — Télémétrie IA en temps réel indisponible.",
        "de": "UNVOLLSTÄNDIGE ANALYSE — Erforderliche KI-Telemetrie nicht verfügbar.",
    },
}


def build_report_recommendations(call: CallSession) -> list[str]:
    tb = call.trust_breakdown
    final_decision = tb.final_decision
    recs: list[str] = []

    if final_decision == "THREAT":
        if tb.liveness_override_applied or not call.liveness.passed:
            recs.append(
                "Verify identity through another trusted channel (official branch callback or mobile app push)."
            )
            recs.append(
                "Do not rely on audio-only matching; replay attack suspected after failed Challenge Liveness."
            )
        if call.voice_authenticity.score is not None and call.voice_authenticity.score < 40:
            recs.append("Synthetic voice artifacts detected; block automated fulfillment immediately.")
        if call.scam_analysis.risk_score is not None and call.scam_analysis.risk_score >= 40:
            recs.append("Do not authorize payment, wire transfer, or OTP/credential changes.")
        recs.append("Request human intervention and pause automated voice response.")
        recs.append("Block suspicious caller and escalate forensic brief to the fraud investigation team.")
    elif final_decision in ("CAUTION", "INCOMPLETE ANALYSIS"):
        recs.append("Verify identity through another trusted channel before approving account changes.")
        recs.append("Issue a live dynamic Challenge Liveness prompt or transfer to a human specialist.")
        if final_decision == "INCOMPLETE ANALYSIS":
            recs.append("Do not auto-approve while real-time biometric telemetry is unavailable.")
    else:
        recs.append("Caller cleared across Voice Authenticity, Speaker Identity, Scam Safety, and Liveness.")
        recs.append("Proceed with standard banking servicing and retain audit record.")

    return recs


def generate_call_report(call: CallSession) -> CallReportResponse:
    report_id = f"RPT-{uuid4().hex[:8].upper()}"
    tb = call.trust_breakdown
    final_decision = tb.final_decision or tb.verdict
    score_verdict = tb.score_based_verdict or tb.verdict

    score_text = (
        f"{tb.composite_score:.2f}/100"
        if tb.composite_score is not None
        else "UNAVAILABLE"
    )
    human_takeover = any(a.action == "TRANSFER_TO_HUMAN" for a in call.actions_taken)
    actions_note = (
        f" Operator actions logged: {', '.join(a.action for a in call.actions_taken)}."
        if call.actions_taken
        else ""
    )
    summary = (
        f"Call {call.call_id} ({call.caller_label}) evaluated under {call.analysis_mode} mode "
        f"[{call.overall_provenance}] with composite trust score {score_text} "
        f"(Score-Based Verdict: {score_verdict}; Final Security Decision: {final_decision}). "
        f"Recommended action: {tb.recommended_action}"
        f"{actions_note}"
    )

    duration_sec = call.caller_profile.call_duration_sec if call.caller_profile else 15.0
    caller_id_display = (
        f"{call.caller_profile.claimed_name} ({call.caller_profile.caller_phone_id})"
        if call.caller_profile
        else call.caller_label
    )

    report = CallReportResponse(
        report_id=report_id,
        call_id=call.call_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
        caller_identity=caller_id_display,
        call_duration_sec=duration_sec,
        analysis_mode=call.analysis_mode,
        verdict=final_decision,
        score_based_verdict=score_verdict,
        final_security_decision=final_decision,
        composite_score=tb.composite_score,
        provenance=call.overall_provenance,
        executive_summary=summary,
        recommendations=build_report_recommendations(call),
        human_takeover_recorded=human_takeover,
        operator_actions=call.actions_taken,
        multilingual_verdicts=VERDICT_TRANSLATIONS[final_decision],
        call_session=call,
    )
    repo.save_report(report_id, report.model_dump())
    return report
