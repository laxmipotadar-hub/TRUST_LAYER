from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_unauthorized_threat_submission_rejected() -> None:
    r = client.post(
        "/api/threat-registry",
        json={
            "pattern_name": "Unauthorized Probe",
            "raw_speaker_reference": "CUST-SECRET-PII",
            "category": "Replay Attack",
            "severity": "HIGH",
            "operator_authorized": False,
        },
    )
    assert r.status_code == 403


def test_authorized_threat_submission_anonymizes_speaker_and_updates_status() -> None:
    raw_ref = "CUST-4821-MARCUS-VOICE-SAMPLE"
    r = client.post(
        "/api/threat-registry",
        json={
            "pattern_name": "Synthetic Keynote Clone Probe",
            "raw_speaker_reference": raw_ref,
            "category": "AI Voice Synthesis",
            "severity": "CRITICAL",
            "evidence_reference": "CALL-TEST-991",
            "indicators": ["vocoder artifact", "manual exception"],
            "operator_authorized": True,
        },
    )
    assert r.status_code == 200
    entry = r.json()
    entry_id = entry["entry_id"]

    # Raw PII / speaker ref must never be stored in anonymous_speaker_ref
    assert entry["anonymous_speaker_ref"].startswith("anon-spk-")
    assert raw_ref not in entry["anonymous_speaker_ref"]
    assert entry["verification_status"] == "PENDING REVIEW"

    # Category filter
    filtered = client.get("/api/threat-registry?category=AI%20Voice%20Synthesis")
    assert filtered.status_code == 200
    assert any(item["entry_id"] == entry_id for item in filtered.json()["entries"])

    # Status update
    patched = client.patch(
        f"/api/threat-registry/{entry_id}",
        json={"verification_status": "CONFIRMED THREAT"},
    )
    assert patched.status_code == 200
    assert patched.json()["verification_status"] == "CONFIRMED THREAT"
