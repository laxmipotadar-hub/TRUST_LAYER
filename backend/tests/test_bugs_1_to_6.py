from __future__ import annotations

import io
import json
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.detectif.client import (
    parse_eidos_enroll_response,
    stable_enrollment_idempotency_key,
    validate_speaker_id,
)
from app.main import app
from app.repositories.json_store import repo
from app.services.cache_service import cache_service
from app.services.content_analysis_service import analyse_text
from app.services.eidos_service import enroll_speaker_eidos
from app.services.ledger_service import clear_ledger, record_operation


client = TestClient(app)


def _make_wav_bytes(duration_sec: float = 5.0, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x15\x00" * int(duration_sec * sample_rate))
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    cache_service.clear()
    clear_ledger()
    monkeypatch.setattr(settings, "detectif_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": False})
    yield
    cache_service.clear()
    clear_ledger()


def test_bug1_speaker_id_validation_idempotency_and_tolerant_enroll_parser() -> None:
    assert validate_speaker_id("CUST-9900") == "CUST-9900"
    assert validate_speaker_id("user_a.b:1") == "user_a.b:1"
    with pytest.raises(ValueError, match="speaker_id"):
        validate_speaker_id("bad speaker id!")

    wav = _make_wav_bytes(4.5)
    assert stable_enrollment_idempotency_key("CUST-9900", wav) == stable_enrollment_idempotency_key(
        "CUST-9900", wav
    )

    # Top-level variant
    parsed_top = parse_eidos_enroll_response(
        {"speaker_id": "CUST-9900", "operation_id": "op_123", "credits_used": 200},
        fallback_speaker_id="CUST-9900",
    )
    assert parsed_top.speaker_id == "CUST-9900"
    assert parsed_top.operation_id == "op_123"
    assert parsed_top.credits_used == 200.0

    # Nested result/data variant with request_id fallback
    parsed_data = parse_eidos_enroll_response(
        {"request_id": "req_456", "data": {"id": "CUST-DATA", "sample_count": 2}},
        fallback_speaker_id="CUST-DATA",
    )
    assert parsed_data.speaker_id == "CUST-DATA"
    assert parsed_data.operation_id == "req_456"
    assert parsed_data.samples == 2

    # Unexpected list/empty shape raises clear diagnostic naming received keys
    with pytest.raises(ValueError, match="unexpected_top_key"):
        parse_eidos_enroll_response({"unexpected_top_key": {"foo": "bar"}}, fallback_speaker_id="X")


def test_bug1_enroll_reconciles_existing_provider_speaker_without_duplicate_post() -> None:
    wav = _make_wav_bytes(5.0)
    speakers_resp = MagicMock(status_code=200, headers={}, text="{}")
    speakers_resp.json.return_value = {
        "data": [
            {
                "speaker_id": "CUST-RECON-UNIT",
                "display_name": "Unit Reconcile",
                "sample_count": 4,
                "created_at": "2026-11-25T10:00:00Z",
            }
        ]
    }
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.return_value = speakers_resp

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_reconcile"),
        patch("app.services.eidos_service.httpx.AsyncClient", return_value=mc),
    ):
        client.post("/api/settings", json={"app_mode": "REAL", "cache_enabled": False})
        resp = client.post(
            "/api/voiceprints/enroll-audio",
            files={"file": ("enroll.wav", wav, "audio/wav")},
            data={
                "customer_id": "CUST-RECON-UNIT",
                "customer_name": "Unit Reconcile",
                "consent_confirmed": "true",
                "sample_duration_sec": "5.0",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    try:
        assert body["reconciled"] is True
        assert body["provider_speaker_ref"] == "CUST-RECON-UNIT"
        mc.post.assert_not_called()
    finally:
        repo.delete_voiceprint(body["voiceprint_id"])


def test_bug3_usage_endpoint_returns_live_balance_and_provider_reconciliation() -> None:
    record_operation(
        operation_id="op_local_match_1",
        call_id="CALL-U1",
        service="aletheia",
        endpoint="/deepfake/detect",
        mode="FRESH",
        status="done",
        cost_credits=24.0,
        latency_ms=420.0,
        cached=False,
    )
    credits_resp = MagicMock(status_code=200)
    credits_resp.json.return_value = {"result": {"available": 1708, "balance": 1708}}

    usage_resp = MagicMock(status_code=200)
    usage_resp.json.return_value = {
        "data": [
            {"id": "op_local_match_1", "operation_id": "op_local_match_1", "credits_charged": 24, "endpoint": "/v1/deepfake/detect"}
        ],
        "next_cursor": None,
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        if "/v1/credits" in url:
            return credits_resp
        return usage_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_usage"),
        patch("httpx.AsyncClient", return_value=mc),
    ):
        resp = client.get("/api/usage?include_provider=true")
    assert resp.status_code == 200
    body = resp.json()
    assert body["credit_balance"] == 1708.0
    assert body["reconciliation"]["matched_count"] == 1
    assert body["reconciliation"]["status"] == "RECONCILED"


@pytest.mark.anyio
async def test_bug5_groq_drops_ungrounded_quotes_and_scores_25_per_distinct_tactic() -> None:
    transcript = "Share your OTP code immediately or your account will be frozen."
    models_resp = MagicMock(status_code=200)
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}
    llm_resp = MagicMock(status_code=200)
    llm_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "scam_script_risk": 80,
                            "manipulation_risk": 95,
                            "tactics": [
                                {"type": "credential_request", "evidence": "OTP code"},
                                {"type": "fear/threat", "evidence": "account will be frozen"},
                                # Hallucinated quote not in transcript MUST be dropped
                                {"type": "secrecy", "evidence": "do not tell your branch manager"},
                            ],
                            "summary": "Requests OTP under threat of freeze.",
                        }
                    )
                }
            }
        ]
    }
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.return_value = models_resp
    mc.post.return_value = llm_resp

    with (
        patch.object(settings, "groq_api_key", "gsk_test_ground"),
        patch("app.services.content_analysis_service.httpx.AsyncClient", return_value=mc),
    ):
        scam, manip = await analyse_text(transcript, analysis_mode="REAL")
    assert scam.risk_score == 80.0
    # 2 verified distinct tactics * 25 = 50.0 (ungrounded secrecy quote dropped!)
    assert scam.behavioral_pressure_score == 50.0
    assert manip.score == 50.0
    assert len(scam.flagged_phrases) == 2
    assert "secrecy" not in scam.pressure_tactics


