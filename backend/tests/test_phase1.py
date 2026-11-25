from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def setup_function() -> None:
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": True})


def test_health_and_settings() -> None:
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    body = r_health.json()
    assert body["status"] == "ok"
    assert body["app_mode"] == "DEMO"

    r_settings = client.get("/api/settings")
    assert r_settings.status_code == 200
    assert r_settings.json()["app_mode"] == "DEMO"

    r_update = client.post("/api/settings", json={"app_mode": "REAL"})
    assert r_update.status_code == 200
    assert r_update.json()["app_mode"] == "REAL"

    client.post("/api/settings", json={"app_mode": "DEMO"})


def test_scenarios_calls_actions_and_report() -> None:
    r_list = client.get("/api/scenarios")
    assert r_list.status_code == 200
    assert [s["id"] for s in r_list.json()] == ["S1", "S2", "S3", "S4"]

    expected = {"S1": "SAFE", "S2": "THREAT", "S3": "THREAT", "S4": "THREAT"}
    last_call_id = ""
    for sid, expected_verdict in expected.items():
        r_run = client.post("/api/scenarios/run", json={"scenario_id": sid})
        assert r_run.status_code == 200
        call_data = r_run.json()
        last_call_id = call_data["call_id"]
        assert call_data["trust_breakdown"]["verdict"] == expected_verdict
        assert call_data["overall_provenance"] == "CACHED ANALYSIS"

    r_cur = client.get("/api/calls/current")
    assert r_cur.status_code == 200
    assert r_cur.json()["call_id"] == last_call_id

    r_get = client.get(f"/api/calls/{last_call_id}")
    assert r_get.status_code == 200
    assert r_get.json()["call_id"] == last_call_id

    r_action = client.post(
        f"/api/calls/{last_call_id}/action",
        json={"action": "FREEZE_ACCOUNT", "operator_note": "Verified S4 block test"},
    )
    assert r_action.status_code == 200
    assert r_action.json()["action_recorded"]["action"] == "FREEZE_ACCOUNT"

    r_report = client.get(f"/api/calls/{last_call_id}/report")
    assert r_report.status_code == 200
    report = r_report.json()
    assert report["call_id"] == last_call_id
    assert "en" in report["multilingual_verdicts"]


def test_voiceprints_crud_and_challenge_flow() -> None:
    r_enroll = client.post(
        "/api/voiceprints/enroll",
        json={
            "customer_id": "CUST-7777-TEST",
            "customer_name": "Jordan Blake",
            "account_tier": "Retail Premier",
            "sample_duration_sec": 7.5,
        },
    )
    assert r_enroll.status_code == 200
    vp_id = r_enroll.json()["voiceprint_id"]

    r_list = client.get("/api/voiceprints")
    assert r_list.status_code == 200
    assert any(vp["voiceprint_id"] == vp_id for vp in r_list.json())

    r_del = client.delete(f"/api/voiceprints/{vp_id}")
    assert r_del.status_code == 200
    assert r_del.json()["deleted"] is True

    r_start = client.post("/api/challenge/start", json={"customer_id": "CUST-4821-MARCUS"})
    assert r_start.status_code == 200
    ch = r_start.json()

    r_verify = client.post(
        "/api/challenge/verify",
        json={
            "challenge_id": ch["challenge_id"],
            "spoken_response": ch["phrase"],
            "response_latency_ms": 1200,
        },
    )
    assert r_verify.status_code == 200
    assert r_verify.json()["passed"] is True


def test_threat_registry() -> None:
    r_reg = client.get("/api/threat-registry")
    assert r_reg.status_code == 200
    assert r_reg.json()["total"] >= 3
