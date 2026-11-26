from __future__ import annotations

import base64
import io
import math
import struct
from unittest.mock import patch
import wave

from fastapi.testclient import TestClient
import httpx
import pytest

from app.core.config import settings
from app.main import app
from app.services.cache_service import cache_service
from app.services.ledger_service import clear_ledger, read_ledger
from app.services.scam_analysis_service import extract_manipulation_analysis
from app.services.trust_engine import calculate_trust_score


client = TestClient(app)


def _pcm16_bytes(seconds: float = 4.5, rate: int = 16000) -> bytes:
    n = int(seconds * rate)
    return b"".join(struct.pack("<h", int(8000 * math.sin(2.0 * math.pi * 220.0 * i / rate))) for i in range(n))


def _wav_bytes(seconds: float = 4.5, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(_pcm16_bytes(seconds, rate))
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _clean_state(tmp_path, monkeypatch):
    cache_service.clear()
    clear_ledger()
    monkeypatch.setattr(settings, "detectif_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    client.post(
        "/api/settings",
        json={
            "app_mode": "DEMO",
            "cache_enabled": True,
            "safe_threshold": 75.0,
            "review_threshold": 40.0,
            "ema_alpha": 0.45,
        },
    )
    yield
    cache_service.clear()
    clear_ledger()


def test_fusion_voice_clone_override_and_ema_smoothing() -> None:
    # Voice-clone conflict override: low voice authenticity (12%) + high speaker match (91%) -> THREAT/BLOCK
    cloned = calculate_trust_score(
        voice_authenticity=12.0,
        synthetic_probability=0.88,
        speaker_match=91.0,
        speaker_enrolled=True,
        scam_risk_score=10.0,
        behavioral_pressure_score=10.0,
    )
    assert cloned.voice_clone_override_applied is True
    assert any("voice-clone override" in c for c in cloned.conflict_overrides)
    assert cloned.final_decision == "THREAT"
    assert cloned.band == "THREAT"
    assert cloned.decision == "BLOCK"

    # EMA smoothing: alpha * raw + (1 - alpha) * prev
    smoothed = calculate_trust_score(
        voice_authenticity=90.0,
        speaker_match=90.0,
        speaker_enrolled=True,
        scam_risk_score=10.0,
        behavioral_pressure_score=10.0,
        ema_alpha=0.5,
        previous_score=60.0,
    )
    assert smoothed.ema_applied is True
    assert smoothed.raw_composite_score == 90.0
    assert smoothed.composite_score == 75.0
    assert smoothed.band == "SAFE"
    assert smoothed.decision == "ALLOW"


def test_manipulation_marker_extraction_categories_and_excerpts() -> None:
    text = (
        "This is the Fraud Department from Central Bank. Your account will be frozen right now! "
        "Do not tell anyone at the branch and share the OTP immediately."
    )
    res = extract_manipulation_analysis(text)
    assert res.category_counts["authority"] >= 1
    assert res.category_counts["threat"] >= 1
    assert res.category_counts["secrecy"] >= 1
    assert res.category_counts["urgency"] >= 1
    assert len(res.markers) >= 4
    assert all(m.excerpt for m in res.markers)
    assert len(res.sparkline) >= 1


def test_settings_secrets_usage_csv_and_feedback_endpoints() -> None:
    # Secrets set server-side only (never echoed back in full)
    sec_r = client.post("/api/settings/secrets", json={"detectif_api_key": "dtf_test_1234567890"})
    assert sec_r.status_code == 200
    assert sec_r.json()["detectifai_configured"] is True
    assert "1234567890" not in sec_r.text

    del_r = client.delete("/api/settings/secrets")
    assert del_r.status_code == 200
    assert del_r.json()["detectifai_configured"] is False

    # Scenario -> feedback -> reports -> usage CSV
    sc_r = client.post("/api/scenarios/run", json={"scenario_id": "S4"})
    assert sc_r.status_code == 200
    call_id = sc_r.json()["call_id"]

    fb_r = client.post(
        f"/api/calls/{call_id}/feedback",
        json={"is_scam": True, "label": "SCAM", "notes": "Confirmed social engineering script"},
    )
    assert fb_r.status_code == 200
    assert fb_r.json()["feedback"]["label"] == "SCAM"

    reports_r = client.get("/api/reports")
    assert reports_r.status_code == 200
    assert any(r["call_id"] == call_id for r in reports_r.json())

    usage_r = client.get("/api/usage?include_provider=false")
    assert usage_r.status_code == 200
    assert usage_r.json()["total_calls_analyzed"] >= 1

    csv_r = client.get("/api/usage/export.csv")
    assert csv_r.status_code == 200
    assert "operation_id,call_id,service" in csv_r.text


def test_live_mode_bypasses_cache_and_websocket_streams_fresh() -> None:
    wav = _wav_bytes(4.5)
    calls_counter = {"detect": 0, "verify": 0}

    class FakeResp:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload

        def raise_for_status(self):
            if self.status_code >= 400:
                raise httpx.HTTPStatusError("err", request=httpx.Request("POST", "http://x"), response=httpx.Response(self.status_code))

        def json(self):
            return self._payload

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url: str, **kwargs):
            if url.endswith("/v1/deepfake/detect"):
                calls_counter["detect"] += 1
                return FakeResp(
                    200,
                    {
                        "operation_id": f"op_live_a_{calls_counter['detect']}",
                        "request_id": f"req_a_{calls_counter['detect']}",
                        "credits_used": 24,
                        "result": {"verdict": "real", "score": 0.04, "segments": []},
                    },
                )
            calls_counter["verify"] += 1
            return FakeResp(
                200,
                {
                    "operation_id": f"op_live_e_{calls_counter['verify']}",
                    "request_id": f"req_e_{calls_counter['verify']}",
                    "credits_used": 500,
                    "result": {"decision": "match", "similarity": 0.91, "threshold": 0.75},
                },
            )

    with (
        patch.object(settings, "detectif_api_key", "dtf_mock_runtime"),
        patch("app.services.aletheia_service.httpx.AsyncClient", return_value=FakeAsyncClient()),
        patch("app.services.eidos_service.httpx.AsyncClient", return_value=FakeAsyncClient()),
    ):
        for _ in range(2):
            res = client.post(
                "/api/calls/analyze",
                files={"file": ("live.wav", wav, "audio/wav")},
                data={
                    "claimed_customer_id": "CUST-4821-MARCUS",
                    "execution_mode": "LIVE",
                    "transcript_text": "Urgent payment right now! Read me the OTP.",
                },
            )
            assert res.status_code == 200
            assert res.json()["execution_mode"] == "LIVE"
            assert res.json()["session"]["voice_authenticity"]["cache_hit"] is False

        # In LIVE mode, both runs MUST bypass cache and hit provider directly
        assert calls_counter["detect"] == 2
        fresh_rows = [e for e in read_ledger() if e.mode == "FRESH"]
        assert len(fresh_rows) >= 2

        with client.websocket_connect("/api/ws/live-call") as ws:
            ws.send_json({"type": "ping", "seq": 1})
            assert ws.receive_json()["type"] == "pong"

            pcm_b64 = base64.b64encode(_pcm16_bytes(4.5, 16000)).decode("ascii")
            ws.send_json(
                {
                    "type": "chunk",
                    "seq": 2,
                    "sample_rate": 16000,
                    "claimed_customer_id": "CUST-4821-MARCUS",
                    "pcm_b64": pcm_b64,
                    "transcript_chunk": "This is Central Bank Fraud Department. Do not tell anyone!",
                }
            )
            partial = ws.receive_json()
            assert partial["type"] == "partial"
            assert partial["manipulation"]["category_counts"]["authority"] >= 1

            ws.send_json({"type": "finalize", "seq": 3, "claimed_customer_id": "CUST-4821-MARCUS"})
            final_msg = ws.receive_json()
            assert final_msg["type"] == "final"
            assert final_msg["result"]["execution_mode"] == "LIVE"


def test_openapi_spec_exposes_all_step1_endpoints() -> None:
    spec = client.get("/openapi.json").json()
    paths = set(spec["paths"].keys())
    for expected in (
        "/api/health",
        "/api/settings",
        "/api/settings/secrets",
        "/api/credits",
        "/api/usage",
        "/api/usage/export.csv",
        "/api/scenarios",
        "/api/scenarios/run",
        "/api/calls/analyze",
        "/api/calls/{call_id}/action",
        "/api/calls/{call_id}/feedback",
        "/api/calls/{call_id}/report",
        "/api/reports",
        "/api/voiceprints",
        "/api/voiceprints/enroll-audio",
        "/api/voiceprints/verify",
        "/api/voiceprints/{voiceprint_id}/revoke",
        "/api/challenge/start",
        "/api/challenge/verify",
        "/api/challenge/verify-audio",
        "/api/threat-registry",
    ):
        assert expected in paths
