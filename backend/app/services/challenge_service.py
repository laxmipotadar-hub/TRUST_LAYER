from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
import secrets
from uuid import uuid4

from app.repositories.json_store import repo
from app.schemas import (
    AnalysisProvenance,
    CallSession,
    ChallengeCheckItem,
    ChallengeSession,
    ChallengeStartRequest,
    ChallengeVerifyRequest,
    ChallengeVerifyResponse,
    EvidenceEvent,
    LivenessCheckResult,
)
from app.services.aletheia_service import detect_deepfake_aletheia
from app.services.eidos_service import verify_speaker_eidos
from app.services.trust_engine import build_evidence_timeline, compute_composite_trust


ADJECTIVES = [
    "cobalt", "silver", "violet", "amber", "crimson", "emerald", "granite", "scarlet",
    "copper", "indigo", "golden", "arctic", "obsidian", "saffron", "ivory", "azure",
]
NOUNS = [
    "mango", "river", "bridge", "harbor", "falcon", "cedar", "canyon", "summit",
    "beacon", "orchid", "anchor", "glacier", "lantern", "compass", "meadow", "quartz",
]
NUMBERS = [
    "three", "four", "five", "six", "seven", "eight", "nine", "eleven",
    "twelve", "fourteen", "fifteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty",
]

_LAST_PHRASE = ""


def generate_unpredictable_phrase() -> str:
    """Cryptographically random 3-token challenge phrase (4,096+ unique combinations)."""
    global _LAST_PHRASE
    for _ in range(8):
        phrase = (
            f"{secrets.choice(ADJECTIVES)} "
            f"{secrets.choice(NOUNS)} "
            f"{secrets.choice(NUMBERS)}"
        )
        if phrase != _LAST_PHRASE:
            _LAST_PHRASE = phrase
            return phrase
    return phrase


def start_challenge_session(payload: ChallengeStartRequest) -> ChallengeSession:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=payload.window_seconds)
    state = repo.get_settings_state()
    provenance: AnalysisProvenance = "SIMULATION" if state["app_mode"] == "DEMO" else "REAL ANALYSIS"

    session = ChallengeSession(
        challenge_id=f"CHL-{uuid4().hex[:8].upper()}",
        call_id=payload.call_id,
        customer_id=payload.customer_id,
        phrase=generate_unpredictable_phrase(),
        window_seconds=payload.window_seconds,
        created_at=now.isoformat(),
        expires_at=expires.isoformat(),
        status="PENDING",
        provenance=provenance,
    )
    return repo.save_challenge(session)


def _normalize_tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


