from __future__ import annotations

import io
import json
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.repositories.json_store import repo
from app.schemas import VoiceprintRecord
from app.services.aletheia_service import (
    detect_deepfake_aletheia,
    inspect_wav_duration_seconds,
    split_wav_into_sliding_chunks,
)
from app.services.cache_service import cache_service
from app.services.eidos_service import NEUTRAL_UNENROLLED_SCORE, enroll_speaker_eidos, verify_speaker_eidos
from app.services.scam_analysis_service import (
    analyze_scam_transcript,
    format_scam_contract_dict,
    run_deterministic_scam_fallback,
)


client = TestClient(app)


def _make_wav_bytes(duration_sec: float, sample_rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    n_frames = int(duration_sec * sample_rate)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * n_frames)
    return buf.getvalue()


def setup_function() -> None:
    cache_service.clear()
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": True})


@pytest.mark.anyio
async def test_aletheia_duration_and_sliding_chunks() -> None:
    short_wav = _make_wav_bytes(2.0)
    assert inspect_wav_duration_seconds(short_wav) == pytest.approx(2.0, abs=0.05)

    res_short = await detect_deepfake_aletheia(short_wav, "short.wav")
    assert res_short.model_status == "INVALID_AUDIO"
    assert res_short.result.score is None

    long_wav = _make_wav_bytes(11.0)
    chunks = split_wav_into_sliding_chunks(long_wav, chunk_sec=5.0, min_sec=4.0)
    assert len(chunks) == 2
    for ch in chunks:
        dur = inspect_wav_duration_seconds(ch)
        assert dur is not None and dur >= 4.0


@pytest.mark.anyio
async def test_aletheia_real_api_and_response_caching() -> None:
    wav_6s = _make_wav_bytes(6.0)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "request_id": "req-ale-123",
        "operation_id": "op-ale-123",
        "object": "deepfake.detection",
        "result": {
            "verdict": "fake",
            "score": 0.88,
            "duration_seconds": 6.0,
            "scored_seconds": 5.8,
            "segments": [{"start": 0.0, "end": 5.0, "score": 0.88, "verdict": "fake"}],
        },
    }

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    with patch.object(settings, "detectif_api_key", "dtf_test_key"), patch(
        "app.services.aletheia_service.httpx.AsyncClient", return_value=mock_client
    ):
        first = await detect_deepfake_aletheia(wav_6s, "probe.wav")
        assert first.model_status == "OK"
        assert first.result.deepfake_probability == 0.88
        assert first.result.score == pytest.approx(12.0)
        assert first.result.cache_hit is False

        # Second identical call must hit cache without invoking httpx.post again
        second = await detect_deepfake_aletheia(wav_6s, "probe.wav")
        assert second.model_status == "CACHED"
        assert second.result.cache_hit is True
        assert mock_client.post.await_count == 1


@pytest.mark.anyio
async def test_aletheia_error_handling_auth_ratelimit_timeout() -> None:
    wav_5s = _make_wav_bytes(5.0)
    with patch.object(settings, "detectif_api_key", "dtf_test_key"):
        # 401 Auth Failure
        resp_401 = MagicMock(status_code=401)
        mc = AsyncMock()
        mc.__aenter__.return_value = mc
        mc.post.return_value = resp_401
        with patch("app.services.aletheia_service.httpx.AsyncClient", return_value=mc):
            r = await detect_deepfake_aletheia(wav_5s, "auth.wav")
            assert r.model_status == "AUTH_ERROR"
            assert r.result.score is None

        # 429 Rate Limit
        resp_429 = MagicMock(status_code=429)
        mc.post.return_value = resp_429
        with patch("app.services.aletheia_service.httpx.AsyncClient", return_value=mc):
            r = await detect_deepfake_aletheia(wav_5s, "rate.wav")
            assert r.model_status == "RATE_LIMITED"
            assert r.result.score is None

        # Timeout
        mc.post.side_effect = httpx.TimeoutException("timed out")
        with patch("app.services.aletheia_service.httpx.AsyncClient", return_value=mc):
            r = await detect_deepfake_aletheia(wav_5s, "timeout.wav")
            assert r.model_status == "TIMEOUT"
            assert r.result.score is None


