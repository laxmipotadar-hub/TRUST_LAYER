from __future__ import annotations

from app.schemas.common import DEFAULT_LAYER_WEIGHTS
from app.services.trust_engine import _normalize_weights, calculate_trust_score


def test_part_a1_default_weights_and_legacy_remapping() -> None:
    assert DEFAULT_LAYER_WEIGHTS == {
        "voice_authenticity": 0.35,
        "speaker_identity": 0.30,
        "scam_safety": 0.20,
        "behavioral_safety": 0.15,
    }
    remapped = _normalize_weights(
        {
            "voice_authenticity": 0.35,
            "speaker_identity": 0.25,
            "scam_intent": 0.25,
            "behavioral_pressure": 0.15,
        }
    )
    assert remapped["scam_safety"] == 0.25
    assert remapped["behavioral_safety"] == 0.15


def test_part_a1_partial_score_labels_missing_layer_and_caps_at_step_up() -> None:
    # Even when available layers look spotless, missing L3/L4 must cap decision at STEP_UP and label Partial score
    res = calculate_trust_score(
        voice_authenticity=98.0,
        synthetic_probability=0.02,
        speaker_match=96.0,
        speaker_enrolled=True,
        scam_risk_score=None,
        behavioral_pressure_score=None,
        liveness_passed=True,
        liveness_available=True,
    )
    assert res.composite_score is not None
    assert res.decision == "STEP_UP"
    assert res.verdict == "CAUTION"
    assert res.decision != "ALLOW"
    assert "Partial score" in (res.decision_reason or "")
    assert "Layer 3 Script" in (res.decision_reason or "")
