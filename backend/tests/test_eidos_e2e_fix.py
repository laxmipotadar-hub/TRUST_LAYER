from __future__ import annotations

import io
import json
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.detectif.client import parse_eidos_enroll_response, parse_eidos_verify_response
from app.main import app
from app.repositories.json_store import repo
from app.schemas import VoiceprintRecord
from app.services.cache_service import cache_service
from app.services.eidos_service import enroll_speaker_eidos, resync_voiceprints_from_provider, verify_speaker_eidos
from app.services.ledger_service import clear_ledger


client = TestClient(app)


def _make_wav_bytes(duration_sec: float = 5.5, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x18\x00" * int(duration_sec * sample_rate))
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


def test_nested_speaker_speaker_id_parsing_and_active_guard() -> None:
    parsed = parse_eidos_enroll_response(
        {
            "request_id": "req_nested_1",
            "operation_id": "op_nested_1",
            "speaker": {"speaker_id": "spk_nested_9988", "display_name": "Marcus Vance"},
            "credits_used": 200,
        }
    )
    assert parsed.speaker_id == "spk_nested_9988"
    assert parsed.operation_id == "op_nested_1"
    assert parsed.credits_used == 200.0

    # Must refuse pending/unconfirmed enrollment or missing speaker_id
    with pytest.raises(ValueError, match="status='pending'"):
        parse_eidos_enroll_response({"status": "pending", "operation_id": "op_p"})

    with pytest.raises(ValueError, match="speaker_id"):
        parse_eidos_enroll_response({"request_id": "req_no_id", "ok": True})


@pytest.mark.anyio
async def test_http_200_parse_failure_reconciles_existing_speaker_instead_of_re_enrolling() -> None:
    wav_16s = _make_wav_bytes(16.0)
    enroll_200_bad_shape = MagicMock(
        status_code=200,
        headers={"content-type": "application/json"},
        text='{"unexpected": "shape"}',
    )
    enroll_200_bad_shape.json.return_value = {"unexpected": "shape"}

    speakers_get = MagicMock(status_code=200, headers={}, text="{}")
    speakers_get.json.return_value = {
        "data": [{"speaker_id": "CUST-REC-200", "display_name": "Marcus", "samples": 1}]
    }

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.return_value = enroll_200_bad_shape
    mc.get.return_value = speakers_get

    with (
        patch.object(settings, "detectif_api_key", "dtf_test_reconcile200"),
        patch("app.services.eidos_service.httpx.AsyncClient", return_value=mc),
    ):
        outcome = await enroll_speaker_eidos(wav_16s, "CUST-REC-200")
    assert outcome.success is True
    assert outcome.reconciled is True
    assert outcome.provider_speaker_ref == "CUST-REC-200"
    assert mc.post.call_count == 1
    assert mc.get.call_count == 1


def test_stale_simulation_shadowed_by_live_enrollment_and_different_script_match_vs_nomatch() -> None:
    cust_id = "CUST-MARCUS-E2E"
    wav_script_a = _make_wav_bytes(16.0)
    wav_script_b = _make_wav_bytes(6.0)
    wav_impostor = _make_wav_bytes(6.5)

    # First create a stale SIMULATION voiceprint with the same customer_id
    sim_vp = VoiceprintRecord(
        voiceprint_id="VP-STALE-SIM",
        customer_id=cust_id,
        customer_name="Marcus Stale",
        account_tier="Private Banking",
        consent_confirmed=True,
        enrolled_at="2026-11-25T10:00:00Z",
        sample_duration_sec=16.0,
        enrollment_source="SIMULATION",
        provider_speaker_id=None,
        provider_speaker_ref=f"sim-{cust_id}",
        status="ACTIVE",
    )
    repo.add_voiceprint(sim_vp)

    verify_calls: list[dict] = []

    def make_resp(status: int, payload: dict) -> MagicMock:
        m = MagicMock(status_code=status, headers={"content-type": "application/json"}, text=json.dumps(payload))
        m.raise_for_status = MagicMock()
        m.json.return_value = payload
        return m

    speakers_empty = make_resp(200, {"data": []})
    enroll_ok = make_resp(
        200,
        {
            "request_id": "req_enr_marcus",
            "operation_id": "op_enr_marcus_01",
            "speaker": {"speaker_id": "spk_provider_marcus_77", "display_name": "Marcus E2E"},
            "credits_used": 200,
        },
    )
    ale_ok = make_resp(
        200,
        {
            "request_id": "req_ale_marcus",
            "operation_id": "op_ale_marcus_01",
            "credits_used": 20,
            "result": {"verdict": "real", "score": 0.03, "segments": []},
        },
    )
    verify_match_ok = make_resp(
        200,
        {
            "request_id": "req_ver_match",
            "operation_id": "op_ver_match_01",
            "credits_used": 500,
            "result": {"decision": "match", "similarity": 0.91, "duration_seconds": 6.0},
        },
    )
    verify_nomatch_ok = make_resp(
        200,
        {
            "request_id": "req_ver_nomatch",
            "operation_id": "op_ver_nomatch_01",
            "credits_used": 500,
            "result": {"decision": "no_match", "similarity": 0.21, "duration_seconds": 6.5},
        },
    )
    models_resp = make_resp(200, {"data": [{"id": "openai/gpt-oss-120b"}]})
    llm_resp = make_resp(
        200,
        {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "scam_script_risk": 5,
                                "manipulation_risk": 5,
                                "tactics": [],
                                "summary": "Benign caller script.",
                            }
                        )
                    }
                }
            ]
        },
    )

    verify_turn = {"idx": 0}

    async def route_get(url: str, **kwargs):  # noqa: ARG001
        if "/v1/speakers" in url:
            return speakers_empty
        return models_resp

    async def route_post(url: str, **kwargs):
        if "/v1/speakers/enroll" in url:
            return enroll_ok
        if "/v1/deepfake/detect" in url:
            return ale_ok
        if "/v1/speakers/verify" in url:
            verify_calls.append(
                {
                    "speaker_id": (kwargs.get("data") or {}).get("speaker_id"),
                    "idempotency_key": (kwargs.get("headers") or {}).get("Idempotency-Key"),
                }
            )
            verify_turn["idx"] += 1
            return verify_match_ok if verify_turn["idx"] == 1 else verify_nomatch_ok
        return llm_resp

    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.side_effect = route_get
    mc.post.side_effect = route_post

    created_vp_id = None
    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_e2e"),
            patch.object(settings, "groq_api_key", "gsk_test_e2e"),
            patch("httpx.AsyncClient", return_value=mc),
        ):
            # 1) Enroll via /api/voiceprints/enroll-audio with Script A in LIVE mode
            enr_res = client.post(
                "/api/voiceprints/enroll-audio",
                files={"file": ("script_a.wav", wav_script_a, "audio/wav")},
                data={
                    "customer_id": cust_id,
                    "customer_name": "Marcus E2E",
                    "consent_confirmed": "true",
                    "execution_mode": "LIVE",
                    "sample_duration_sec": "16.0",
                },
            )
            assert enr_res.status_code == 200
            vp_body = enr_res.json()
            created_vp_id = vp_body["voiceprint_id"]
            assert vp_body["provider_speaker_id"] == "spk_provider_marcus_77"
            assert vp_body["enrollment_source"] == "REAL ANALYSIS"
            assert vp_body["status"] == "ACTIVE"

            # Verify stale simulation record is superseded
            active_for_cust = repo.get_voiceprint_by_customer(cust_id)
            assert active_for_cust is not None
            assert active_for_cust.provider_speaker_id == "spk_provider_marcus_77"

            # 2) Analyze Script B (completely different words) for same customer -> MATCH
            res_match = client.post(
                "/api/calls/analyze",
                files={"file": ("script_b.wav", wav_script_b, "audio/wav")},
                data={
                    "transcript_text": "Completely different Script B reading a wire confirmation.",
                    "claimed_customer_id": cust_id,
                    "execution_mode": "LIVE",
                },
            )
            assert res_match.status_code == 200
            m_body = res_match.json()
            assert m_body["model_status"]["eidos"] == "OK"
            sid_m = m_body["session"]["speaker_identity"]
            assert sid_m["provider_speaker_id"] == "spk_provider_marcus_77"
            assert sid_m["decision"] == "MATCH"
            assert sid_m["operation_id"] == "op_ver_match_01"
            assert m_body["speaker_match_percentage"] == pytest.approx(91.0)

            # 3) Analyze impostor audio for same customer -> NO_MATCH with distinct Idempotency-Key
            res_nomatch = client.post(
                "/api/calls/analyze",
                files={"file": ("impostor.wav", wav_impostor, "audio/wav")},
                data={
                    "transcript_text": "Different voice claiming to be Marcus.",
                    "claimed_customer_id": cust_id,
                    "execution_mode": "LIVE",
                },
            )
            assert res_nomatch.status_code == 200
            nm_body = res_nomatch.json()
            assert nm_body["model_status"]["eidos"] == "OK"
            sid_nm = nm_body["session"]["speaker_identity"]
            assert sid_nm["provider_speaker_id"] == "spk_provider_marcus_77"
            assert sid_nm["decision"] == "NO_MATCH"
            assert sid_nm["operation_id"] == "op_ver_nomatch_01"
            assert nm_body["speaker_match_percentage"] == pytest.approx(21.0)

        assert len(verify_calls) == 2
        assert verify_calls[0]["speaker_id"] == "spk_provider_marcus_77"
        assert verify_calls[1]["speaker_id"] == "spk_provider_marcus_77"
        assert verify_calls[0]["idempotency_key"] != verify_calls[1]["idempotency_key"]
    finally:
        repo.delete_voiceprint("VP-STALE-SIM")
        if created_vp_id:
            repo.delete_voiceprint(created_vp_id)


