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
        wf.writeframes(b"\x10\x00" * int(duration_sec * sample_rate))
    return buf.getvalue()


def setup_function() -> None:
    cache_service.clear()
    client.post("/api/settings", json={"app_mode": "REAL", "cache_enabled": False})


def _make_live_vp(cid: str = "CUST-LIVE-REL", pid: str = "spk_live_rel") -> VoiceprintRecord:
    vp = VoiceprintRecord(
        voiceprint_id=f"VP-{cid[-4:]}",
        customer_id=cid,
        customer_name="Live Customer Rel",
        account_tier="Private Wealth",
        consent_confirmed=True,
        enrolled_at="2026-11-26T00:00:00Z",
        sample_duration_sec=15.0,
        enrollment_source="REAL ANALYSIS",
        provider_speaker_id=pid,
        provider_speaker_ref=pid,
        status="ACTIVE",
    )
    repo.add_voiceprint(vp)
    return vp


def test_short_clip_under_10s_skips_eidos_at_zero_credits() -> None:
    vp = _make_live_vp("CUST-SHORT-10", "spk_short_10")
    wav_6s = _make_wav_bytes(6.0)
    called_urls: list[str] = []

    ale_ok = MagicMock(status_code=200)
    ale_ok.raise_for_status = MagicMock()
    ale_ok.json.return_value = {
        "request_id": "req_ale_short",
        "result": {"verdict": "real", "score": 0.03, "segments": []},
    }
    models_resp = MagicMock(status_code=200)
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}
    llm_resp = MagicMock(status_code=200)
    llm_resp.json.return_value = {
        "choices": [{"message": {"content": json.dumps({"scam_script_risk": 5, "manipulation_risk": 5, "tactics": [], "summary": "Safe"})}}]
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        return models_resp

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        if "deepfake" in url:
            return ale_ok
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_short"),
            patch.object(settings, "groq_api_key", "gsk_test_short"),
            patch("httpx.AsyncClient", return_value=mc),
        ):
            res = client.post(
                "/api/calls/analyze",
                files={"file": ("short6s.wav", wav_6s, "audio/wav")},
                data={
                    "transcript_text": "Checking my balance.",
                    "claimed_customer_id": vp.customer_id,
                    "execution_mode": "LIVE",
                },
            )
        assert res.status_code == 200
        body = res.json()
        eidos = body["session"]["speaker_identity"]
        assert eidos["status"] == "skipped"
        assert eidos["skip_reason"] == "clip_too_short"
        assert "Clip too short for speaker verification" in eidos["detail"]
        assert eidos["cost_credits"] == 0.0
        assert not any("speakers/verify" in u for u in called_urls)
    finally:
        repo.delete_voiceprint(vp.voiceprint_id)


def test_l1_error_blocks_eidos_and_sets_reason() -> None:
    vp = _make_live_vp("CUST-L1-BLOCK", "spk_l1_block")
    wav_12s = _make_wav_bytes(12.0)
    called_urls: list[str] = []

    err_502 = MagicMock(status_code=502, headers={}, text="Bad Gateway")
    models_resp = MagicMock(status_code=200)
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}
    llm_resp = MagicMock(status_code=200)
    llm_resp.json.return_value = {
        "choices": [{"message": {"content": json.dumps({"scam_script_risk": 5, "manipulation_risk": 5, "tactics": [], "summary": "Safe"})}}]
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        return models_resp

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        if "deepfake" in url:
            return err_502
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_l1err"),
            patch.object(settings, "groq_api_key", "gsk_test_l1err"),
            patch("httpx.AsyncClient", return_value=mc),
        ):
            res = client.post(
                "/api/calls/analyze",
                files={"file": ("clip12s.wav", wav_12s, "audio/wav")},
                data={
                    "transcript_text": "Checking my balance.",
                    "claimed_customer_id": vp.customer_id,
                    "execution_mode": "LIVE",
                },
            )
        assert res.status_code == 200
        body = res.json()
        eidos = body["session"]["speaker_identity"]
        assert eidos["status"] == "skipped"
        assert eidos["skip_reason"] == "l1_error"
        assert "Blocked by L1 error" in eidos["detail"]
        assert not any("speakers/verify" in u for u in called_urls)
    finally:
        repo.delete_voiceprint(vp.voiceprint_id)