def test_bug6_operator_terminate_call_updates_decision_and_audit_log() -> None:
    s1 = client.post("/api/scenarios/run", json={"scenario_id": "S1"}).json()
    call_id = s1["call_id"]
    res = client.post(
        f"/api/calls/{call_id}/action",
        json={"action": "TERMINATE_CALL", "operator_note": "Live test terminate"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["action_recorded"]["action"] == "TERMINATE_CALL"
    assert repo.get_call(call_id).decision == "END_CALL"
    assert repo.get_call(call_id).verdict == "THREAT"


def test_live_call_populates_sha256_cache_for_zero_credit_cached_rerun() -> None:
    client.post("/api/settings", json={"app_mode": "DEMO", "cache_enabled": True})
    wav_5s = _make_wav_bytes(5.0)
    ale_ok = MagicMock(status_code=200, headers={}, text="{}")
    ale_ok.raise_for_status = MagicMock()
    ale_ok.json.return_value = {
        "request_id": "req_cache_live",
        "operation_id": "op_cache_live",
        "credits_used": 20,
        "result": {"verdict": "real", "score": 0.04, "segments": []},
    }
    models_resp = MagicMock(status_code=200)
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}
    stt_resp = MagicMock(status_code=200)
    stt_resp.json.return_value = {"text": "Confirming my card travel alert.", "language": "en", "segments": []}
    llm_resp = MagicMock(status_code=200)
    llm_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "scam_script_risk": 5,
                            "manipulation_risk": 5,
                            "tactics": [],
                            "summary": "Routine inquiry.",
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
            return ale_ok
        if "audio/transcriptions" in url:
            return stt_resp
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_cache"),
        patch.object(settings, "groq_api_key", "gsk_test_cache"),
        patch("httpx.AsyncClient", return_value=mc),
    ):
        live_res = client.post(
            "/api/calls/analyze",
            files={"file": ("clip.wav", wav_5s, "audio/wav")},
            data={"transcript_text": "", "claimed_customer_id": "UNENROLLED-C", "execution_mode": "LIVE"},
        )
    assert live_res.status_code == 200
    assert live_res.json()["model_status"]["aletheia"] == "OK"

    # Second run in CACHED mode with no API keys -> hits Aletheia & Groq cache at 0 cost
    cached_res = client.post(
        "/api/calls/analyze",
        files={"file": ("clip.wav", wav_5s, "audio/wav")},
        data={"transcript_text": "", "claimed_customer_id": "UNENROLLED-C", "execution_mode": "CACHED"},
    )
    assert cached_res.status_code == 200
    cb = cached_res.json()
    assert cb["model_status"]["aletheia"] == "CACHED"
    assert cb["model_status"]["asr"] == "CACHED"
    assert cb["model_status"]["scam_analysis"] == "CACHED"
    assert cb["session"]["voice_authenticity"]["cost_credits"] == 0.0
