from __future__ import annotations

import io
import json
import wave
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.repositories.json_store import repo
from app.schemas import VoiceprintRecord
from app.services.cache_service import cache_service


client = TestClient(app)


def _make_wav_bytes(duration_sec: float, sample_rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * int(duration_sec * sample_rate))
    return buf.getvalue()


def setup_function() -> None:
    cache_service.clear()
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": True})


def test_live_call_short_audio_rejected_as_invalid_in_real_mode() -> None:
    short_wav = _make_wav_bytes(2.0)
    with patch.object(settings, "detectif_api_key", "dtf_live_mock"):
        res = client.post(
            "/api/calls/analyze",
            files={"file": ("short.wav", short_wav, "audio/wav")},
            data={
                "transcript_text": "Checking my balance.",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "analysis_mode": "REAL",
            },
        )
    assert res.status_code == 200
    data = res.json()
    assert data["model_status"]["aletheia"] == "INVALID_AUDIO"
    assert data["verdict"] == "INCOMPLETE ANALYSIS"
    assert data["trust_score"] is None


def test_live_call_real_mode_with_aletheia_eidos_groq_and_cache_hit() -> None:
    wav_5s = _make_wav_bytes(11.2)

    ale_resp = MagicMock(status_code=200)
    ale_resp.raise_for_status = MagicMock()
    ale_resp.json.return_value = {
        "request_id": "req-ale-live",
        "result": {
            "verdict": "real",
            "score": 0.04,  # 96% authentic
            "duration_seconds": 5.2,
            "scored_seconds": 5.0,
            "segments": [{"start": 0.0, "end": 5.0, "score": 0.04, "verdict": "real"}],
        },
    }

    eid_resp = MagicMock(status_code=200)
    eid_resp.raise_for_status = MagicMock()
    eid_resp.json.return_value = {
        "request_id": "req-eid-live",
        "result": {"decision": "match", "similarity": 0.94, "duration_seconds": 5.0},
    }

    models_resp = MagicMock(status_code=200)
    models_resp.raise_for_status = MagicMock()
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}

    groq_resp = MagicMock(status_code=200)
    groq_resp.raise_for_status = MagicMock()
    groq_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "scam_script_risk": 8,
                            "manipulation_risk": 10,
                            "tactics": [],
                            "summary": "Routine customer inquiry.",
                        }
                    )
                }
            }
        ]
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        return models_resp

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        if "deepfake/detect" in url:
            return ale_resp
        if "speakers/verify" in url:
            return eid_resp
        return groq_resp

    unified_client = AsyncMock()
    unified_client.__aenter__.return_value = unified_client
    unified_client.get.side_effect = route_get
    unified_client.post.side_effect = route_post

    live_cid = "CUST-LIVE-P12"
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id="VP-LIVE-P12",
            customer_id=live_cid,
            customer_name="Live P12 Marcus",
            account_tier="Private Wealth",
            consent_confirmed=True,
            enrolled_at="2026-11-25T10:00:00Z",
            sample_duration_sec=16.0,
            enrollment_source="REAL ANALYSIS",
            provider_speaker_id="spk_live_p12",
            provider_speaker_ref="spk_live_p12",
            status="ACTIVE",
        )
    )
    try:
        # First verify CACHE miss is honest when cache is empty
        miss_res = client.post(
            "/api/calls/analyze",
            files={"file": ("live.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "Hi, confirming my Zurich travel notice.",
                "claimed_customer_id": live_cid,
                "analysis_mode": "CACHED",
            },
        )
        assert miss_res.status_code == 200
        assert miss_res.json()["model_status"]["aletheia"] == "CACHE_MISS"
        assert miss_res.json()["verdict"] == "INCOMPLETE ANALYSIS"

        # Now execute REAL mode
        with patch.object(settings, "detectif_api_key", "dtf_live_mock"), patch.object(
            settings, "groq_api_key", "gsk_live_mock"
        ), patch("httpx.AsyncClient", return_value=unified_client):
            real_res = client.post(
                "/api/calls/analyze",
                files={"file": ("live.wav", wav_5s, "audio/wav")},
                data={
                    "transcript_text": "Hi, confirming my Zurich travel notice.",
                    "claimed_customer_id": live_cid,
                    "caller_label": "Live Mic Marcus",
                    "analysis_mode": "REAL",
                },
            )
            assert real_res.status_code == 200
            body = real_res.json()
            assert body["analysis_mode"] == "REAL"
            assert body["trust_score"] == 95.20
            assert body["verdict"] == "SAFE"
            assert body["session"]["overall_provenance"] == "REAL ANALYSIS"
            assert len(body["session"]["segment_chunks"]) == 1

        # Now CACHED mode with the exact same audio & transcript returns cache hits!
        hit_res = client.post(
            "/api/calls/analyze",
            files={"file": ("live.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "Hi, confirming my Zurich travel notice.",
                "claimed_customer_id": live_cid,
                "analysis_mode": "CACHED",
            },
        )
        assert hit_res.status_code == 200
        hit_body = hit_res.json()
        assert hit_body["model_status"]["aletheia"] == "CACHED"
        assert hit_body["model_status"]["eidos"] == "CACHED"
        assert hit_body["trust_score"] == 95.20
        assert hit_body["session"]["overall_provenance"] == "CACHED ANALYSIS"
    finally:
        repo.delete_voiceprint("VP-LIVE-P12")
