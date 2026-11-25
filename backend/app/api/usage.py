from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

from app.schemas.usage import CreditsResponse, UsageSummaryResponse
from app.services.usage_service import build_usage_summary, export_ledger_csv, fetch_live_credits


router = APIRouter(tags=["usage"])


@router.get("/credits", response_model=CreditsResponse)
async def get_credits() -> CreditsResponse:
    return await fetch_live_credits()


@router.get("/usage", response_model=UsageSummaryResponse)
async def get_usage(include_provider: bool = True) -> UsageSummaryResponse:
    return await build_usage_summary(include_provider=include_provider)


@router.get("/usage/export.csv")
def export_usage_csv() -> Response:
    csv_body = export_ledger_csv()
    return Response(
        content=csv_body,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aegis_operations_ledger.csv"},
    )
