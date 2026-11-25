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


def setup_function() -> None:
    client.post("/api/settings", json={"app_mode": "DEMO"})


def test_consent_required_for_enrollment() -> None:
    r_json = client.post(
        "/api/voiceprints/enroll",
        json={
            "customer_id": "CUST-NOCONSENT-1",
            "customer_name": "No Consent User",
            "consent_confirmed": False,
        },
    )
    assert r_json.status_code == 400

    wav = _make_wav_bytes()
    r_audio = client.post(
        "/api/voiceprints/enroll-audio",
        files={"file": ("sample.wav", wav, "audio/wav")},
        data={
            "customer_id": "CUST-NOCONSENT-2",
            "customer_name": "No Consent Audio",
            "consent_confirmed": "false",
        },
    )
    assert r_audio.status_code == 400


def test_consent_enrollment_verification_history_and_revocation() -> None:
    wav = _make_wav_bytes()
    enr = client.post(
        "/api/voiceprints/enroll-audio",
        files={"file": ("clara.wav", wav, "audio/wav")},
        data={
            "customer_id": "CUST-8888-CLARA",
            "customer_name": "Clara Sterling",
            "account_tier": "Private Banking",
            "enrollment_purpose": "Wire Fraud Prevention",
            "consent_confirmed": "true",
            "sample_duration_sec": "5.0",
        },
    )
    assert enr.status_code == 200
    vp = enr.json()
    vp_id = vp["voiceprint_id"]
    assert vp["consent_confirmed"] is True
    assert vp["enrollment_purpose"] == "Wire Fraud Prevention"
    assert vp["provider_speaker_ref"] is not None

    # Verify match + mismatch and confirm history & counters update
    ver_ok = client.post(
        "/api/voiceprints/verify",
        files={"file": ("probe.wav", wav, "audio/wav")},
        data={"claimed_customer_id": "CUST-8888-CLARA", "simulate_outcome": "match"},
    )
    assert ver_ok.status_code == 200
    assert ver_ok.json()["verification_result"] == "VERIFIED"
    assert ver_ok.json()["verified_identity"] == "Clara Sterling"

    ver_bad = client.post(
        "/api/voiceprints/verify",
        files={"file": ("probe.wav", wav, "audio/wav")},
        data={"claimed_customer_id": "CUST-8888-CLARA", "simulate_outcome": "mismatch"},
    )
    assert ver_bad.status_code == 200
    assert ver_bad.json()["verification_result"] == "MISMATCH"

    listed = client.get("/api/voiceprints").json()
    match_rec = next(item for item in listed if item["voiceprint_id"] == vp_id)
    assert match_rec["verification_count"] == 2
    assert match_rec["mismatch_count"] == 1
    assert len(match_rec["verification_history"]) == 2

    # Revoke enrollment
    rev = client.post(f"/api/voiceprints/{vp_id}/revoke")
    assert rev.status_code == 200
    assert rev.json()["status"] == "REVOKED"
    assert rev.json()["revoked_at"] is not None

    # Verification after revocation treats profile as unenrolled (neutral 50.0)
    post_rev = client.post(
        "/api/voiceprints/verify",
        data={"claimed_customer_id": "CUST-8888-CLARA"},
    )
    assert post_rev.status_code == 200
    assert post_rev.json()["match_percentage"] == 50.0
    assert post_rev.json()["verification_result"] == "UNVERIFIED"

    # Cleanup test record
    client.delete(f"/api/voiceprints/{vp_id}")
