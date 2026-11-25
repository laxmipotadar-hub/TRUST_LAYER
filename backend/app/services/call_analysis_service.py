from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.repositories.json_store import repo
from app.scenarios.catalog import (
    SCENARIOS,
    get_cached_scenario_signals,
    get_scenario_caller_profile,
    get_scenario_segment_chunks,
)
from app.schemas import (
    AnalysisMode,
    AnalysisProvenance,
    AudioProfile,
    CallerProfile,
    CallSession,
    ExecutionMode,
    LivenessCheckResult,
    ManipulationAnalysisResult,
    SegmentRiskChunk,
    SpeakerIdentityResult,
    TranscriptSegment,
    UnifiedCallAnalysisResponse,
    VoiceAuthenticityResult,
)
from app.services.aletheia_service import detect_deepfake_aletheia
from app.services.cache_service import cache_service
from app.services.eidos_service import NEUTRAL_UNENROLLED_SCORE, verify_speaker_eidos
from app.services.ledger_service import record_operation
from app.services.scam_analysis_service import analyze_scam_transcript, extract_manipulation_analysis
from app.services.trust_engine import build_evidence_timeline, compute_composite_trust


def _resolve_overall_provenance(provenances: list[AnalysisProvenance]) -> AnalysisProvenance:
    if all(p == "REAL ANALYSIS" for p in provenances):
        return "REAL ANALYSIS"
    if all(p == "CACHED ANALYSIS" for p in provenances):
        return "CACHED ANALYSIS"
    return "SIMULATION"


def _build_session_and_unified(
    *,
    call_id: str,
    timestamp: str,
    scenario_id: str | None,
    caller_label: str,
    claimed_customer_id: str,
    app_mode: str,
    execution_mode: ExecutionMode,
    analysis_mode: AnalysisMode,
    voice: VoiceAuthenticityResult,
    identity: SpeakerIdentityResult,
    scam,
    manipulation: ManipulationAnalysisResult,
    liveness: LivenessCheckResult,
    transcript: list[TranscriptSegment],
    audio_profile: AudioProfile,
    model_status: dict[str, str],
    caller_profile: CallerProfile | None = None,
    segment_chunks: list[SegmentRiskChunk] | None = None,
    previous_score: float | None = None,
    credits_saved: float = 0.0,
) -> UnifiedCallAnalysisResponse:
    state = repo.get_settings_state()
    trust = compute_composite_trust(
        voice,
        identity,
        scam,
        liveness,
        weights=state.get("layer_weights"),
        safe_threshold=float(state.get("safe_threshold", 75.0)),
        review_threshold=float(state.get("review_threshold", 40.0)),
        ema_alpha=float(state.get("ema_alpha", 0.45)),
        previous_score=previous_score,
    )
    timeline = build_evidence_timeline(voice, identity, scam, liveness, trust)
    overall_prov = _resolve_overall_provenance(
        [voice.provenance, identity.provenance, scam.provenance, liveness.provenance]
    )

    masked_suffix = claimed_customer_id[-4:] if len(claimed_customer_id) >= 4 else claimed_customer_id
    resolved_profile = caller_profile or CallerProfile(
        caller_phone_id="SIP / VoIP Inbound",
        claimed_name=identity.matched_customer_name or caller_label,
        account_ref_masked=f"•••• {masked_suffix}",
        call_duration_sec=15.0,
        verification_status=(
            "IDENTITY VERIFIED"
            if identity.status == "PASS"
            else ("UNENROLLED" if not identity.enrolled else identity.status)
        ),
    )

    session = CallSession(
        call_id=call_id,
        created_at=timestamp,
        timestamp=timestamp,
        scenario_id=scenario_id,
        caller_label=caller_label,
        claimed_customer_id=claimed_customer_id,
        caller_profile=resolved_profile,
        call_state="VERDICT",
        mode="REAL" if app_mode == "REAL" else "DEMO",
        execution_mode=execution_mode,
        analysis_mode=analysis_mode,
        overall_provenance=overall_prov,
        synthetic_probability=voice.deepfake_probability,
        voice_authenticity_score=voice.score,
        speaker_match_percentage=identity.score,
        scam_risk_score=scam.risk_score,
        behavioral_pressure_score=scam.behavioral_pressure_score,
        trust_score=trust.composite_score,
        verdict=trust.verdict,
        band=trust.band,
        decision=trust.decision,
        model_status=model_status,
        voice_authenticity=voice,
        speaker_identity=identity,
        scam_analysis=scam,
        manipulation_analysis=manipulation,
        liveness=liveness,
        trust_breakdown=trust,
        transcript=transcript,
        evidence_timeline=timeline,
        segment_chunks=segment_chunks or [],
        audio_profile=audio_profile,
        credits_saved=credits_saved,
    )
    repo.save_call(session)

    return UnifiedCallAnalysisResponse(
        call_id=call_id,
        execution_mode=execution_mode,
        analysis_mode=analysis_mode,
        synthetic_probability=voice.deepfake_probability,
        voice_authenticity=voice.score,
        speaker_match_percentage=identity.score,
        scam_risk_score=scam.risk_score,
        behavioral_pressure_score=scam.behavioral_pressure_score,
        trust_score=trust.composite_score,
        verdict=trust.verdict,
        band=trust.band,
        decision=trust.decision,
        evidence=timeline,
        timestamp=timestamp,
        model_status=model_status,
        recommended_action=trust.recommended_action,
        credits_saved=credits_saved,
        session=session,
    )


