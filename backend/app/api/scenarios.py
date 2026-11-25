from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.scenarios.catalog import SCENARIOS
from app.schemas import CallSession, ScenarioDefinition, ScenarioRunRequest
from app.services.call_analysis_service import analyze_scenario_call


router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioDefinition])
def list_scenarios() -> list[ScenarioDefinition]:
    return list(SCENARIOS.values())


@router.post("/run", response_model=CallSession)
async def run_scenario(payload: ScenarioRunRequest) -> CallSession:
    if payload.scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{payload.scenario_id}' not found.")
    unified = await analyze_scenario_call(payload.scenario_id)
    return unified.session
