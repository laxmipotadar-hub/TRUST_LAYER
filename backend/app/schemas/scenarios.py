from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.calls import AudioProfile, TranscriptSegment
from app.schemas.common import TrustVerdict


class ScenarioDefinition(BaseModel):
    id: str
    code: str
    title: str
    subtitle: str
    caller_name: str
    claimed_customer_id: str
    expected_verdict: TrustVerdict
    summary: str
    audio_profile: AudioProfile
    transcript: list[TranscriptSegment]


class ScenarioRunRequest(BaseModel):
    scenario_id: str = Field(..., pattern="^S[1-4]$")