async def analyze_scenario_call(scenario_id: str) -> UnifiedCallAnalysisResponse:
    """Execute S1-S4. In DEMO mode, uses predefined cached fixtures and NEVER calls real APIs."""
    scenario = SCENARIOS[scenario_id]
    state = repo.get_settings_state()
    app_mode = state["app_mode"]

    voice, identity, liveness, cached_scam = get_cached_scenario_signals(scenario_id)

    if app_mode == "DEMO":
        analysis_mode: AnalysisMode = "CACHED"
        scam = cached_scam
        model_status = {
            "aletheia": "CACHED_FIXTURE",
            "eidos": "CACHED_FIXTURE",
            "scam_analysis": "CACHED_FIXTURE",
            "liveness": "CACHED_FIXTURE",
        }
    else:
        # REAL mode running a scenario (no raw audio stream -> transcript goes to Gemini/fallback,
        # while cached scenario audio metrics remain clearly marked CACHED ANALYSIS).
        analysis_mode = "REAL"
        joined_caller = " ".join(seg.text for seg in scenario.transcript if seg.speaker == "CALLER")
        scam = await analyze_scam_transcript(joined_caller, analysis_mode="REAL")
        model_status = {
            "aletheia": "CACHED_FIXTURE",
            "eidos": "CACHED_FIXTURE",
            "scam_analysis": "FALLBACK" if scam.fallback_used else ("CACHED" if scam.cache_hit else "OK"),
            "liveness": "CACHED_FIXTURE",
        }

    call_id = f"CALL-{uuid4().hex[:8].upper()}"
    joined_caller = " ".join(seg.text for seg in scenario.transcript if seg.speaker == "CALLER")
    manipulation = extract_manipulation_analysis(
        joined_caller,
        transcript_segments=scenario.transcript,
        provenance="CACHED ANALYSIS" if app_mode == "DEMO" else scam.provenance,
    )
    record_operation(
        operation_id=f"demo_{scenario.id.lower()}_{uuid4().hex[:6]}",
        call_id=call_id,
        service="pipeline",
        endpoint="/api/scenarios/run",
        mode="DEMO",
        status="done",
        cost_credits=0.0,
        latency_ms=12.0,
        cached=False,
    )

    return _build_session_and_unified(
        call_id=call_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        scenario_id=scenario.id,
        caller_label=f"{scenario.code}: {scenario.caller_name}",
        claimed_customer_id=scenario.claimed_customer_id,
        app_mode=app_mode,
        execution_mode="DEMO",
        analysis_mode=analysis_mode,
        voice=voice,
        identity=identity,
        scam=scam,
        manipulation=manipulation,
        liveness=liveness,
        transcript=scenario.transcript,
        audio_profile=scenario.audio_profile,
        model_status=model_status,
        caller_profile=get_scenario_caller_profile(scenario.id, identity),
        segment_chunks=get_scenario_segment_chunks(scenario.id),
        credits_saved=500.0 if scenario.id == "S2" else 0.0,
    )


