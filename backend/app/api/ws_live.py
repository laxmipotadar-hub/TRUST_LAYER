from __future__ import annotations

import base64
from datetime import datetime, timezone
import io
import wave

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.repositories.json_store import repo
from app.services.call_analysis_service import analyze_call_unified
from app.services.scam_analysis_service import extract_manipulation_analysis
from app.services.trust_engine import calculate_trust_score


router = APIRouter(tags=["live-ws"])


def _pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


@router.websocket("/ws/live-call")
async def live_call_stream(websocket: WebSocket) -> None:
    """Bi-directional streaming audio + transcript + live markers + EMA Trust Score WebSocket."""
    await websocket.accept()
    pcm_buffer = bytearray()
    transcript_parts: list[str] = []
    sample_rate = 16000
    claimed_customer_id = "CUST-4821-MARCUS"
    previous_score: float | None = None

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type", "")
            seq = int(msg.get("seq") or 0)

            if msg_type == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                        "seq": seq,
                        "ts": datetime.now(timezone.utc).isoformat(),
                    }
                )
                continue

            if msg.get("sample_rate"):
                sr = int(msg["sample_rate"])
                if 8000 <= sr <= 48000:
                    sample_rate = sr
            if msg.get("claimed_customer_id"):
                claimed_customer_id = str(msg["claimed_customer_id"]).strip()

            if msg.get("transcript_chunk"):
                chunk_text = str(msg["transcript_chunk"]).strip()
                if chunk_text:
                    transcript_parts.append(chunk_text)

            if msg.get("pcm_b64"):
                pcm_buffer.extend(base64.b64decode(msg["pcm_b64"]))

            joined_transcript = " ".join(transcript_parts).strip()
            manip = extract_manipulation_analysis(joined_transcript, provenance="REAL ANALYSIS")

            duration_sec = len(pcm_buffer) / max(1, sample_rate * 2)
            state = repo.get_settings_state()

            if msg_type == "finalize":
                wav_bytes = _pcm16_to_wav(bytes(pcm_buffer), sample_rate=sample_rate) if pcm_buffer else None
                unified = await analyze_call_unified(
                    audio_bytes=wav_bytes,
                    filename="live_stream.wav",
                    transcript_text=joined_transcript,
                    claimed_customer_id=claimed_customer_id,
                    caller_label=f"Live WS Caller ({claimed_customer_id})",
                    execution_mode="LIVE",
                    duration_hint_sec=duration_sec if duration_sec > 0 else None,
                    previous_score=previous_score,
                )
                await websocket.send_json(
                    {
                        "type": "final",
                        "seq": seq,
                        "duration_sec": round(duration_sec, 2),
                        "transcript": joined_transcript,
                        "result": unified.model_dump(),
                    }
                )
                pcm_buffer.clear()
                transcript_parts.clear()
                previous_score = unified.trust_score
                continue

            # Partial streaming update: compute live manipulation markers + provisional EMA index
            provisional = calculate_trust_score(
                voice_authenticity=85.0 if duration_sec >= 0.5 else None,
                speaker_match=75.0,
                speaker_enrolled=repo.get_voiceprint_by_customer(claimed_customer_id) is not None,
                scam_risk_score=manip.score,
                behavioral_pressure_score=manip.score,
                weights=state.get("layer_weights"),
                safe_threshold=float(state.get("safe_threshold", 75.0)),
                review_threshold=float(state.get("review_threshold", 40.0)),
                ema_alpha=float(state.get("ema_alpha", 0.45)),
                previous_score=previous_score,
            )
            if provisional.composite_score is not None:
                previous_score = provisional.composite_score

            await websocket.send_json(
                {
                    "type": "partial",
                    "seq": seq,
                    "duration_sec": round(duration_sec, 2),
                    "buffered_bytes": len(pcm_buffer),
                    "transcript": joined_transcript,
                    "manipulation": manip.model_dump(),
                    "provisional_trust_score": provisional.composite_score,
                    "provisional_band": provisional.band,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
            )
    except WebSocketDisconnect:
        return
