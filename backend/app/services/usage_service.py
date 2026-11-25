from __future__ import annotations

import csv
import io
import time
import httpx

from app.core.config import settings
from app.repositories.json_store import repo
from app.schemas.usage import CreditsResponse, UsageSummaryResponse
from app.services.ledger_service import read_ledger


async def fetch_live_credits() -> CreditsResponse:
    """Query DetectifAI GET /v1/credits strictly from backend with server key."""
    if not settings.detectifai_configured:
        return CreditsResponse(
            available=None,
            reserved=None,
            configured=False,
            latency_ms=0.0,
            error="DETECTIF_API_KEY not configured on server.",
        )

    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/credits"
    headers = {"Authorization": f"Bearer {settings.detectif_api_key}"}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            if resp.status_code >= 400:
                return CreditsResponse(
                    configured=True,
                    latency_ms=latency_ms,
                    error=f"DetectifAI credits endpoint returned HTTP {resp.status_code}.",
                )
            body = resp.json()
            available = body.get("available")
            if available is None and isinstance(body.get("result"), dict):
                available = body["result"].get("available")
            reserved = body.get("reserved")
            if reserved is None and isinstance(body.get("result"), dict):
                reserved = body["result"].get("reserved")
            return CreditsResponse(
                available=float(available) if available is not None else None,
                reserved=float(reserved) if reserved is not None else None,
                configured=True,
                latency_ms=latency_ms,
                raw_payload=body if isinstance(body, dict) else None,
            )
    except Exception as exc:
        return CreditsResponse(
            configured=True,
            latency_ms=round((time.perf_counter() - t0) * 1000.0, 2),
            error=f"DetectifAI credits request failed: {exc.__class__.__name__}",
        )


async def fetch_provider_usage_snapshot() -> dict | None:
    if not settings.detectifai_configured:
        return None
    url = f"{settings.detectif_api_base_url.rstrip('/')}/v1/usage"
    headers = {"Authorization": f"Bearer {settings.detectif_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params={"limit": 20})
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, dict) else None
    except Exception:
        return None
    return None


async def build_usage_summary(include_provider: bool = True) -> UsageSummaryResponse:
    entries = read_ledger(limit=250)
    calls = repo.list_calls(limit=100)
    credits_res = await fetch_live_credits() if include_provider else CreditsResponse(configured=settings.detectifai_configured)
    provider_usage = await fetch_provider_usage_snapshot() if include_provider else None

    total_used = round(sum(e.cost_credits for e in entries), 2)
    total_saved = round(sum(float(c.credits_saved or 0.0) for c in calls), 2)
    aletheia_calls = sum(1 for e in entries if e.service == "aletheia" and not e.cached)
    eidos_calls = sum(1 for e in entries if e.service == "eidos" and not e.cached)
    gemini_calls = sum(1 for e in entries if e.service == "gemini" and not e.cached)
    cache_hits = sum(1 for e in entries if e.cached or e.mode == "CACHED")
    fresh_calls = sum(1 for e in entries if e.mode == "FRESH")
    call_count = max(len(calls), fresh_calls)
    burn_rate = round(total_used / call_count, 2) if call_count > 0 else 0.0

    return UsageSummaryResponse(
        credit_balance=credits_res.available,
        credit_balance_error=credits_res.error,
        total_calls_analyzed=len(calls),
        total_credits_used=total_used,
        total_credits_saved=total_saved,
        burn_rate_per_call=burn_rate,
        aletheia_calls=aletheia_calls,
        eidos_calls=eidos_calls,
        gemini_calls=gemini_calls,
        cache_hits=cache_hits,
        fresh_calls=fresh_calls,
        operations=entries,
        provider_usage_raw=provider_usage,
    )


def export_ledger_csv() -> str:
    entries = read_ledger(limit=500)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["operation_id", "call_id", "service", "endpoint", "mode", "status", "cost_credits", "latency_ms", "cached", "timestamp"])
    for e in entries:
        writer.writerow([e.operation_id, e.call_id, e.service, e.endpoint, e.mode, e.status, e.cost_credits, e.latency_ms, e.cached, e.timestamp])
    return buf.getvalue()