async def analyze_call_unified(
    *,
    audio_bytes: bytes | None,
    filename: str,
    transcript_text: str,
    claimed_customer_id: str,
    caller_label: str,
    requested_mode: AnalysisMode | None = None,
    execution_mode: ExecutionMode | None = None,
    duration_hint_sec: float | None = None,
    previous_score: float | None = None,
) -> UnifiedCallAnalysisResponse:
    """Coordinate Aletheia, Eidos, Scam Analysis, Behavioral Pressure, and Trust Score."""
    state = repo.get_settings_state()
    app_mode = state["app_mode"]
    call_id = f"CALL-{uuid4().hex[:8].upper()}"

    if execution_mode == "LIVE":
        mode: AnalysisMode = "REAL"
        effective_exec_mode: ExecutionMode = "LIVE"
        bypass_cache = True
    elif execution_mode == "CACHED":
        mode = "CACHED"
        effective_exec_mode = "CACHED"
        bypass_cache = False
    elif execution_mode == "DEMO":
        mode = "SIMULATION"
        effective_exec_mode = "DEMO"
        bypass_cache = False
    else:
        mode = requested_mode or ("REAL" if app_mode == "REAL" else "SIMULATION")
        effective_exec_mode = "LIVE" if mode == "REAL" else ("CACHED" if mode == "CACHED" else "DEMO")
        bypass_cache = mode == "REAL" and not state.get("cache_enabled", True)

    live_segments: list[SegmentRiskChunk] = []
    credits_saved = 0.0

    if mode == "REAL":
        if audio_bytes:
            aletheia_eval = await detect_deepfake_aletheia(
                audio_bytes,
                filename=filename,
                duration_hint_sec=duration_hint_sec,
                bypass_cache=bypass_cache,
                call_id=call_id,
            )
            voice = aletheia_eval.result
            aletheia_status = aletheia_eval.model_status
            live_segments = aletheia_eval.segments
        else:
            voice = VoiceAuthenticityResult(
                score=None,
                deepfake_probability=None,
                status="UNAVAILABLE",
                artifacts_detected=["No audio input supplied"],
                provenance="REAL ANALYSIS",
                detail="No audio recording provided for DetectifAI Aletheia deepfake analysis.",
            )
            aletheia_status = "UNAVAILABLE"

        eidos_eval = await verify_speaker_eidos(
            audio_bytes,
            claimed_customer_id,
            filename=filename,
            bypass_cache=bypass_cache,
            call_id=call_id,
        )
        identity = eidos_eval.result
        eidos_status = eidos_eval.model_status

        if aletheia_status in ("OK", "CACHED") and voice.score is not None:
            liveness = LivenessCheckResult(
                passed=voice.status == "PASS",
                replay_detected=False,
                score=voice.score,
                status=voice.status,
                signal_notes="Derived from DetectifAI Aletheia acoustic inspection.",
                provenance="REAL ANALYSIS",
            )
            liveness_status = "OK"
        else:
            liveness = LivenessCheckResult(
                passed=False,
                replay_detected=False,
                score=None,
                status="UNAVAILABLE",
                signal_notes="Liveness unavailable because Aletheia real-time analysis did not complete.",
                provenance="REAL ANALYSIS",
            )
            liveness_status = "UNAVAILABLE"

        scam = await analyze_scam_transcript(
            transcript_text,
            analysis_mode="REAL",
            bypass_cache=bypass_cache,
            call_id=call_id,
        )
        scam_status = (
            "FALLBACK"
            if scam.fallback_used
            else ("CACHED" if scam.cache_hit else "OK")
        )
        model_status = {
            "aletheia": aletheia_status,
            "eidos": eidos_status,
            "scam_analysis": scam_status,
            "manipulation": "OK",
            "liveness": liveness_status,
        }
    elif mode == "CACHED":
        # Strict CACHE lookup: returns stored responses if found, otherwise honest CACHE_MISS
        ale_key = (
            cache_service.compute_request_hash("aletheia", {"use_sliding_chunks": False}, audio_bytes=audio_bytes)
            if audio_bytes
            else None
        )
        cached_ale = cache_service.get(ale_key) if ale_key else None
        if cached_ale and isinstance(cached_ale.get("payload"), dict):
            voice = VoiceAuthenticityResult(**{**cached_ale["payload"], "provenance": "CACHED ANALYSIS", "cache_hit": True})
            aletheia_status = "CACHED"
        else:
            voice = VoiceAuthenticityResult(
                score=None,
                deepfake_probability=None,
                status="UNAVAILABLE",
                artifacts_detected=["No cached Aletheia entry for this audio"],
                provenance="CACHED ANALYSIS",
                detail="Cache miss: no previously stored Aletheia response for this audio payload.",
            )
            aletheia_status = "CACHE_MISS"

        enrolled = repo.get_voiceprint_by_customer(claimed_customer_id)
        if not enrolled:
            identity = SpeakerIdentityResult(
                score=NEUTRAL_UNENROLLED_SCORE,
                match_confidence=0.5,
                claimed_customer_id=claimed_customer_id,
                matched_customer_name=None,
                enrolled=False,
                status="WARN",
                provenance="CACHED ANALYSIS",
                detail=f"Unenrolled customer '{claimed_customer_id}' — neutral score 50.0 applied.",
            )
            eidos_status = "UNENROLLED"
        else:
            speaker_ref = enrolled.provider_speaker_ref or claimed_customer_id
            eid_key = (
                cache_service.compute_request_hash("eidos_verify", {"speaker_id": speaker_ref}, audio_bytes=audio_bytes)
                if audio_bytes
                else None
            )
            cached_eid = cache_service.get(eid_key) if eid_key else None
            if cached_eid and isinstance(cached_eid.get("payload"), dict):
                identity = SpeakerIdentityResult(**{**cached_eid["payload"], "provenance": "CACHED ANALYSIS", "cache_hit": True})
                eidos_status = "CACHED"
            else:
                identity = SpeakerIdentityResult(
                    score=None,
                    match_confidence=None,
                    claimed_customer_id=claimed_customer_id,
                    matched_customer_name=enrolled.customer_name,
                    enrolled=True,
                    status="UNAVAILABLE",
                    provenance="CACHED ANALYSIS",
                    detail="Cache miss: no previously stored Eidos response for this audio.",
                )
                eidos_status = "CACHE_MISS"

        liveness = LivenessCheckResult(
            passed=aletheia_status == "CACHED" and voice.status == "PASS",
            replay_detected=False,
            score=voice.score if aletheia_status == "CACHED" else None,
            status=voice.status if aletheia_status == "CACHED" else "UNAVAILABLE",
            signal_notes=(
                "Derived from cached Aletheia inspection."
                if aletheia_status == "CACHED"
                else "No cached liveness telemetry for this audio."
            ),
            provenance="CACHED ANALYSIS",
        )
        scam = await analyze_scam_transcript(transcript_text, analysis_mode="CACHED")
        model_status = {
            "aletheia": aletheia_status,
            "eidos": eidos_status,
            "scam_analysis": "CACHED" if scam.cache_hit else "FALLBACK",
            "liveness": "CACHED" if aletheia_status == "CACHED" else "CACHE_MISS",
        }
    else:
        # Explicit SIMULATION evaluation
        prov: AnalysisProvenance = "SIMULATION"
        enrolled = repo.get_voiceprint_by_customer(claimed_customer_id)
        speaker_score = 92.5 if enrolled else NEUTRAL_UNENROLLED_SCORE

        voice = VoiceAuthenticityResult(
            score=95.0,
            deepfake_probability=0.05,
            status="PASS",
            artifacts_detected=[],
            provenance=prov,
            detail="SIMULATION voice authenticity evaluation (non-production signal).",
        )
        identity = SpeakerIdentityResult(
            score=speaker_score,
            match_confidence=round(speaker_score / 100.0, 3),
            claimed_customer_id=claimed_customer_id,
            matched_customer_name=enrolled.customer_name if enrolled else None,
            enrolled=enrolled is not None,
            status="PASS" if enrolled else "WARN",
            provenance=prov,
            detail=(
                f"SIMULATION Eidos match for enrolled customer {enrolled.customer_name}."
                if enrolled
                else f"Unenrolled customer '{claimed_customer_id}' — neutral score 50.0 applied."
            ),
        )
        liveness = LivenessCheckResult(
            passed=True,
            replay_detected=False,
            score=94.0,
            status="PASS",
            signal_notes="SIMULATION channel liveness verification.",
            provenance=prov,
        )
        scam = await analyze_scam_transcript(transcript_text, analysis_mode="SIMULATION")
        model_status = {
            "aletheia": "SIMULATION",
            "eidos": "SIMULATION" if enrolled else "UNENROLLED",
            "scam_analysis": "FALLBACK" if scam.fallback_used else "SIMULATION",
            "liveness": "SIMULATION",
        }

    risk_level = "HIGH" if scam.risk_score >= 60 else ("MEDIUM" if scam.risk_score >= 25 else "LOW")
    transcript_segments = [
        TranscriptSegment(
            id="seg-1",
            timestamp_sec=1.0,
            speaker="CALLER",
            text=transcript_text.strip() or f"[Audio sample: {filename}]",
            risk_level=risk_level,
            triggers=[fp.phrase for fp in scam.flagged_phrases],
        )
    ]
    manipulation = extract_manipulation_analysis(
        transcript_text,
        transcript_segments=transcript_segments,
        provenance=scam.provenance,
    )
    if effective_exec_mode == "CACHED":
        credits_saved = 524.0 if aletheia_status == "CACHED" else 0.0

    return _build_session_and_unified(
        call_id=call_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        scenario_id=None,
        caller_label=caller_label,
        claimed_customer_id=claimed_customer_id,
        app_mode=app_mode,
        execution_mode=effective_exec_mode,
        analysis_mode=mode,
        voice=voice,
        identity=identity,
        scam=scam,
        manipulation=manipulation,
        liveness=liveness,
        transcript=transcript_segments,
        audio_profile=AudioProfile(
            pitch_hz=124.0,
            jitter_pct=0.65,
            harmonic_noise_ratio_db=22.5,
            spectral_flatness=0.21,
            synthetic_cadence_index=0.1,
            replay_echo_correlation=0.1,
        ),
        model_status=model_status,
        segment_chunks=live_segments,
        previous_score=previous_score,
        credits_saved=credits_saved,
    )
