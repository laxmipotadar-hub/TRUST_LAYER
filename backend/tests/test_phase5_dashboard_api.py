from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_bot_guard_settings_persistence() -> None:
    r = client.post(
        "/api/settings",
        json={"bot_guard_enabled": False, "bot_guard_threshold": 65},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["bot_guard_enabled"] is False
    assert body["bot_guard_threshold"] == 65

    # Restore defaults
    r2 = client.post(
        "/api/settings",
        json={"bot_guard_enabled": True, "bot_guard_threshold": 40},
    )
    assert r2.status_code == 200
    assert r2.json()["bot_guard_enabled"] is True


def test_dashboard_three_panel_payload_and_actions() -> None:
    r = client.post("/api/scenarios/run", json={"scenario_id": "S4"})
    assert r.status_code == 200
    call = r.json()
    call_id = call["call_id"]

    assert call["caller_profile"] is not None
    assert call["caller_profile"]["account_ref_masked"].startswith("••••")
    assert len(call["segment_chunks"]) == 3
    assert call["segment_chunks"][0]["start_sec"] == 0.0
    assert call["segment_chunks"][0]["end_sec"] == 5.0

    # Ensure flagged phrases appear inside transcript text for inline highlighting
    joined_transcript = " ".join(seg["text"] for seg in call["transcript"]).lower()
    flagged = call["scam_analysis"]["flagged_phrases"]
    assert len(flagged) >= 3
    for fp in flagged:
        assert fp["phrase"].lower() in joined_transcript

    for action in ("ALLOW", "CHALLENGE", "PAUSE_BOT", "TRANSFER_TO_HUMAN", "BLOCK_CALL"):
        act_r = client.post(
            f"/api/calls/{call_id}/action",
            json={"action": action, "operator_note": f"Phase 5 test {action}"},
        )
        assert act_r.status_code == 200
        assert act_r.json()["action_recorded"]["action"] == action
