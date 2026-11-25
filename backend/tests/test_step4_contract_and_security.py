from __future__ import annotations

import pathlib
import re
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


client = TestClient(app)


def test_frontend_api_routes_exist_in_openapi() -> None:
    """Every REST path called by frontend/src/lib/api.ts must exist in backend OpenAPI spec."""
    openapi = client.get("/openapi.json").json()
    paths = set(openapi["paths"].keys())

    expected_routes = [
        "/api/health",
        "/api/settings",
        "/api/settings/secrets",
        "/api/cache/stats",
        "/api/cache",
        "/api/scenarios",
        "/api/scenarios/run",
        "/api/calls",
        "/api/calls/current",
        "/api/calls/{call_id}",
        "/api/calls/analyze",
        "/api/calls/{call_id}/action",
        "/api/calls/{call_id}/feedback",
        "/api/calls/{call_id}/report",
        "/api/reports",
        "/api/voiceprints",
        "/api/voiceprints/enroll-audio",
        "/api/voiceprints/verify",
        "/api/voiceprints/{voiceprint_id}/revoke",
        "/api/voiceprints/{voiceprint_id}",
        "/api/challenge/start",
        "/api/challenge/verify-audio",
        "/api/credits",
        "/api/usage",
        "/api/usage/export.csv",
        "/api/threat-registry",
        "/api/threat-registry/{entry_id}",
    ]
    missing = [route for route in expected_routes if route not in paths]
    assert not missing, f"Missing backend routes expected by frontend: {missing}"


def test_live_mode_never_returns_fake_safe_without_detectifai_key() -> None:
    """When DetectifAI key is unset, execution_mode=LIVE must mark voice layer UNAVAILABLE, never SAFE."""
    wav_header = b"RIFF" + (16036).to_bytes(4, "little") + b"WAVEfmt "
    pcm_fmt = (16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (1).to_bytes(2, "little")
    pcm_rate = (16000).to_bytes(4, "little") + (32000).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little")
    data_hdr = b"data" + (16000).to_bytes(4, "little") + (b"\x10\x00" * 8000)
    wav_bytes = wav_header + pcm_fmt + pcm_rate + data_hdr

    with patch.object(settings, "detectif_api_key", ""), patch.object(settings, "app_mode", "REAL"):
        resp = client.post(
            "/api/calls/analyze",
            data={
                "transcript_text": "Read back your 6-digit OTP code immediately.",
                "claimed_customer_id": "CUST-4821-MARCUS",
                "caller_label": "Contract Security Check",
                "execution_mode": "LIVE",
            },
            files={"file": ("probe.wav", wav_bytes, "audio/wav")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["execution_mode"] == "LIVE"
        assert body["verdict"] != "SAFE"
        assert body["session"]["voice_authenticity"]["status"] in {"UNAVAILABLE", "INCOMPLETE", "FAIL"}


def test_frontend_source_contains_no_live_secrets() -> None:
    """Scan frontend/src to confirm zero DetectifAI or Google/Gemini keys exist client-side."""
    src_root = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "src"
    pattern = re.compile(r"(dtf_live_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})")
    matches: list[str] = []
    for file_path in src_root.rglob("*"):
        if file_path.is_file():
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            for hit in pattern.findall(text):
                matches.append(f"{file_path}: {hit[:12]}...")
    assert not matches, f"Secret pattern detected in frontend source: {matches}"
