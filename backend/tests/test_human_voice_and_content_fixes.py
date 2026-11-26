from __future__ import annotations

import io
import json
import struct
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.detectif.client import parse_aletheia_verdict_and_score
from app.main import app
from app.repositories.json_store import repo
from app.schemas import VoiceprintRecord
from app.services.cache_service import cache_service


client = TestClient(app)


def _make_wav_bytes(duration_sec: float = 5.0, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    n_frames = int(duration_sec * sample_rate)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x20\x00" * n_frames)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    cache_service.clear()
    monkeypatch.setattr(settings, "detectif_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": False})
    yield
    repo.delete_voiceprint("VP-LIVE-REAL99")
    cache_service.clear()


def test_fix2_aletheia_real_high_confidence_never_flags_fake() -> None:
    # Both score=0.99 (confidence in real) and score=0.03 (synthetic prob) on verdict="real"
    v1, syn1, auth1, st1 = parse_aletheia_verdict_and_score("real", 0.99)
    assert v1 == "real"
    assert syn1 == pytest.approx(0.01)
    assert auth1 == pytest.approx(99.0)
    assert st1 == "PASS"

    v2, syn2, auth2, st2 = parse_aletheia_verdict_and_score("real", 0.03)
    assert v2 == "real"
    assert syn2 == pytest.approx(0.03)
    assert auth2 == pytest.approx(97.0)
    assert st2 == "PASS"

    # Full LIVE call with verdict="real", score=0.99 and enrolled live speaker -> ALLOW / SAFE
    live_cust = "CUST-LIVE-REAL-CHECK"
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id="VP-LIVE-REAL99",
            customer_id=live_cust,
            customer_name="Genuine Human",
            account_tier="Retail",
            consent_confirmed=True,
            consent_timestamp="2026-11-25T10:00:00Z",
            enrolled_at="2026-11-25T10:00:00Z",
            sample_duration_sec=10.0,
            enrollment_source="REAL ANALYSIS",
            provider_speaker_ref="live-genuine-human",
            status="ACTIVE",
        )
    )

    wav_5s = _make_wav_bytes(5.0, sample_rate=48000)
    ale_resp = MagicMock(status_code=200)
    ale_resp.raise_for_status = MagicMock()
    ale_resp.json.return_value = {
        "request_id": "req_real99",
        "result": {"verdict": "real", "score": 0.99, "segments": []},
    }
    eid_resp = MagicMock(status_code=200)
    eid_resp.raise_for_status = MagicMock()
    eid_resp.json.return_value = {
        "request_id": "req_eid99",
        "result": {"decision": "match", "similarity": 0.92},
    }

    async def route_post(url: str, **kwargs):
        return ale_resp if "deepfake" in url else eid_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.side_effect = route_post

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_real99"),
        patch("httpx.AsyncClient", return_value=mc),
    ):
        resp = client.post(
            "/api/calls/analyze",
            files={"file": ("human_48k.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "Hi, I am calling to confirm my recent card payment.",
                "claimed_customer_id": live_cust,
                "execution_mode": "LIVE",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["decision"] == "ALLOW"
    assert body["verdict"] == "SAFE"
    assert body["synthetic_probability"] == pytest.approx(0.01)
    assert body["voice_authenticity"] == pytest.approx(99.0)
    assert body["session"]["voice_authenticity"]["raw_payload"]["result"]["verdict"] == "real"


def test_fix3_fix4_missing_groq_returns_unavailable_and_renormalizes_heuristic() -> None:
    wav_5s = _make_wav_bytes(5.0, sample_rate=16000)
    ale_resp = MagicMock(status_code=200)
    ale_resp.raise_for_status = MagicMock()
    ale_resp.json.return_value = {
        "request_id": "req_nosc",
        "result": {"verdict": "real", "score": 0.02, "segments": []},
    }
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.return_value = ale_resp

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_nosc"),
        patch("httpx.AsyncClient", return_value=mc),
    ):
        resp = client.post(
            "/api/calls/analyze",
            files={"file": ("clip.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "execution_mode": "LIVE",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["model_status"]["asr"] == "UNAVAILABLE"
    assert body["model_status"]["scam_analysis"] == "UNAVAILABLE"
    assert body["model_status"]["manipulation"] == "UNAVAILABLE"
    assert body["session"]["transcript"] == []
    # Voice is 98.0 and available; L2/L3/L4 unavailable -> renormalized heuristic is 98.0, not 34.3 or 0
    assert body["trust_score"] == pytest.approx(98.0)
    assert body["session"]["trust_breakdown"]["ema_applied"] is False
    assert body["decision"] == "STEP_UP"


def test_fix3_groq_whisper_audio_transcription_parallel() -> None:
    wav_5s = _make_wav_bytes(5.0, sample_rate=16000)
    ale_resp = MagicMock(status_code=200)
    ale_resp.raise_for_status = MagicMock()
    ale_resp.json.return_value = {
        "request_id": "req_groq_asr",
        "result": {"verdict": "real", "score": 0.04, "segments": []},
    }
    models_resp = MagicMock(status_code=200)
    models_resp.raise_for_status = MagicMock()
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}

    stt_resp = MagicMock(status_code=200)
    stt_resp.raise_for_status = MagicMock()
    stt_resp.json.return_value = {
        "text": "Please confirm my branch transfer today.",
        "language": "en",
        "segments": [],
    }
    llm_resp = MagicMock(status_code=200)
    llm_resp.raise_for_status = MagicMock()
    llm_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "scam_script_risk": 12,
                            "manipulation_risk": 8,
                            "tactics": [],
                            "summary": "Normal customer question.",
                        }
                    )
                }
            }
        ]
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        return models_resp

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        if "deepfake" in url:
            return ale_resp
        if "audio/transcriptions" in url:
            return stt_resp
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_asr"),
        patch.object(settings, "groq_api_key", "gsk_test_asr"),
        patch("httpx.AsyncClient", return_value=mc),
    ):
        resp = client.post(
            "/api/calls/analyze",
            files={"file": ("speech.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "execution_mode": "LIVE",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["model_status"]["asr"] == "OK"
    assert body["model_status"]["scam_analysis"] == "OK"
    assert body["session"]["transcript"][0]["text"] == "Please confirm my branch transfer today."


def test_wav_header_integrity_matches_sample_rate_and_length() -> None:
    wav_data = _make_wav_bytes(4.5, sample_rate=44100)
    riff, total_size, wave_id = struct.unpack("<4sI4s", wav_data[:12])
    assert riff == b"RIFF"
    assert wave_id == b"WAVE"
    assert total_size == len(wav_data) - 8
    sample_rate, byte_rate, bits_per_sample = struct.unpack("<IIH", wav_data[24:34])
    assert sample_rate == 44100
    assert byte_rate == 44100 * 2
    data_size = struct.unpack("<I", wav_data[40:44])[0]
    assert data_size == len(wav_data) - 44
