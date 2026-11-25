from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.repositories.json_store import repo
from app.schemas import (
    AnalysisMode,
    CallActionRecord,
    CallActionRequest,
    CallActionResponse,
    CallFeedbackRecord,
    CallFeedbackRequest,
    CallReportResponse,
    CallSession,
    ExecutionMode,
    UnifiedCallAnalysisResponse,
)
from app.services.call_analysis_service import analyze_call_unified
from app.services.report_service import generate_call_report


router = APIRouter(tags=["calls"])


@router.get("/calls", response_model=list[CallSession])
def list_calls(limit: int = 20) -> list[CallSession]:
    return repo.list_calls(limit=limit)


@router.get("/reports")
def list_reports(limit: int = 30) -> list[dict]:
    return repo.list_reports(limit=limit)


@router.get("/calls/current", response_model=CallSession)
def get_current_call() -> CallSession:
    call = repo.get_current_call()
    if not call:
        raise HTTPException(status_code=404, detail="No active or recorded calls yet. Run a scenario first.")
    return call


@router.post("/calls/analyze", response_model=UnifiedCallAnalysisResponse)
async def analyze_call(
    file: UploadFile | None = File(default=None),
    audio: UploadFile | None = File(default=None),
    transcript_text: str = Form(default=""),
    claimed_customer_id: str = Form(default="CUST-4821-MARCUS"),
    claimed_user_id: str | None = Form(default=None),
    caller_label: str = Form(default="Live Call Analysis"),
    analysis_mode: AnalysisMode | None = Form(default=None),
    execution_mode: ExecutionMode | None = Form(default=None),
    duration_hint_sec: float | None = Form(default=None),
    previous_score: float | None = Form(default=None),
) -> UnifiedCallAnalysisResponse:
    """Unified 4-layer analysis endpoint coordinating Aletheia, Eidos, Script & Manipulation, and Fusion."""
    upload = file or audio
    audio_bytes = await upload.read() if upload is not None else None
    filename = (upload.filename or "call_audio.wav") if upload is not None else "no_audio.wav"
    resolved_customer = (claimed_user_id or claimed_customer_id).strip()
    return await analyze_call_unified(
        audio_bytes=audio_bytes,
        filename=filename,
        transcript_text=transcript_text,
        claimed_customer_id=resolved_customer,
        caller_label=caller_label,
        requested_mode=analysis_mode,
        execution_mode=execution_mode,
        duration_hint_sec=duration_hint_sec,
        previous_score=previous_score,
    )


@router.get("/calls/{call_id}", response_model=CallSession)
def get_call(call_id: str) -> CallSession:
    call = repo.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail=f"Call '{call_id}' not found.")
    return call


@router.get("/calls/{call_id}/report", response_model=CallReportResponse)
def get_call_report(call_id: str) -> CallReportResponse:
    call = repo.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail=f"Call '{call_id}' not found.")
    return generate_call_report(call)


@router.post("/calls/{call_id}/feedback", response_model=CallSession)
def submit_call_feedback(call_id: str, payload: CallFeedbackRequest) -> CallSession:
    feedback = CallFeedbackRecord(
        is_scam=payload.is_scam,
        label=payload.label,
        notes=payload.notes,
        submitted_at=datetime.now(timezone.utc).isoformat(),
    )
    updated = repo.set_call_feedback(call_id, feedback)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Call '{call_id}' not found.")
    generate_call_report(updated)
    return updated


@router.post("/calls/{call_id}/action", response_model=CallActionResponse)
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
