from __future__ import annotations

import io
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.detectif.client import extract_detectifai_error
from app.main import app
from app.repositories.json_store import repo
from app.schemas import VoiceprintRecord
from app.services.cache_service import cache_service
from app.services.eidos_service import verify_speaker_eidos


client = TestClient(app)


def _make_wav_bytes(duration_sec: float = 5.0, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x10\x00" * int(duration_sec * sample_rate))
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    cache_service.clear()
    monkeypatch.setattr(settings, "detectif_api_key", "")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": False})
    yield
    cache_service.clear()


def test_bug1_aletheia_fake_skips_eidos_and_sets_end_call() -> None:
    wav_5s = _make_wav_bytes(5.0)
    ale_resp = MagicMock(status_code=200)
    ale_resp.raise_for_status = MagicMock()
    ale_resp.json.return_value = {
        "request_id": "req_fake_001",
        "operation_id": "op_fake_001",
        "credits_used": 24,
        "result": {
            "verdict": "fake",
            "score": 0.997,
            "duration_seconds": 5.0,
            "scored_seconds": 5.0,
            "segments": [{"start": 0.0, "end": 5.0, "score": 0.997, "verdict": "fake"}],
        },
    }

    called_urls: list[str] = []

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        return ale_resp

    unified_client = AsyncMock()
    unified_client.__aenter__.return_value = unified_client
    unified_client.post.side_effect = route_post

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_bug1_secret"),
        patch("httpx.AsyncClient", return_value=unified_client),
    ):
        resp = client.post(
            "/api/calls/analyze",
            files={"file": ("clone.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "Urgent transfer required.",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "execution_mode": "LIVE",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    session = body["session"]

    # Aletheia was called, Eidos was NEVER called
    assert any("deepfake/detect" in u for u in called_urls)
    assert not any("speakers/verify" in u for u in called_urls)
    assert body["model_status"]["eidos"] == "SKIPPED"
    assert session["speaker_identity"]["status"] == "skipped"
    assert session["speaker_identity"]["skip_reason"] == "aletheia_fake"
    assert session["speaker_identity"]["matched_customer_name"] is None
    assert body["credits_saved"] == 500.0
    assert body["decision"] == "END_CALL"
    assert body["verdict"] == "THREAT"
    assert body["decision_reason"] == "Possible synthetic speech - signal, not proof."
    assert session["trust_breakdown"]["conflict_overrides"] == []
    assert session["trust_breakdown"]["voice_clone_override_applied"] is False


@pytest.mark.anyio
async def test_bug2_eidos_http_errors_and_live_no_voice_id() -> None:
    wav_5s = _make_wav_bytes(5.0)

    # Verify HTTPStatusError redacts API key and surfaces HTTP status + provider message
    for code, expected_fragment in [
        (403, "HTTP 403"),
        (404, "HTTP 404"),
        (402, "HTTP 402"),
        (502, "HTTP 502"),
    ]:
        req = httpx.Request("POST", "https://platform.detectif.ai/v1/speakers/verify")
        fake_resp = httpx.Response(
            code,
            request=req,
            json={"error": {"message": f"Provider detail for {code} with Bearer secret123"}},
        )
        exc = httpx.HTTPStatusError("HTTP err", request=req, response=fake_resp)
        info = extract_detectifai_error(exc, service_label="DetectifAI Eidos", speaker_ref="spk-test")
        assert expected_fragment in info.detail
        assert f"Provider detail for {code}" in info.detail
        assert "secret123" not in info.detail

    # Verify Eidos 404 / 403 through verify_speaker_eidos does not return matched_customer_name
    resp_403 = httpx.Response(
        403,
        request=httpx.Request("POST", "https://platform.detectif.ai/v1/speakers/verify"),
        json={"error": {"message": "Missing scope speakers:verify"}},
    )
    mock_eid = AsyncMock()
    mock_eid.__aenter__.return_value = mock_eid
    mock_eid.post.return_value = resp_403
    with (
        patch.object(settings, "detectif_api_key", "dtf_test_key_hidden"),
        patch("app.services.eidos_service.httpx.AsyncClient", return_value=mock_eid),
    ):
        res = await verify_speaker_eidos(wav_5s, "CUST-4821-MARCUS", bypass_cache=True)
        assert res.model_status == "AUTH_ERROR"
        assert res.result.status == "error"
        assert res.result.http_status == 403
        assert "Missing scope speakers:verify" in res.result.detail
        assert res.result.matched_customer_name is None
        assert "dtf_test_key_hidden" not in res.result.detail

    # In LIVE mode, a seeded-only customer without REAL ANALYSIS enrollment is skipped as no_voice_id
    ale_real_resp = MagicMock(status_code=200)
    ale_real_resp.raise_for_status = MagicMock()
    ale_real_resp.json.return_value = {
        "request_id": "req_real_001",
        "result": {"verdict": "real", "score": 0.04, "segments": []},
    }
    mock_ale = AsyncMock()
    mock_ale.__aenter__.return_value = mock_ale
    mock_ale.post.return_value = ale_real_resp
    with (
        patch.object(settings, "detectif_api_key", "dtf_test_key_hidden"),
        patch("app.services.aletheia_service.httpx.AsyncClient", return_value=mock_ale),
    ):
        live_res = client.post(
            "/api/calls/analyze",
            files={"file": ("live.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "Checking my account status.",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "execution_mode": "LIVE",
            },
        )
    assert live_res.status_code == 200
    data = live_res.json()
    eidos = data["session"]["speaker_identity"]
    assert eidos["status"] == "skipped"
    assert eidos["skip_reason"] == "no_voice_id"
    assert eidos["similarity_tier"] == "unavailable"
    assert eidos["matched_customer_name"] is None
    assert data["decision"] == "STEP_UP"
    assert data["decision_reason"] == "Voice match unavailable. Enroll a live Voice ID first."


def test_bug4_liveness_incomplete_vs_replay_copy() -> None:
    client.post("/api/settings", json={"app_mode": "REAL"})

    # 1) <4s audio -> incomplete (audio_too_short), NEVER false replay explanation
    ch1 = client.post("/api/challenge/start", json={"customer_id": "CUST-4821-MARCUS"}).json()
    short_wav = _make_wav_bytes(2.0)
    r1 = client.post(
        "/api/challenge/verify-audio",
        files={"file": ("short.wav", short_wav, "audio/wav")},
        data={
            "challenge_id": ch1["challenge_id"],
            "spoken_response": ch1["phrase"],
            "response_latency_ms": "1500",
            "capture_mode": "LIVE_SPEECH_AUDIO",
        },
    )
    assert r1.status_code == 200
    b1 = r1.json()
    assert b1["status"] == "incomplete"
    assert b1["reason"] == "audio_too_short"
    assert b1["liveness_status"] == "INCOMPLETE"
    assert "A genuine voice recording is not proof of a live caller" not in b1["explanation"]

    # 2) Aletheia unavailable (missing key in REAL mode on >4s clip) -> incomplete (aletheia_unavailable)
    ch2 = client.post("/api/challenge/start", json={"customer_id": "CUST-4821-MARCUS"}).json()
    wav_5s = _make_wav_bytes(5.0)
    r2 = client.post(
        "/api/challenge/verify-audio",
        files={"file": ("clip.wav", wav_5s, "audio/wav")},
        data={
            "challenge_id": ch2["challenge_id"],
            "spoken_response": ch2["phrase"],
            "response_latency_ms": "2000",
            "capture_mode": "LIVE_SPEECH_AUDIO",
        },
    )
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["status"] == "incomplete"
    assert b2["reason"] == "aletheia_unavailable"
    assert b2["liveness_status"] == "INCOMPLETE"
    assert "A genuine voice recording is not proof of a live caller" not in b2["explanation"]

    # 3) Aletheia real + Eidos match + phrase_mismatch -> replay-attack copy IS used
    live_cust_id = "CUST-LIVE-CHALLENGE-BUG4"
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id="VP-LIVE-BUG4",
            customer_id=live_cust_id,
            customer_name="Live Challenge Tester",
            account_tier="Private Wealth",
            consent_confirmed=True,
            consent_timestamp="2026-11-25T10:00:00Z",
            enrolled_at="2026-11-25T10:00:00Z",
            sample_duration_sec=10.0,
            enrollment_source="REAL ANALYSIS",
            provider_speaker_ref="live-spk-bug4",
            status="ACTIVE",
        )
    )
    ale_ok = MagicMock(status_code=200)
    ale_ok.raise_for_status = MagicMock()
    ale_ok.json.return_value = {"request_id": "req_a", "result": {"verdict": "real", "score": 0.05, "segments": []}}
    eid_ok = MagicMock(status_code=200)
    eid_ok.raise_for_status = MagicMock()
    eid_ok.json.return_value = {"request_id": "req_e", "result": {"decision": "match", "similarity": 0.92}}

    async def route_post(url: str, **kwargs):
        return ale_ok if "deepfake" in url else eid_ok

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.side_effect = route_post

    ch3 = client.post("/api/challenge/start", json={"customer_id": live_cust_id}).json()
    with (
        patch.object(settings, "detectif_api_key", "dtf_test_bug4"),
        patch("app.services.aletheia_service.httpx.AsyncClient", return_value=mc),
        patch("app.services.eidos_service.httpx.AsyncClient", return_value=mc),
    ):
        r3 = client.post(
            "/api/challenge/verify-audio",
            files={"file": ("replay.wav", wav_5s, "audio/wav")},
            data={
                "challenge_id": ch3["challenge_id"],
                "spoken_response": "wrong unrelated sentence",
                "response_latency_ms": "1500",
                "capture_mode": "LIVE_SPEECH_AUDIO",
            },
        )
    assert r3.status_code == 200
    b3 = r3.json()
    assert b3["status"] == "failed"
    assert b3["reason"] == "phrase_mismatch"
    assert "A genuine voice recording is not proof of a live caller" in b3["explanation"]


def test_bug5_live_no_simulation_tags_and_empty_transcript_unavailable() -> None:
    wav_5s = _make_wav_bytes(5.0)
    ale_ok = MagicMock(status_code=200)
    ale_ok.raise_for_status = MagicMock()
    ale_ok.json.return_value = {"request_id": "req_bug5", "result": {"verdict": "real", "score": 0.03, "segments": []}}

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.return_value = ale_ok

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_bug5"),
        patch("app.services.aletheia_service.httpx.AsyncClient", return_value=mc),
    ):
        resp = client.post(
            "/api/calls/analyze",
            files={"file": ("notext.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "execution_mode": "LIVE",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    session = body["session"]

    # Never tag anything in LIVE mode as SIMULATION
    assert session["overall_provenance"] != "SIMULATION"
    assert all(ev["provenance"] != "SIMULATION" for ev in session["evidence_timeline"])

    # Empty transcript -> L3 and L4 unavailable with None scores & 0.0 weighted contribution
    assert body["model_status"]["scam_analysis"] == "UNAVAILABLE"
    assert body["model_status"]["manipulation"] == "UNAVAILABLE"
    assert session["scam_analysis"]["status"] == "UNAVAILABLE"
    assert session["scam_analysis"]["risk_score"] is None
    assert session["scam_analysis"]["safety_score"] is None
    assert session["manipulation_analysis"]["status"] == "UNAVAILABLE"
    assert session["manipulation_analysis"]["score"] is None
    assert session["manipulation_analysis"]["safety_score"] is None

    l3_contrib = next(
        fc for fc in session["trust_breakdown"]["factor_contributions"] if fc["key"] == "scam_safety"
    )
    l4_contrib = next(
        fc for fc in session["trust_breakdown"]["factor_contributions"] if fc["key"] == "behavioral_safety"
    )
    assert l3_contrib["raw_score"] is None
    assert l3_contrib["weighted_points"] == 0.0
    assert l4_contrib["raw_score"] is None
    assert l4_contrib["weighted_points"] == 0.0