def test_insufficient_credits_skips_eidos_before_calling_verify() -> None:
    vp = _make_live_vp("CUST-LOW-CRED", "spk_low_cred")
    wav_12s = _make_wav_bytes(12.0)
    called_urls: list[str] = []

    ale_ok = MagicMock(status_code=200)
    ale_ok.raise_for_status = MagicMock()
    ale_ok.json.return_value = {
        "request_id": "req_ale_low",
        "result": {"verdict": "real", "score": 0.03, "segments": []},
    }
    credits_low = MagicMock(status_code=200)
    credits_low.json.return_value = {"available": 140}
    models_resp = MagicMock(status_code=200)
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}
    llm_resp = MagicMock(status_code=200)
    llm_resp.json.return_value = {
        "choices": [{"message": {"content": json.dumps({"scam_script_risk": 5, "manipulation_risk": 5, "tactics": [], "summary": "Safe"})}}]
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        if "/v1/credits" in url:
            return credits_low
        return models_resp

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        called_urls.append(url)
        if "deepfake" in url:
            return ale_ok
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_lowcred"),
            patch.object(settings, "groq_api_key", "gsk_test_lowcred"),
            patch("httpx.AsyncClient", return_value=mc),
        ):
            res = client.post(
                "/api/calls/analyze",
                files={"file": ("clip12s.wav", wav_12s, "audio/wav")},
                data={
                    "transcript_text": "Checking my balance.",
                    "claimed_customer_id": vp.customer_id,
                    "execution_mode": "LIVE",
                },
            )
        assert res.status_code == 200
        body = res.json()
        eidos = body["session"]["speaker_identity"]
        assert eidos["status"] == "skipped"
        assert eidos["skip_reason"] == "insufficient_credits"
        assert "Insufficient credits: need ~500 have 140" in eidos["detail"]
        assert not any("speakers/verify" in u for u in called_urls)
    finally:
        repo.delete_voiceprint(vp.voiceprint_id)


def test_liveness_failed_challenge_vs_technical_error() -> None:
    vp = _make_live_vp("CUST-LIVE-CHL", "spk_live_chl")
    wav_12s = _make_wav_bytes(12.0)

    ale_ok = MagicMock(status_code=200)
    ale_ok.raise_for_status = MagicMock()
    ale_ok.json.return_value = {
        "request_id": "req_ale_c",
        "result": {"verdict": "real", "score": 0.04, "segments": []},
    }
    eid_ok = MagicMock(status_code=200, headers={}, text="{}")
    eid_ok.raise_for_status = MagicMock()
    eid_ok.json.return_value = {
        "operation_id": "op_eid_c",
        "result": {"decision": "match", "similarity": 0.90},
    }
    credits_ok = MagicMock(status_code=200)
    credits_ok.json.return_value = {"available": 3000}
    models_resp = MagicMock(status_code=200)
    models_resp.json.return_value = {"data": [{"id": "openai/gpt-oss-120b"}]}
    llm_resp = MagicMock(status_code=200)
    llm_resp.json.return_value = {
        "choices": [{"message": {"content": json.dumps({"scam_script_risk": 5, "manipulation_risk": 5, "tactics": [], "summary": "Safe"})}}]
    }

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        if "/v1/credits" in url:
            return credits_ok
        return models_resp

    async def route_post(url: str, **kwargs):  # noqa: ARG001
        if "deepfake" in url:
            return ale_ok
        if "speakers/verify" in url:
            return eid_ok
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_chl"),
            patch.object(settings, "groq_api_key", "gsk_test_chl"),
            patch("httpx.AsyncClient", return_value=mc),
        ):
            call_res = client.post(
                "/api/calls/analyze",
                files={"file": ("clip12s.wav", wav_12s, "audio/wav")},
                data={
                    "transcript_text": "Checking my account.",
                    "claimed_customer_id": vp.customer_id,
                    "execution_mode": "LIVE",
                },
            )
            call_id = call_res.json()["call_id"]

            # 1) Technical failure (missing key on Aletheia) -> INCOMPLETE, NO END_CALL/BLOCK override
            ch_err = client.post("/api/challenge/start", json={"call_id": call_id, "customer_id": vp.customer_id}).json()
            with patch.object(settings, "detectif_api_key", ""):
                err_resp = client.post(
                    "/api/challenge/verify-audio",
                    files={"file": ("chl.wav", wav_12s, "audio/wav")},
                    data={
                        "challenge_id": ch_err["challenge_id"],
                        "spoken_response": ch_err["phrase"],
                        "response_latency_ms": "1500",
                        "capture_mode": "LIVE_SPEECH_AUDIO",
                    },
                ).json()
            assert err_resp["status"] == "incomplete"
            assert err_resp["liveness_status"] == "INCOMPLETE"
            assert err_resp["updated_call"]["decision"] not in ("END_CALL", "BLOCK")

            # 2) Failed challenge (replay / phrase mismatch) -> FAIL + END_CALL / BLOCK override
            ch_fail = client.post("/api/challenge/start", json={"call_id": call_id, "customer_id": vp.customer_id}).json()
            fail_resp = client.post(
                "/api/challenge/verify-audio",
                files={"file": ("chl.wav", wav_12s, "audio/wav")},
                data={
                    "challenge_id": ch_fail["challenge_id"],
                    "spoken_response": "completely wrong words",
                    "response_latency_ms": "1500",
                    "capture_mode": "LIVE_SPEECH_AUDIO",
                },
            ).json()
            assert fail_resp["status"] == "failed"
            assert fail_resp["liveness_status"] == "FAIL"
            assert fail_resp["updated_call"]["decision"] in ("END_CALL", "BLOCK")
    finally:
        repo.delete_voiceprint(vp.voiceprint_id)
