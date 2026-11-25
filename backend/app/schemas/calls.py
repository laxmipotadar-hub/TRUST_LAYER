from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.common import (
    AnalysisMode,
    AnalysisProvenance,
    AppMode,
    CallActionType,
    CallStateStage,
    EvidenceCategory,
    EvidenceSeverity,
    RiskLevel,
    SignalStatus,
    TrustVerdict,
)


class AudioProfile(BaseModel):
    pitch_hz: float = Field(..., ge=50, le=500)
    jitter_pct: float = Field(..., ge=0, le=20)
    harmonic_noise_ratio_db: float = Field(..., ge=0, le=40)
    spectral_flatness: float = Field(..., ge=0, le=1)
    synthetic_cadence_index: float = Field(..., ge=0, le=1)
    replay_echo_correlation: float = Field(..., ge=0, le=1)


class FlaggedPhrase(BaseModel):
    phrase: str
    category: str
    severity: RiskLevel
    weight: int = Field(..., ge=1, le=50)
    explanation: str


class VoiceAuthenticityResult(BaseModel):
    score: Optional[float] = Field(default=None, ge=0, le=100)
    deepfake_probability: Optional[float] = Field(default=None, ge=0, le=1)
    model_name: str = "DetectifAI Aletheia"
    status: SignalStatus
    artifacts_detected: list[str] = Field(default_factory=list)
    provenance: AnalysisProvenance
    detail: str
    cache_hit: bool = False
    request_id: Optional[str] = None


class SpeakerIdentityResult(BaseModel):
    score: Optional[float] = Field(default=None, ge=0, le=100)
    match_confidence: Optional[float] = Field(default=None, ge=-1, le=1)
    claimed_customer_id: str
    matched_customer_name: Optional[str] = None
    enrolled: bool = True
    model_name: str = "DetectifAI Eidos"
    status: SignalStatus
    provenance: AnalysisProvenance
    detail: str
    cache_hit: bool = False
    request_id: Optional[str] = None


class ScamAnalysisResult(BaseModel):
    risk_score: float = Field(..., ge=0, le=100)
    safety_score: float = Field(..., ge=0, le=100)
    behavioral_pressure_score: float = Field(..., ge=0, le=100)
    categories: list[str] = Field(default_factory=list)
    detected_patterns: list[str] = Field(default_factory=list)
    pressure_tactics: list[str] = Field(default_factory=list)
    flagged_phrases: list[FlaggedPhrase] = Field(default_factory=list)
    engine_used: str
    provenance: AnalysisProvenance
    summary: str
    recommended_action: str = ""
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    cache_hit: bool = False


class LivenessCheckResult(BaseModel):
    passed: bool
    replay_detected: bool
    score: Optional[float] = Field(default=None, ge=0, le=100)
    status: SignalStatus
    signal_notes: str
    provenance: AnalysisProvenance


class FactorContribution(BaseModel):
    key: str
    label: str
    layer_name: str = ""
    input_label: str = ""
    input_value: Optional[float] = None
    raw_score: Optional[float] = Field(default=None, ge=0, le=100)
    formula: str = ""
    weight: float = Field(..., ge=0, le=1)
    weighted_points: float = Field(..., ge=0, le=100)
    weighted_contribution: float = Field(default=0.0, ge=0, le=100)
    explanation: str = ""
    evidence: list[str] = Field(default_factory=list)
    status: SignalStatus


class CompositeTrustBreakdown(BaseModel):
    composite_score: Optional[float] = Field(default=None, ge=0, le=100)
    score_based_verdict: TrustVerdict = "INCOMPLETE ANALYSIS"
    verdict: TrustVerdict
    final_decision: TrustVerdict = "INCOMPLETE ANALYSIS"
    liveness_override_applied: bool = False
    liveness_status: Literal["PASSED", "FAILED", "UNAVAILABLE"] = "PASSED"
    formula_summary: str = (
        "TRUST SCORE = (Voice Authenticity × 0.35) + (Speaker Match × 0.30) "
        "+ (Scam Safety × 0.20) + (Behavioral Safety × 0.15)"
    )
    recommended_action: str
    policy_override_applied: Optional[str] = None
    factor_contributions: list[FactorContribution]
    primary_risk_drivers: list[str] = Field(default_factory=list)