def test_parse_eidos_verify_response_variants() -> None:
    top_variant = parse_eidos_verify_response(
        {"decision": "NO_MATCH", "similarity": 0.18, "operation_id": "op_v_top"}
    )
    assert top_variant.decision == "no_match"
    assert top_variant.similarity == pytest.approx(0.18)
    assert top_variant.operation_id == "op_v_top"

    with pytest.raises(ValueError, match="decision"):
        parse_eidos_verify_response({"bad_field": 123})


@pytest.mark.anyio
async def test_any_casing_enrollment_source_verifies_when_provider_speaker_id_valid() -> None:
    wav_5s = _make_wav_bytes(5.5)
    vp_id = "VP-CASELESS-1"
    cid = "CUST-CASELESS-1"
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id=vp_id,
            customer_id=cid,
            customer_name="Casing Test",
            account_tier="Retail",
            consent_confirmed=True,
            enrolled_at="2026-11-26T00:00:00Z",
            sample_duration_sec=16.0,
            enrollment_source="real analysis",  # type: ignore[arg-type]
            provider_speaker_id="spk_caseless_99",
            provider_speaker_ref="spk_caseless_99",
            status="ACTIVE",
        )
    )
    verify_ok = MagicMock(status_code=200, headers={}, text="{}")
    verify_ok.raise_for_status = MagicMock()
    verify_ok.json.return_value = {
        "operation_id": "op_case_1",
        "result": {"decision": "match", "similarity": 0.88},
    }
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.post.return_value = verify_ok
    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_case"),
            patch("app.services.eidos_service.httpx.AsyncClient", return_value=mc),
        ):
            ev = await verify_speaker_eidos(wav_5s, cid, bypass_cache=True)
        assert ev.model_status == "OK"
        assert ev.result.decision == "MATCH"
        assert ev.result.provider_speaker_id == "spk_caseless_99"
    finally:
        repo.delete_voiceprint(vp_id)