async def verify_challenge_response(
    payload: ChallengeVerifyRequest,
    audio_bytes: bytes | None = None,
    filename: str = "challenge.wav",
) -> ChallengeVerifyResponse | None:
    challenge = repo.get_challenge(payload.challenge_id)
    if not challenge:
        return None

    state = repo.get_settings_state()
    app_mode = state["app_mode"]

    expected_words = _normalize_tokens(challenge.phrase)
    spoken_words = _normalize_tokens(payload.spoken_response)
    overlap = len(expected_words & spoken_words) / max(1, len(expected_words))

    # Check 1: Response received within challenge window
    window_ms = challenge.window_seconds * 1000
    within_window = (
        payload.capture_mode != "TIMEOUT"
        and 150 <= payload.response_latency_ms <= window_ms
        and bool(payload.spoken_response.strip())
    )

    # Check 2: Phrase matches the unpredictable nonce
    phrase_matched = overlap >= 0.66 and payload.capture_mode != "SIMULATED_REPLAY_FAIL"

    # Check 3: Live audio / speech capture verification (reject typed text as live proof!)
    is_simulated_mode = payload.capture_mode in ("SIMULATED_REPLAY_FAIL", "SIMULATED_LIVE_PASS", "TIMEOUT", "TEXT_INPUT")
    if payload.capture_mode == "TEXT_INPUT":
        audio_live_verified = False
        audio_detail = "Manually entered text cannot verify live microphone audio."
    elif payload.capture_mode == "SIMULATED_REPLAY_FAIL":
        audio_live_verified = False
        audio_detail = "Simulated replayed recording failed to reproduce unpredictable nonce."
    elif payload.capture_mode == "SIMULATED_LIVE_PASS":
        audio_live_verified = True
        audio_detail = "Simulated live speech pass (clearly marked SIMULATION)."
    elif payload.capture_mode == "TIMEOUT":
        audio_live_verified = False
        audio_detail = "Challenge response window expired without speech response."
    else:
        audio_live_verified = True
        audio_detail = (
            "Live microphone audio + speech captured."
            if (audio_bytes or payload.audio_captured)
            else "Live browser SpeechRecognition captured spoken response."
        )

    # Check 4 & 5: Aletheia & Eidos checks on challenge audio when in REAL mode with audio
    aletheia_ok = True
    aletheia_detail = "No synthetic artifacts flagged in challenge channel."
    eidos_ok = True
    eidos_detail = "Speaker identity consistent with claimed customer."

    if app_mode == "REAL" and audio_bytes:
        ale = await detect_deepfake_aletheia(audio_bytes, filename=filename)
        if ale.model_status in ("OK", "CACHED") and ale.result.score is not None:
            aletheia_ok = ale.result.score >= 60.0
            aletheia_detail = ale.result.detail
        else:
            aletheia_ok = False
            aletheia_detail = f"Aletheia check incomplete/unavailable ({ale.model_status})."

        eid = await verify_speaker_eidos(audio_bytes, challenge.customer_id, filename=filename)
        if eid.model_status in ("OK", "CACHED"):
            eidos_ok = (eid.result.score or 0.0) >= 65.0
            eidos_detail = eid.result.detail
        elif eid.model_status == "UNENROLLED":
            eidos_ok = True
            eidos_detail = "Customer unenrolled; Eidos neutral baseline applied."
        else:
            eidos_ok = False
            eidos_detail = f"Eidos verification incomplete ({eid.model_status})."
    elif payload.capture_mode == "SIMULATED_REPLAY_FAIL":
        aletheia_detail = "Aletheia saw human vocal origin (96%), masking replay risk."
        eidos_detail = "Eidos matched recorded customer timbre (94%), but failed dynamic nonce."

    checks = [
        ChallengeCheckItem(
            key="window",
            label="Response Within Challenge Window",
            passed=within_window,
            detail=(
                f"Received in {payload.response_latency_ms}ms (limit {window_ms}ms)."
                if within_window
                else "No valid spoken response within challenge window."
            ),
        ),
        ChallengeCheckItem(
            key="nonce",
            label="Unpredictable Phrase Match",
            passed=phrase_matched,
            detail=(
                f"Matched {int(overlap * 100)}% of nonce '{challenge.phrase}'."
                if phrase_matched
                else f"Expected '{challenge.phrase}', heard '{payload.spoken_response or '(silence)'}'."
            ),
        ),
        ChallengeCheckItem(
            key="audio_capture",
            label="Live Speech / Audio Verification",
            passed=audio_live_verified,
            detail=audio_detail,
        ),
        ChallengeCheckItem(
            key="aletheia",
            label="Aletheia Synthetic Voice Check",
            passed=aletheia_ok,
            detail=aletheia_detail,
        ),
        ChallengeCheckItem(
            key="eidos",
            label="Eidos Enrolled Speaker Check",
            passed=eidos_ok,
            detail=eidos_detail,
        ),
    ]

    passed = all(c.passed for c in checks)
    repo.update_challenge_status(challenge.challenge_id, "PASSED" if passed else "FAILED")

    provenance: AnalysisProvenance = (
        "SIMULATION"
        if is_simulated_mode or app_mode == "DEMO" or not audio_bytes
        else "REAL ANALYSIS"
    )

    if passed:
        notes = "All 5 Challenge Liveness checks passed within response window."
        explanation = "Live speaker repeated the unpredictable challenge phrase within human latency."
        banner_lines = ["CHALLENGE PASSED", "LIVE CALLER VERIFIED"]
    else:
        notes = "Challenge Liveness failed — potential replay attack or unverified response."
        explanation = (
            "The voice was authentic, and the identity matched. However, the caller failed the live "
            "challenge. A genuine voice recording is not proof of a live caller."
        )
        banner_lines = [
            "CHALLENGE FAILED",
            "POTENTIAL REPLAY ATTACK",
            "CALL TRUST REVOKED",
        ]

    # Update associated CallSession trust breakdown if call_id is present
    updated_call: CallSession | None = None
    if challenge.call_id:
        existing_call = repo.get_call(challenge.call_id)
        if existing_call:
            new_liveness = LivenessCheckResult(
                passed=passed,
                replay_detected=not passed,
                score=96.0 if passed else 12.0,
                status="PASS" if passed else "FAIL",
                signal_notes=notes,
                provenance=provenance,
            )
            new_trust = compute_composite_trust(
                existing_call.voice_authenticity,
                existing_call.speaker_identity,
                existing_call.scam_analysis,
                new_liveness,
            )
            new_timeline = build_evidence_timeline(
                existing_call.voice_authenticity,
                existing_call.speaker_identity,
                existing_call.scam_analysis,
                new_liveness,
                new_trust,
            )
            new_timeline.append(
                EvidenceEvent(
                    id=f"ev-chl-{uuid4().hex[:5]}",
                    timestamp_sec=13.5,
                    category="LIVENESS",
                    severity="INFO" if passed else "CRITICAL",
                    title="Challenge Liveness PASSED" if passed else "CHALLENGE FAILED · POTENTIAL REPLAY ATTACK",
                    description=explanation,
                    provenance=provenance,
                )
            )
            updated_call = existing_call.model_copy(
                update={
                    "call_state": "VERDICT",
                    "liveness": new_liveness,
                    "trust_breakdown": new_trust,
                    "trust_score": new_trust.composite_score,
                    "verdict": new_trust.final_decision,
                    "evidence_timeline": new_timeline,
                }
            )
            repo.update_call(updated_call)

    return ChallengeVerifyResponse(
        challenge_id=challenge.challenge_id,
        passed=passed,
        phrase_similarity=round(overlap, 2),
        liveness_status="PASS" if passed else "FAIL",
        capture_mode=payload.capture_mode,
        notes=notes,
        explanation=explanation,
        banner_lines=banner_lines,
        checks=checks,
        provenance=provenance,
        updated_call=updated_call,
    )
