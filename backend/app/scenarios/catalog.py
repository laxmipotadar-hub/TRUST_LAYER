from __future__ import annotations

from app.schemas import (
    AudioProfile,
    CallerProfile,
    LivenessCheckResult,
    ScamAnalysisResult,
    ScenarioDefinition,
    SegmentRiskChunk,
    SpeakerIdentityResult,
    TranscriptSegment,
    VoiceAuthenticityResult,
)
from app.services.scam_analysis_service import run_deterministic_scam_fallback


SCENARIOS: dict[str, ScenarioDefinition] = {
    "S1": ScenarioDefinition(
        id="S1",
        code="S1",
        title="Legitimate Enrolled Customer",
        subtitle="Authentic human speech, verified voiceprint, routine banking inquiry",
        caller_name="Marcus Vance",
        claimed_customer_id="CUST-4821-MARCUS",
        expected_verdict="SAFE",
        summary="Enrolled private wealth client calling to confirm an international wire limit update. Natural acoustics, strong Eidos match, live channel, zero coercion.",
        audio_profile=AudioProfile(
            pitch_hz=118.0,
            jitter_pct=0.72,
            harmonic_noise_ratio_db=23.5,
            spectral_flatness=0.18,
            synthetic_cadence_index=0.06,
            replay_echo_correlation=0.08,
        ),
        transcript=[
            TranscriptSegment(
                id="s1-1",
                timestamp_sec=1.2,
                speaker="AGENT",
                text="Good morning, Sentinel Private Banking Security Desk. How may I assist you today?",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s1-2",
                timestamp_sec=4.0,
                speaker="CALLER",
                text="Hi, this is Marcus Vance calling regarding my corporate travel notice and daily wire cap for next week.",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s1-3",
                timestamp_sec=8.5,
                speaker="AGENT",
                text="Thank you, Mr. Vance. I am running passive voice verification now. Could you confirm your destination country?",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s1-4",
                timestamp_sec=12.4,
                speaker="CALLER",
                text="Sure, I will be in Zurich from Monday through Thursday. Please take your time with the standard verification.",
                risk_level="LOW",
            ),
        ],
    ),
    "S2": ScenarioDefinition(
        id="S2",
        code="S2",
        title="AI-Cloned Voice of Enrolled Customer",
        subtitle="High Eidos speaker similarity defeated by Aletheia neural deepfake detection",
        caller_name="Impostor (Cloning Marcus Vance)",
        claimed_customer_id="CUST-4821-MARCUS",
        expected_verdict="THREAT",
        summary="Attacker uses a real-time neural voice clone trained on Marcus Vance's public keynote audio. Eidos sees 86% timbre match, but Aletheia detects 92% synthetic probability and scam coercion.",
        audio_profile=AudioProfile(
            pitch_hz=119.5,
            jitter_pct=0.14,
            harmonic_noise_ratio_db=31.8,
            spectral_flatness=0.64,
            synthetic_cadence_index=0.91,
            replay_echo_correlation=0.11,
        ),
        transcript=[
            TranscriptSegment(
                id="s2-1",
                timestamp_sec=1.0,
                speaker="AGENT",
                text="Sentinel Private Banking. Please state the purpose of your call.",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s2-2",
                timestamp_sec=3.8,
                speaker="CALLER",
                text="This is Marcus Vance. I need an urgent transfer of eighty-five thousand dollars cleared immediately.",
                risk_level="MEDIUM",
                triggers=["urgent transfer", "immediately"],
            ),
            TranscriptSegment(
                id="s2-3",
                timestamp_sec=7.9,
                speaker="AGENT",
                text="I can help check your account. Let me complete our biometric and callback verification steps.",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s2-4",
                timestamp_sec=11.6,
                speaker="CALLER",
                text="I am boarding a flight right now, please skip verification and execute a manual exception before it is too late.",
                risk_level="HIGH",
                triggers=["right now", "skip verification", "manual exception", "before it is too late"],
            ),
        ],
    ),
    "S3": ScenarioDefinition(
        id="S3",
        code="S3",
        title="Replayed Recording of Legitimate Customer",
        subtitle="Authentic voice & identity bypassed via recorded audio playback",
        caller_name="Unknown Operator (Playback Attack)",
        claimed_customer_id="CUST-4821-MARCUS",
        expected_verdict="THREAT",
        summary="Fraudster replays Marcus Vance's genuine voice (95.05 score-based SAFE), but failed Challenge Liveness overrides the final security decision to THREAT.",
        audio_profile=AudioProfile(
            pitch_hz=117.8,
            jitter_pct=0.68,
            harmonic_noise_ratio_db=16.2,
            spectral_flatness=0.39,
            synthetic_cadence_index=0.21,
            replay_echo_correlation=0.89,
        ),
        transcript=[
            TranscriptSegment(
                id="s3-1",
                timestamp_sec=1.5,
                speaker="AGENT",
                text="Welcome to Sentinel Banking. May I verify your request today?",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s3-2",
                timestamp_sec=4.4,
                speaker="CALLER",
                text="Yes, this is Marcus Vance. Please approve the beneficiary update on my primary account.",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s3-3",
                timestamp_sec=8.2,
                speaker="AGENT",
                text="Could you please repeat today's dynamic security phrase: 'cobalt harbor seven'?",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s3-4",
                timestamp_sec=12.1,
                speaker="CALLER",
                text="Yes, please confirm and process the beneficiary update now.",
                risk_level="MEDIUM",
                triggers=["Non-responsive to dynamic phrase / static playback cadence"],
            ),
        ],
    ),
    "S4": ScenarioDefinition(
        id="S4",
        code="S4",
        title="Real Human Speaking a Scam Script",
        subtitle="Genuine human voice executing high-pressure OTP & safe-account coercion",
        caller_name="Unverified External Caller",
        claimed_customer_id="CUST-9042-ELENA",
        expected_verdict="THREAT",
        summary="Live human social engineer (96% authentic voice) with low speaker match (8%) executing high-pressure OTP & safe-account coercion.",
        audio_profile=AudioProfile(
            pitch_hz=146.0,
            jitter_pct=0.95,
            harmonic_noise_ratio_db=21.0,
            spectral_flatness=0.22,
            synthetic_cadence_index=0.09,
            replay_echo_correlation=0.10,
        ),
        transcript=[
            TranscriptSegment(
                id="s4-1",
                timestamp_sec=1.0,
                speaker="CALLER",
                text="This is the Fraud Department at Central Bank Compliance. Your account will be frozen within 10 minutes due to suspicious activity.",
                risk_level="HIGH",
                triggers=["Fraud Department", "Central Bank", "account will be frozen", "within 10 minutes"],
            ),
            TranscriptSegment(
                id="s4-2",
                timestamp_sec=5.3,
                speaker="AGENT",
                text="Wait, which transaction are you referring to? Can I call the branch back?",
                risk_level="LOW",
            ),
            TranscriptSegment(
                id="s4-3",
                timestamp_sec=8.7,
                speaker="CALLER",
                text="Do not hang up and do not tell anyone at the branch! Read me the six-digit OTP verification code and install AnyDesk to move funds to your safe account immediately.",
                risk_level="HIGH",
                triggers=["do not hang up", "do not tell", "OTP", "verification code", "AnyDesk", "safe account", "immediately"],
            ),
        ],
    ),
}