class TranscriptSegment(BaseModel):
    id: str
    timestamp_sec: float = Field(..., ge=0)
    speaker: Literal["CALLER", "AGENT"]
    text: str
    risk_level: RiskLevel = "LOW"
    triggers: list[str] = Field(default_factory=list)


class EvidenceEvent(BaseModel):
    id: str
    timestamp_sec: float = Field(..., ge=0)
    category: EvidenceCategory
    severity: EvidenceSeverity
    title: str
    description: str
    provenance: AnalysisProvenance


class CallerProfile(BaseModel):
    caller_phone_id: str
    claimed_name: str
    account_ref_masked: str
    call_duration_sec: float
    verification_status: str


class SegmentRiskChunk(BaseModel):
    chunk_index: int
    start_sec: float
    end_sec: float
    label: str
    risk_level: RiskLevel
    score: Optional[float] = None
    provenance: AnalysisProvenance


class CallActionRecord(BaseModel):
    action: CallActionType
    operator_note: str = ""
    executed_at: str


class CallSession(BaseModel):
    call_id: str
    created_at: str
    timestamp: str = ""
    scenario_id: Optional[str] = None
    caller_label: str
    claimed_customer_id: str
    caller_profile: Optional[CallerProfile] = None
    call_state: CallStateStage = "VERDICT"
    mode: AppMode
    analysis_mode: AnalysisMode = "CACHED"
    overall_provenance: AnalysisProvenance
    synthetic_probability: Optional[float] = None
    voice_authenticity_score: Optional[float] = None
    speaker_match_percentage: Optional[float] = None
    scam_risk_score: float = 0.0
    behavioral_pressure_score: float = 0.0
    trust_score: Optional[float] = None
    verdict: TrustVerdict = "INCOMPLETE ANALYSIS"
    model_status: dict[str, str] = Field(default_factory=dict)
    voice_authenticity: VoiceAuthenticityResult
    speaker_identity: SpeakerIdentityResult
    scam_analysis: ScamAnalysisResult
    liveness: LivenessCheckResult
    trust_breakdown: CompositeTrustBreakdown
    transcript: list[TranscriptSegment]
    evidence_timeline: list[EvidenceEvent]
    segment_chunks: list[SegmentRiskChunk] = Field(default_factory=list)
    audio_profile: AudioProfile
    actions_taken: list[CallActionRecord] = Field(default_factory=list)


class UnifiedCallAnalysisResponse(BaseModel):
    call_id: str
    analysis_mode: AnalysisMode
    synthetic_probability: Optional[float] = None
    voice_authenticity: Optional[float] = None
    speaker_match_percentage: Optional[float] = None
    scam_risk_score: float
    behavioral_pressure_score: float
    trust_score: Optional[float] = None
    verdict: TrustVerdict
    evidence: list[EvidenceEvent]
    timestamp: str
    model_status: dict[str, str]
    recommended_action: str
    session: CallSession


class CallActionRequest(BaseModel):
    action: CallActionType
    operator_note: str = Field(default="", max_length=500)


class CallActionResponse(BaseModel):
    call_id: str
    action_recorded: CallActionRecord
    updated_status: str


class CallReportResponse(BaseModel):
    report_id: str
    call_id: str
    generated_at: str
    caller_identity: str = ""
    call_duration_sec: float = 15.0
    analysis_mode: AnalysisMode = "CACHED"
    verdict: TrustVerdict
    score_based_verdict: TrustVerdict = "INCOMPLETE ANALYSIS"
    final_security_decision: TrustVerdict = "INCOMPLETE ANALYSIS"
    composite_score: Optional[float]
    provenance: AnalysisProvenance
    executive_summary: str
    recommendations: list[str] = Field(default_factory=list)
    human_takeover_recorded: bool = False
    operator_actions: list[CallActionRecord] = Field(default_factory=list)
    multilingual_verdicts: dict[str, str]
    call_session: CallSession
