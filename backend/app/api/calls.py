from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.repositories.json_store import repo
from app.schemas import (
    AnalysisMode,
    CallActionRecord,
    CallActionRequest,
    CallActionResponse,
    CallReportResponse,
    CallSession,
    UnifiedCallAnalysisResponse,
)
from app.services.call_analysis_service import analyze_call_unified
from app.services.report_service import generate_call_report


router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("", response_model=list[CallSession])
def list_calls(limit: int = 20) -> list[CallSession]:
    return repo.list_calls(limit=limit)


@router.get("/current", response_model=CallSession)
def get_current_call() -> CallSession:
    call = repo.get_current_call()
    if not call:
        raise HTTPException(status_code=404, detail="No active or recorded calls yet. Run a scenario first.")
    return call


@router.post("/analyze", response_model=UnifiedCallAnalysisResponse)
async def analyze_call(
    file: UploadFile | None = File(default=None),
    transcript_text: str = Form(default=""),
    claimed_customer_id: str = Form(default="CUST-4821-MARCUS"),
    caller_label: str = Form(default="Live Call Analysis"),
    analysis_mode: AnalysisMode | None = Form(default=None),
    duration_hint_sec: float | None = Form(default=None),
) -> UnifiedCallAnalysisResponse:
    """Unified Phase 2 analysis endpoint coordinating Aletheia, Eidos, Scam & Pressure, and Trust Score."""
    audio_bytes = await file.read() if file is not None else None
    filename = (file.filename or "call_audio.wav") if file is not None else "no_audio.wav"
    return await analyze_call_unified(
        audio_bytes=audio_bytes,
        filename=filename,
        transcript_text=transcript_text,
        claimed_customer_id=claimed_customer_id,
        caller_label=caller_label,
        requested_mode=analysis_mode,
        duration_hint_sec=duration_hint_sec,
    )


@router.get("/{call_id}", response_model=CallSession)
def get_call(call_id: str) -> CallSession:
    call = repo.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail=f"Call '{call_id}' not found.")
    return call


@router.get("/{call_id}/report", response_model=CallReportResponse)
def get_call_report(call_id: str) -> CallReportResponse:
    call = repo.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail=f"Call '{call_id}' not found.")
    return generate_call_report(call)


@router.post("/{call_id}/action", response_model=CallActionResponse)
def record_call_action(call_id: str, payload: CallActionRequest) -> CallActionResponse:
    record = CallActionRecord(
        action=payload.action,
        operator_note=payload.operator_note,
        executed_at=datetime.now(timezone.utc).isoformat(),
    )
    updated = repo.append_call_action(call_id, record)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Call '{call_id}' not found.")
    return CallActionResponse(
        call_id=call_id,
        action_recorded=record,
        updated_status=f"Action {payload.action} logged on {call_id}",
    )
