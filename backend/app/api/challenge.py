from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas import (
    ChallengeCaptureMode,
    ChallengeSession,
    ChallengeStartRequest,
    ChallengeVerifyRequest,
    ChallengeVerifyResponse,
)
from app.services.challenge_service import start_challenge_session, verify_challenge_response


router = APIRouter(prefix="/challenge", tags=["challenge"])


@router.post("/start", response_model=ChallengeSession)
def start_challenge(payload: ChallengeStartRequest) -> ChallengeSession:
    return start_challenge_session(payload)


@router.post("/verify", response_model=ChallengeVerifyResponse)
async def verify_challenge(payload: ChallengeVerifyRequest) -> ChallengeVerifyResponse:
    result = await verify_challenge_response(payload)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Challenge '{payload.challenge_id}' not found.")
    return result


@router.post("/verify-audio", response_model=ChallengeVerifyResponse)
async def verify_challenge_with_audio(
    challenge_id: str = Form(...),
    spoken_response: str = Form(default=""),
    response_latency_ms: int = Form(default=1400),
    capture_mode: ChallengeCaptureMode = Form(default="LIVE_SPEECH_AUDIO"),
    file: UploadFile | None = File(default=None),
) -> ChallengeVerifyResponse:
    audio_bytes = await file.read() if file is not None else None
    payload = ChallengeVerifyRequest(
        challenge_id=challenge_id,
        spoken_response=spoken_response,
        response_latency_ms=response_latency_ms,
        capture_mode=capture_mode,
        audio_captured=bool(audio_bytes),
    )
    result = await verify_challenge_response(
        payload,
        audio_bytes=audio_bytes,
        filename=(file.filename or "challenge.wav") if file is not None else "challenge.wav",
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Challenge '{challenge_id}' not found.")
    return result
