from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.trust_engine import calculate_trust_score, verdict_from_score


client = TestClient(app)


def test_phase3_scenario_s1_formula() -> None:
    res = calculate_trust_score(
        voice_authenticity=96,
        speaker_match=94,
        scam_risk_score=8,
        behavioral_pressure_score=10,
        liveness_passed=True,
    )
    assert res.composite_score == 93.70
    assert res.score_based_verdict == "SAFE"
    assert res.final_decision == "SAFE"
    assert res.liveness_override_applied is False


def test_phase3_scenario_s2_formula() -> None:
    res = calculate_trust_score(
        voice_authenticity=8,
        speaker_match=86,
        scam_risk_score=90,
        behavioral_pressure_score=95,
        liveness_passed=True,
    )
    assert res.composite_score == 31.35
    assert res.score_based_verdict == "THREAT"
    assert res.final_decision == "THREAT"


def test_phase3_scenario_s3_liveness_override_preserves_math_score() -> None:
    res = calculate_trust_score(
        voice_authenticity=96,
        speaker_match=94,
        scam_risk_score=5,
        behavioral_pressure_score=5,
        liveness_passed=False,
    )
    # Mathematical Trust Score must remain 95.05 (not modified)
    assert res.composite_score == 95.05
    assert res.score_based_verdict == "SAFE"
    assert res.liveness_status == "FAILED"
    assert res.liveness_override_applied is True
    assert res.final_decision == "THREAT"
    assert res.verdict == "THREAT"
    assert "cannot establish that the audio is live" in (res.policy_override_applied or "")


def test_phase3_scenario_s4_formula() -> None:
    res = calculate_trust_score(
        voice_authenticity=96,
        speaker_match=8,
        scam_risk_score=95,
        behavioral_pressure_score=95,
        liveness_passed=True,
    )
    assert res.composite_score == 37.75
    assert res.score_based_verdict == "THREAT"
    assert res.final_decision == "THREAT"


def test_synthetic_probability_unenrolled_and_clamping() -> None:
    res = calculate_trust_score(
        synthetic_probability=0.04,  # -> 96.0
        speaker_match=None,
        speaker_enrolled=False,      # -> neutral 50.0
        scam_risk_score=-20,         # clamped to 0 -> safety 100
        behavioral_pressure_score=140,  # clamped to 100 -> safety 0
        liveness_passed=True,
    )
    # 96*0.35 + 50*0.30 + 100*0.20 + 0*0.15 = 33.6 + 15.0 + 20.0 + 0 = 68.60
    assert res.composite_score == 68.60
    assert res.final_decision == "CAUTION"


def test_verdict_threshold_boundaries() -> None:
    assert verdict_from_score(100.0) == "SAFE"
    assert verdict_from_score(75.0) == "SAFE"
    assert verdict_from_score(74.99) == "CAUTION"
    assert verdict_from_score(40.0) == "CAUTION"
    assert verdict_from_score(39.99) == "THREAT"
    assert verdict_from_score(0.0) == "THREAT"


def test_explainability_fields_present_for_all_four_layers() -> None:
    res = calculate_trust_score(
        voice_authenticity=96,
        speaker_match=94,
        scam_risk_score=8,
        behavioral_pressure_score=10,
    )
    assert len(res.factor_contributions) == 4
    weights = [layer.weight for layer in res.factor_contributions]
    assert weights == [0.35, 0.30, 0.20, 0.15]
    assert sum(weights) == pytest.approx(1.0)

    for layer in res.factor_contributions:
        assert layer.layer_name
        assert layer.input_value is not None
        assert layer.formula
        assert layer.weighted_contribution >= 0
        assert layer.explanation
        assert len(layer.evidence) >= 1


def test_api_scenarios_return_exact_phase3_scores() -> None:
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": True})
    expected = {
        "S1": (93.70, "SAFE", "SAFE"),
        "S2": (31.35, "THREAT", "THREAT"),
        "S3": (95.05, "SAFE", "THREAT"),
        "S4": (37.75, "THREAT", "THREAT"),
    }
    for sid, (score, score_verdict, final_verdict) in expected.items():
        r = client.post("/api/scenarios/run", json={"scenario_id": sid})
        assert r.status_code == 200
        tb = r.json()["trust_breakdown"]
        assert tb["composite_score"] == score
        assert tb["score_based_verdict"] == score_verdict
        assert tb["final_decision"] == final_verdict