@pytest.mark.anyio
async def test_demo_only_skips_with_stored_field_values_and_wrong_customer_errors_clearly() -> None:
    wav_5s = _make_wav_bytes(5.5)
    vp_sim_id = "VP-DEMO-SKIP-1"
    cid = "CUST-DEMO-SKIP-1"
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id=vp_sim_id,
            customer_id=cid,
            customer_name="Demo Skip",
            account_tier="Retail",
            consent_confirmed=True,
            enrolled_at="2026-11-26T00:00:00Z",
            sample_duration_sec=16.0,
            enrollment_source="SIMULATION",
            provider_speaker_id=None,
            provider_speaker_ref=f"sim-{cid}",
            status="ACTIVE",
        )
    )
    try:
        with patch.object(settings, "detectif_api_key", "dtf_test_skip"):
            ev = await verify_speaker_eidos(wav_5s, cid, bypass_cache=True)
        assert ev.model_status == "SKIPPED"
        assert ev.result.skip_reason == "no_voice_id"
        assert "provider_speaker_id=None" in ev.result.detail
        assert f"ref='sim-{cid}'" in ev.result.detail
        assert "source='SIMULATION'" in ev.result.detail

        # Wrong / missing customer key -> clear SKIPPED / not enrolled message
        ev_missing = await verify_speaker_eidos(wav_5s, "WRONG-CUSTOMER-KEY-999", bypass_cache=True)
        assert ev_missing.model_status == "UNENROLLED"
        assert "not enrolled" in ev_missing.result.detail
    finally:
        repo.delete_voiceprint(vp_sim_id)


@pytest.mark.anyio
async def test_resync_from_provider_repairs_missing_provider_id_without_reenroll() -> None:
    vp_id = "VP-REPAIR-ME"
    cid = "CUST-REPAIR-ME"
    repo.add_voiceprint(
        VoiceprintRecord(
            voiceprint_id=vp_id,
            customer_id=cid,
            customer_name="Broken Local",
            account_tier="Private Wealth",
            consent_confirmed=True,
            enrolled_at="2026-11-26T00:00:00Z",
            sample_duration_sec=20.0,
            enrollment_source="SIMULATION",
            provider_speaker_id=None,
            provider_speaker_ref=f"sim-{cid}",
            status="ACTIVE",
        )
    )
    speakers_resp = MagicMock(status_code=200)
    speakers_resp.json.return_value = {
        "data": [{"speaker_id": cid, "display_name": "Broken Local", "samples": 2}]
    }
    mc = AsyncMock()
    mc.__aenter__.return_value = mc
    mc.get.return_value = speakers_resp

    try:
        with (
            patch.object(settings, "detectif_api_key", "dtf_test_resync"),
            patch("app.services.eidos_service.httpx.AsyncClient", return_value=mc),
        ):
            repaired_list = await resync_voiceprints_from_provider()
        mc.post.assert_not_called()
        repaired = repo.get_voiceprint_by_customer(cid)
        assert repaired is not None
        assert repaired.provider_speaker_id == cid
        assert repaired.enrollment_source == "REAL ANALYSIS"
        assert repaired.reconciled is True
        assert any(v.customer_id == cid and v.provider_speaker_id == cid for v in repaired_list)
    finally:
        repo.delete_voiceprint(vp_id)