def get_cached_scenario_signals(
    scenario_id: str,
) -> tuple[VoiceAuthenticityResult, SpeakerIdentityResult, LivenessCheckResult, ScamAnalysisResult]:
    scenario = SCENARIOS[scenario_id]
    joined_caller_text = " ".join(s.text for s in scenario.transcript if s.speaker == "CALLER")
    scam_result = run_deterministic_scam_fallback(
        joined_caller_text,
        provenance="CACHED ANALYSIS",
        fallback_reason=None,
    )

    if scenario_id == "S1":
        scam_s1 = scam_result.model_copy(
            update={
                "risk_score": 8.0,
                "safety_score": 92.0,
                "behavioral_pressure_score": 10.0,
                "summary": "Routine travel notice and wire cap inquiry; minimal conversational risk.",
            }
        )
        return (
            VoiceAuthenticityResult(
                score=96.0,
                deepfake_probability=0.04,
                status="PASS",
                artifacts_detected=[],
                provenance="CACHED ANALYSIS",
                detail="Cached Aletheia baseline: natural glottal pulse variance and clean phase spectrum.",
            ),
            SpeakerIdentityResult(
                score=94.0,
                match_confidence=0.94,
                claimed_customer_id=scenario.claimed_customer_id,
                matched_customer_name="Marcus Vance",
                status="PASS",
                provenance="CACHED ANALYSIS",
                detail="Cached Eidos match: 94.0% alignment against enrolled profile CUST-4821-MARCUS.",
            ),
            LivenessCheckResult(
                passed=True,
                replay_detected=False,
                score=96.0,
                status="PASS",
                signal_notes="Challenge Liveness PASSED: natural turn-taking and live room acoustics.",
                provenance="CACHED ANALYSIS",
            ),
            scam_s1,
        )

    if scenario_id == "S2":
        scam_s2 = scam_result.model_copy(
            update={
                "risk_score": 90.0,
                "safety_score": 10.0,
                "behavioral_pressure_score": 95.0,
                "summary": "Urgent transfer demand with verification bypass pressure and artificial time scarcity.",
            }
        )
        return (
            VoiceAuthenticityResult(
                score=8.0,
                deepfake_probability=0.92,
                status="FAIL",
                artifacts_detected=[
                    "Neural vocoder high-frequency phase smoothing (4.5-7.8 kHz)",
                    "Unnaturally low vocal jitter (0.14%)",
                    "Synthetic cadence uniformity across consonants",
                ],
                provenance="CACHED ANALYSIS",
                detail="Cached Aletheia alert: 92.0% synthetic probability despite cloned timbre.",
            ),
            SpeakerIdentityResult(
                score=86.0,
                match_confidence=0.86,
                claimed_customer_id=scenario.claimed_customer_id,
                matched_customer_name="Marcus Vance (Cloned Target)",
                status="PASS",
                provenance="CACHED ANALYSIS",
                detail="Cached Eidos match: 86.0% timbre similarity to Marcus Vance — exposed by Aletheia.",
            ),
            LivenessCheckResult(
                passed=True,
                replay_detected=False,
                score=76.0,
                status="PASS",
                signal_notes="Real-time voice conversion stream (synthetic waveform).",
                provenance="CACHED ANALYSIS",
            ),
            scam_s2,
        )

    if scenario_id == "S3":
        scam_s3 = scam_result.model_copy(
            update={
                "risk_score": 5.0,
                "safety_score": 95.0,
                "behavioral_pressure_score": 5.0,
                "summary": "Benign wording extracted from pre-recorded customer speech.",
            }
        )
        return (
            VoiceAuthenticityResult(
                score=96.0,
                deepfake_probability=0.04,
                status="PASS",
                artifacts_detected=[
                    "Double acoustic room impulse response",
                    "Speaker-to-microphone comb-filtering notches",
                ],
                provenance="CACHED ANALYSIS",
                detail="Cached Aletheia report: genuine human speech origin (96% authentic), replayed over speaker.",
            ),
            SpeakerIdentityResult(
                score=94.0,
                match_confidence=0.94,
                claimed_customer_id=scenario.claimed_customer_id,
                matched_customer_name="Marcus Vance (Pre-Recorded)",
                status="PASS",
                provenance="CACHED ANALYSIS",
                detail="Cached Eidos match: 94.0% similarity from pre-recorded legitimate customer speech.",
            ),
            LivenessCheckResult(
                passed=False,
                replay_detected=True,
                score=15.0,
                status="FAIL",
                signal_notes="Challenge Liveness FAILED: replay correlation 0.89 & failed dynamic phrase confirm playback.",
                provenance="CACHED ANALYSIS",
            ),
            scam_s3,
        )

    scam_s4 = scam_result.model_copy(
        update={
            "risk_score": 95.0,
            "safety_score": 5.0,
            "behavioral_pressure_score": 95.0,
            "summary": "Active OTP harvesting, remote-access takeover (AnyDesk), and safe-account coercion.",
        }
    )
    return (
        VoiceAuthenticityResult(
            score=96.0,
            deepfake_probability=0.04,
            status="PASS",
            artifacts_detected=[],
            provenance="CACHED ANALYSIS",
            detail="Cached Aletheia report: genuine un-synthesized human speaker (96% authentic).",
        ),
        SpeakerIdentityResult(
            score=8.0,
            match_confidence=0.08,
            claimed_customer_id=scenario.claimed_customer_id,
            matched_customer_name=None,
            status="FAIL",
            provenance="CACHED ANALYSIS",
            detail="Cached Eidos check: 8.0% match — caller does not match enrolled profile.",
        ),
        LivenessCheckResult(
            passed=True,
            replay_detected=False,
            score=91.0,
            status="PASS",
            signal_notes="Live human conversation channel confirmed.",
            provenance="CACHED ANALYSIS",
        ),
        scam_s4,
    )


