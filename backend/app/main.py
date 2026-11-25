from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import calls, challenge, health, registry, scenarios, usage, voiceprints, ws_live
from app.core.config import settings
from app.services import secrets_service  # noqa: F401  # loads persisted server-only secrets into settings


app = FastAPI(
    title="AEGIS — The Trust Layer API",
    description="Banking Voice Authentication & Real-Time Call Security Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(scenarios.router, prefix="/api")
app.include_router(calls.router, prefix="/api")
app.include_router(voiceprints.router, prefix="/api")
app.include_router(challenge.router, prefix="/api")
app.include_router(registry.router, prefix="/api")
app.include_router(usage.router, prefix="/api")
app.include_router(ws_live.router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "AEGIS — The Trust Layer",
        "phase": "AEGIS Real-Time Voice Security Platform",
        "health": "/api/health",
    }
