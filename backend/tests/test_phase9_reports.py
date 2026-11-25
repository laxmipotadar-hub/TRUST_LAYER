from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_post_call_report_preserves_analysis_decisions_and_recommendations() -> None:
    s3 = client.post("/api/scenarios/run", json={"scenario_id": "S3"}).json()
    call_id = s3["call_id"]

    report_res = client.get(f"/api/calls/{call_id}/report")
    assert report_res.status_code == 200
    report = report_res.json()

    assert report["call_id"] == call_id
    assert report["composite_score"] == 95.05
    assert report["score_based_verdict"] == "SAFE"
    assert report["final_security_decision"] == "THREAT"
    assert report["verdict"] == "THREAT"
    assert len(report["recommendations"]) >= 3
    assert len(report["call_session"]["trust_breakdown"]["factor_contributions"]) == 4
    assert len(report["call_session"]["segment_chunks"]) == 3
    assert set(report["multilingual_verdicts"].keys()) == {"en", "es", "fr", "de"}