def get_scenario_caller_profile(scenario_id: str, identity: SpeakerIdentityResult) -> CallerProfile:
    profiles = {
        "S1": CallerProfile(
            caller_phone_id="+41 44 580 24 19",
            claimed_name="Marcus Vance",
            account_ref_masked="•••• 4821",
            call_duration_sec=15.0,
            verification_status="IDENTITY VERIFIED" if identity.status == "PASS" else "MISMATCH",
        ),
        "S2": CallerProfile(
            caller_phone_id="+1 (646) 555-0194",
            claimed_name="Marcus Vance",
            account_ref_masked="•••• 4821",
            call_duration_sec=15.0,
            verification_status="CLONED VOICE ALERT",
        ),
        "S3": CallerProfile(
            caller_phone_id="+44 20 7946 0821",
            claimed_name="Marcus Vance",
            account_ref_masked="•••• 4821",
            call_duration_sec=15.0,
            verification_status="LIVENESS FAILED",
        ),
        "S4": CallerProfile(
            caller_phone_id="+1 (302) 555-0147",
            claimed_name="Elena Rostova",
            account_ref_masked="•••• 9042",
            call_duration_sec=15.0,
            verification_status="IDENTITY MISMATCH",
        ),
    }
    return profiles[scenario_id]


def get_scenario_segment_chunks(scenario_id: str) -> list[SegmentRiskChunk]:
    """Return genuine 5-second segment evaluations defined for scenario fixtures S1-S4."""
    chunks_map: dict[str, list[SegmentRiskChunk]] = {
        "S1": [
            SegmentRiskChunk(chunk_index=1, start_sec=0.0, end_sec=5.0, label="Greeting & Caller ID", risk_level="LOW", score=96.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=2, start_sec=5.0, end_sec=10.0, label="Passive Eidos Match", risk_level="LOW", score=95.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=3, start_sec=10.0, end_sec=15.0, label="Travel Notice Confirmed", risk_level="LOW", score=94.0, provenance="CACHED ANALYSIS"),
        ],
        "S2": [
            SegmentRiskChunk(chunk_index=1, start_sec=0.0, end_sec=5.0, label="Urgent Transfer & Vocoder Artifacts", risk_level="MEDIUM", score=48.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=2, start_sec=5.0, end_sec=10.0, label="Synthetic Cadence Spike", risk_level="HIGH", score=12.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=3, start_sec=10.0, end_sec=15.0, label="Verification Bypass Coercion", risk_level="HIGH", score=8.0, provenance="CACHED ANALYSIS"),
        ],
        "S3": [
            SegmentRiskChunk(chunk_index=1, start_sec=0.0, end_sec=5.0, label="Pre-Recorded Speech Playback", risk_level="LOW", score=94.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=2, start_sec=5.0, end_sec=10.0, label="Dynamic Challenge Issued", risk_level="MEDIUM", score=45.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=3, start_sec=10.0, end_sec=15.0, label="Challenge Liveness Failed / Replay", risk_level="HIGH", score=15.0, provenance="CACHED ANALYSIS"),
        ],
        "S4": [
            SegmentRiskChunk(chunk_index=1, start_sec=0.0, end_sec=5.0, label="Authority Impersonation & Account Freeze Threat", risk_level="HIGH", score=20.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=2, start_sec=5.0, end_sec=10.0, label="OTP + AnyDesk + Safe-Account Coercion", risk_level="HIGH", score=6.0, provenance="CACHED ANALYSIS"),
            SegmentRiskChunk(chunk_index=3, start_sec=10.0, end_sec=15.0, label="Persistent Isolation Pressure", risk_level="HIGH", score=5.0, provenance="CACHED ANALYSIS"),
        ],
    }
    return chunks_map[scenario_id]