@pytest.mark.anyio
async def test_eidos_unenrolled_neutral_score_and_real_verify() -> None:
    wav_5s = _make_wav_bytes(11.0)
    # Unenrolled speaker gets neutral score 50.0
    unenrolled = await verify_speaker_eidos(wav_5s, "CUST-NONEXISTENT-999")
    assert unenrolled.model_status == "UNENROLLED"
    assert unenrolled.result.score == NEUTRAL_UNENROLLED_SCORE

    # Live-enrolled speaker verified via mocked Eidos endpoint (never sends demo-only fixture ID)
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id="VP-LIVE-P2",
            customer_id="CUST-LIVE-P2",
            customer_name="Live P2 Marcus",
            account_tier="Private Wealth",
            consent_confirmed=True,
            enrolled_at="2026-11-25T10:00:00Z",
            sample_duration_sec=16.0,
            enrollment_source="REAL ANALYSIS",
            provider_speaker_id="spk_live_p2",
            provider_speaker_ref="spk_live_p2",
            status="ACTIVE",
        )
    )
    mock_verify = MagicMock()
    mock_verify.status_code = 200
    mock_verify.raise_for_status = MagicMock()
    mock_verify.json.return_value = {
        "request_id": "req-eid-1",
        "result": {"decision": "match", "similarity": 0.91, "duration_seconds": 5.0},
    }
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.return_value = mock_verify

    try:
        with patch.object(settings, "detectif_api_key", "dtf_test_key"), patch(
            "app.services.eidos_service.httpx.AsyncClient", return_value=mc
        ):
            verified = await verify_speaker_eidos(wav_5s, "CUST-LIVE-P2")
            assert verified.model_status == "OK"
            assert verified.result.score == pytest.approx(91.0)
            assert verified.result.status == "PASS"

            # Test Eidos enroll endpoint
            mock_enroll = MagicMock()
            mock_enroll.status_code = 200
            mock_enroll.raise_for_status = MagicMock()
            mock_enroll.json.return_value = {
                "request_id": "req-eid-enr",
                "operation_id": "op-eid-enr",
                "result": {"speaker_id": "CUST-NEW-1"},
            }
            mc.post.return_value = mock_enroll
            enr = await enroll_speaker_eidos(wav_5s, "CUST-NEW-1")
            assert enr.success is True
            assert enr.provider_speaker_ref == "CUST-NEW-1"
    finally:
        repo.delete_voiceprint("VP-LIVE-P2")


@pytest.mark.anyio
async def test_scam_analysis_nine_categories_and_groq_mock() -> None:
    transcript = (
        "This is Central Bank Fraud Department. Your account will be frozen immediately! "
        "Do not tell anyone, install AnyDesk, share your password and OTP code, and move funds "
        "to a safe account or face an arrest warrant."
    )
    fallback = run_deterministic_scam_fallback(transcript)
    contract = format_scam_contract_dict(fallback)
    assert contract["scam_risk_score"] == 100.0
    assert contract["fallback_used"] is True
    assert len(contract["detected_patterns"]) == 9

    # Mocked Groq response in REAL mode
    models_resp = MagicMock(status_code=200)
    models_resp.raise_for_status = MagicMock()
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}

    groq_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "scam_script_risk": 92,
                            "manipulation_risk": 88,
                            "tactics": [
                                {"type": "credential_request", "evidence": "OTP code"},
                                {"type": "authority", "evidence": "Central Bank Fraud Department"},
                            ],
                            "summary": "Groq detected high-risk social engineering.",
                        }
                    )
                }
            }
        ]
    }
    mock_resp = MagicMock(status_code=200)
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = groq_payload
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.return_value = models_resp
    mc.post.return_value = mock_resp

    with patch.object(settings, "groq_api_key", "gsk_test_key"), patch(
        "app.services.content_analysis_service.httpx.AsyncClient", return_value=mc
    ):
        real_scam = await analyze_scam_transcript(transcript, analysis_mode="REAL")
        assert real_scam.provenance == "REAL ANALYSIS"
        assert real_scam.fallback_used is False
        assert real_scam.risk_score == 92.0
        assert real_scam.behavioral_pressure_score == 50.0


def test_unified_analyze_endpoint_never_fakes_safe_on_real_failure() -> None:
    wav_5s = _make_wav_bytes(5.0)
    with patch.object(settings, "detectif_api_key", ""):
        resp = client.post(
            "/api/calls/analyze",
            files={"file": ("probe.wav", wav_5s, "audio/wav")},
            data={
                "transcript_text": "Hello, I would like to check my balance please.",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "caller_label": "Real Failure Check",
                "analysis_mode": "REAL",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    for required_key in (
        "call_id",
        "analysis_mode",
        "synthetic_probability",
        "voice_authenticity",
        "speaker_match_percentage",
        "scam_risk_score",
        "behavioral_pressure_score",
        "trust_score",
        "verdict",
        "evidence",
        "timestamp",
        "model_status",
    ):
        assert required_key in data

    # Without API key in REAL mode, must return INCOMPLETE ANALYSIS & null trust_score
    assert data["verdict"] == "INCOMPLETE ANALYSIS"
    assert data["trust_score"] is None
    assert data["model_status"]["aletheia"] == "UNAVAILABLE"
    assert data["model_status"]["eidos"] in ("SKIPPED", "UNAVAILABLE")


def test_demo_mode_scenarios_never_call_external_apis() -> None:
    with patch("app.services.aletheia_service.httpx.AsyncClient") as aletheia_http, patch(
        "app.services.eidos_service.httpx.AsyncClient"
    ) as eidos_http, patch("app.services.content_analysis_service.httpx.AsyncClient") as content_http:
        for sid in ("S1", "S2", "S3", "S4"):
            r = client.post("/api/scenarios/run", json={"scenario_id": sid})
            assert r.status_code == 200
        assert aletheia_http.call_count == 0
        assert eidos_http.call_count == 0
        assert content_http.call_count == 0
