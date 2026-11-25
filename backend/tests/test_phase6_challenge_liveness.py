from __future__ import annotations

import io
import wave
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _make_wav_bytes(duration_sec: float = 4.5, sample_rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * int(duration_sec * sample_rate))
    return buf.getvalue()


def test_unpredictable_phrase_generation() -> None:
    phrases = []
    for _ in range(5):
        r = client.post("/api/challenge/start", json={"customer_id": "CUST-4821-MARCUS"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["phrase"].split()) == 3
        phrases.append(data["phrase"])
    assert len(set(phrases)) >= 4
    assert phrases[0] != phrases[1]


def test_typed_text_cannot_pass_live_challenge() -> None:
    start = client.post("/api/challenge/start", json={"customer_id": "CUST-4821-MARCUS"}).json()
    res = client.post(
        "/api/challenge/verify",
        json={
            "challenge_id": start["challenge_id"],
            "spoken_response": start["phrase"],
            "response_latency_ms": 1100,
            "capture_mode": "TEXT_INPUT",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["passed"] is False
    assert body["liveness_status"] == "FAIL"
    assert len(body["checks"]) == 5


def test_s3_replay_challenge_failure_overrides_to_threat() -> None:
    s3 = client.post("/api/scenarios/run", json={"scenario_id": "S3"}).json()
    call_id = s3["call_id"]

    start = client.post(
        "/api/challenge/start",
        json={"call_id": call_id, "customer_id": "CUST-4821-MARCUS", "window_seconds": 12},
    ).json()

    verify = client.post(
        "/api/challenge/verify",
        json={
            "challenge_id": start["challenge_id"],
            "spoken_response": "Yes, please confirm and process the beneficiary update now.",
            "response_latency_ms": 1600,
            "capture_mode": "SIMULATED_REPLAY_FAIL",
        },
    )
    assert verify.status_code == 200
    body = verify.json()
    assert body["passed"] is False
    assert body["banner_lines"] == [
        "CHALLENGE FAILED",
        "POTENTIAL REPLAY ATTACK",
        "CALL TRUST REVOKED",
    ]
    assert "A genuine voice recording is not proof of a live caller" in body["explanation"]

    updated = body["updated_call"]
    assert updated is not None
    assert updated["trust_breakdown"]["composite_score"] == 95.05
    assert updated["trust_breakdown"]["score_based_verdict"] == "SAFE"
    assert updated["trust_breakdown"]["final_decision"] == "THREAT"
    assert updated["trust_breakdown"]["liveness_override_applied"] is True


def test_challenge_timeout_fails_and_live_audio_endpoint_works() -> None:
    s1 = client.post("/api/scenarios/run", json={"scenario_id": "S1"}).json()
    ch = client.post(
        "/api/challenge/start",
        json={"call_id": s1["call_id"], "customer_id": "CUST-4821-MARCUS"},
    ).json()

    timeout_res = client.post(
        "/api/challenge/verify",
        json={
            "challenge_id": ch["challenge_id"],
            "spoken_response": "",
            "response_latency_ms": 12000,
            "capture_mode": "TIMEOUT",
        },
    ).json()
    assert timeout_res["passed"] is False
    assert timeout_res["updated_call"]["trust_breakdown"]["final_decision"] == "THREAT"

    # Now issue a fresh challenge and pass via multipart audio in DEMO mode
    ch2 = client.post(
        "/api/challenge/start",
        json={"call_id": s1["call_id"], "customer_id": "CUST-4821-MARCUS"},
    ).json()
    wav = _make_wav_bytes(4.5)
    pass_res = client.post(
        "/api/challenge/verify-audio",
        files={"file": ("challenge.wav", wav, "audio/wav")},
        data={
            "challenge_id": ch2["challenge_id"],
            "spoken_response": ch2["phrase"],
            "response_latency_ms": "1500",
            "capture_mode": "LIVE_SPEECH_AUDIO",
        },
    )
    assert pass_res.status_code == 200
    assert pass_res.json()["passed"] is True
    assert pass_res.json()["updated_call"]["trust_breakdown"]["final_decision"] == "SAFE"
