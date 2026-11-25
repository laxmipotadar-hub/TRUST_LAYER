from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_human_takeover_updates_timeline_and_call_report() -> None:
    s2 = client.post("/api/scenarios/run", json={"scenario_id": "S2"}).json()
    call_id = s2["call_id"]
    initial_events = len(s2["evidence_timeline"])

    act = client.post(
        f"/api/calls/{call_id}/action",
        json={
            "action": "TRANSFER_TO_HUMAN",
            "operator_note": "Bot Guard activated on S2 clone; transferring to fraud officer.",
        },
    )
    assert act.status_code == 200

    updated_call = client.get(f"/api/calls/{call_id}").json()
    assert len(updated_call["evidence_timeline"]) == initial_events + 1
    assert updated_call["evidence_timeline"][-1]["title"] == "HUMAN TAKEOVER: TRANSFERRED TO HUMAN"

    report = client.get(f"/api/calls/{call_id}/report").json()
    assert report["human_takeover_recorded"] is True
    assert any(a["action"] == "TRANSFER_TO_HUMAN" for a in report["operator_actions"])
    assert "TRANSFER_TO_HUMAN" in report["executive_summary"]
