export type AppMode = 'DEMO' | 'REAL';
export type AnalysisMode = 'REAL' | 'CACHED' | 'SIMULATION';
export type AnalysisProvenance = 'REAL ANALYSIS' | 'CACHED ANALYSIS' | 'SIMULATION';
export type TrustVerdict = 'SAFE' | 'CAUTION' | 'THREAT' | 'INCOMPLETE ANALYSIS';
export type SignalStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE' | 'INCOMPLETE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type EvidenceSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type EvidenceCategory = 'VOICE' | 'IDENTITY' | 'SCAM' | 'PRESSURE' | 'LIVENESS' | 'POLICY';
export type BotStatus = 'IDLE' | 'SPEAKING' | 'PAUSED BY GUARD' | 'TRANSFERRED TO HUMAN';

export type CallStateStage =
  | 'RINGING'
  | 'GREETING'
  | 'IDENTITY_CHECK'
  | 'CHALLENGE'
  | 'CONVERSATION'
  | 'VERDICT';
export type CallActionType =
  | 'ALLOW'
  | 'CHALLENGE'
  | 'PAUSE_BOT'
  | 'TRANSFER_TO_HUMAN'
  | 'BLOCK_CALL'
  | 'STEP_UP_CHALLENGE'
  | 'FREEZE_ACCOUNT'
  | 'ESCALATE_SOC'
  | 'TERMINATE_CALL';

export interface AudioProfile {
  pitch_hz: number;
  jitter_pct: number;
  harmonic_noise_ratio_db: number;
  spectral_flatness: number;
  synthetic_cadence_index: number;
  replay_echo_correlation: number;
}

export interface FlaggedPhrase {
  phrase: string;
  category: string;
  severity: RiskLevel;
  weight: number;
  explanation: string;
}

export interface VoiceAuthenticityResult {
  score: number | null;
  deepfake_probability: number | null;
  model_name: string;
  status: SignalStatus;
  artifacts_detected: string[];
  provenance: AnalysisProvenance;
  detail: string;
}

export interface SpeakerIdentityResult {
  score: number | null;
  match_confidence: number | null;
  claimed_customer_id: string;
  matched_customer_name: string | null;
  enrolled?: boolean;
  model_name: string;
  status: SignalStatus;
  provenance: AnalysisProvenance;
  detail: string;
}

export interface ScamAnalysisResult {
  risk_score: number;
  safety_score: number;
  behavioral_pressure_score: number;
  categories: string[];
  detected_patterns?: string[];
  pressure_tactics: string[];
  flagged_phrases: FlaggedPhrase[];
  engine_used: string;
  provenance: AnalysisProvenance;
  summary: string;
  fallback_reason: string | null;
}

export interface LivenessCheckResult {
  passed: boolean;
  replay_detected: boolean;
  score: number | null;
  status: SignalStatus;
  signal_notes: string;
  provenance: AnalysisProvenance;
}

export interface FactorContribution {
  key: string;
  label: string;
  layer_name: string;
  input_label: string;
  input_value: number | null;
  raw_score: number | null;
  formula: string;
  weight: number;
  weighted_points: number;
  weighted_contribution: number;
  explanation: string;
  evidence: string[];
  status: SignalStatus;
}

export interface CompositeTrustBreakdown {
  composite_score: number | null;
  score_based_verdict: TrustVerdict;
  verdict: TrustVerdict;
  final_decision: TrustVerdict;
  liveness_override_applied: boolean;
  liveness_status: 'PASSED' | 'FAILED' | 'UNAVAILABLE';
  formula_summary: string;
  recommended_action: string;
  policy_override_applied: string | null;
  factor_contributions: FactorContribution[];
  primary_risk_drivers: string[];
}

export interface TranscriptSegment {
  id: string;
  timestamp_sec: number;
  speaker: 'CALLER' | 'AGENT';
  text: string;
  risk_level: RiskLevel;
  triggers: string[];
}

export interface EvidenceEvent {
  id: string;
  timestamp_sec: number;
  category: EvidenceCategory;
  severity: EvidenceSeverity;
  title: string;
  description: string;
  provenance: AnalysisProvenance;
}

export interface CallerProfile {
  caller_phone_id: string;
  claimed_name: string;
  account_ref_masked: string;
  call_duration_sec: number;
  verification_status: string;
}

export interface SegmentRiskChunk {
  chunk_index: number;
  start_sec: number;
  end_sec: number;
  label: string;
  risk_level: RiskLevel;
  score: number | null;
  provenance: AnalysisProvenance;
}

export interface CallActionRecord {
  action: CallActionType;
  operator_note: string;
  executed_at: string;
}

export interface CallActionResponse {
  call_id: string;
  action_recorded: CallActionRecord;
  updated_status: string;
}

export interface CallSession {
  call_id: string;
  created_at: string;
  scenario_id: string | null;
  caller_label: string;
  claimed_customer_id: string;
  caller_profile?: CallerProfile | null;
  call_state?: CallStateStage;
  mode: AppMode;
  analysis_mode?: AnalysisMode;
  overall_provenance: AnalysisProvenance;
  model_status?: Record<string, string>;
  voice_authenticity: VoiceAuthenticityResult;
  speaker_identity: SpeakerIdentityResult;
  scam_analysis: ScamAnalysisResult;
  liveness: LivenessCheckResult;
  trust_breakdown: CompositeTrustBreakdown;
  transcript: TranscriptSegment[];
  evidence_timeline: EvidenceEvent[];
  segment_chunks?: SegmentRiskChunk[];
  audio_profile: AudioProfile;
  actions_taken: CallActionRecord[];
}

export interface UnifiedCallAnalysisResponse {
  call_id: string;
  analysis_mode: AnalysisMode;
  synthetic_probability: number | null;
  voice_authenticity: number | null;
  speaker_match_percentage: number | null;
  scam_risk_score: number;
  behavioral_pressure_score: number;
  trust_score: number | null;
  verdict: TrustVerdict;
  evidence: EvidenceEvent[];
  timestamp: string;
  model_status: Record<string, string>;
  recommended_action: string;
  session: CallSession;
}

export interface ScenarioDefinition {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  caller_name: string;
  claimed_customer_id: string;
  expected_verdict: TrustVerdict;
  summary: string;
  audio_profile: AudioProfile;
  transcript: TranscriptSegment[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  app_mode: AppMode;
  cache_enabled: boolean;
  detectifai_configured: boolean;
  gemini_configured: boolean;
  active_calls_count: number;
  voiceprints_count: number;
  real_mode_note: string;
}

export interface SettingsResponse {
  app_mode: AppMode;
  cache_enabled: boolean;
  bot_guard_enabled: boolean;
  bot_guard_threshold: number;
  detectifai_configured: boolean;
  gemini_configured: boolean;
  detectifai_base_url: string;
  gemini_model: string;
}

export type VerificationStatusType = 'VERIFIED' | 'MISMATCH' | 'UNVERIFIED' | 'UNAVAILABLE';

export interface VoiceprintVerificationEntry {
  verification_id: string;
  verified_at: string;
  match_percentage: number | null;
  result: VerificationStatusType;
  claimed_identity: string;
  verified_identity: string | null;
  provenance: AnalysisProvenance;
  notes: string;
}

export interface VoiceprintRecord {
  voiceprint_id: string;
  customer_id: string;
  customer_name: string;
  account_tier: string;
  enrollment_purpose: string;
  consent_confirmed: boolean;
  consent_timestamp: string;
  retention_policy: string;
  enrolled_at: string;
  revoked_at: string | null;
  sample_duration_sec: number;
  enrollment_source: AnalysisProvenance;
  provider_speaker_ref: string | null;
  provider_operation_id: string | null;
  last_verified_at: string | null;
  last_verification_status: VerificationStatusType;
  last_match_percentage: number | null;
  verification_count: number;
  mismatch_count: number;
  verification_history: VoiceprintVerificationEntry[];
  status: 'ACTIVE' | 'REVOKED';
}

export interface VoiceprintVerifyResponse {
  voiceprint_id: string;
  match_percentage: number | null;
  verification_result: VerificationStatusType;
  claimed_identity: string;
  verified_identity: string | null;
  timestamp: string;
  provenance: AnalysisProvenance;
  notes: string;
}

export type ChallengeCaptureMode =
  | 'LIVE_SPEECH_AUDIO'
  | 'LIVE_SPEECH_ONLY'
  | 'SIMULATED_REPLAY_FAIL'
  | 'SIMULATED_LIVE_PASS'
  | 'TIMEOUT'
  | 'TEXT_INPUT';

export interface ChallengeSession {
  challenge_id: string;
  call_id: string | null;
  customer_id: string;
  phrase: string;
  window_seconds: number;
  created_at: string;
  expires_at: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
  provenance: AnalysisProvenance;
}

export interface ChallengeCheckItem {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ChallengeVerifyResponse {
  challenge_id: string;
  passed: boolean;
  phrase_similarity: number;
  liveness_status: 'PASS' | 'FAIL';
  capture_mode: ChallengeCaptureMode;
  notes: string;
  explanation: string;
  banner_lines: string[];
  checks: ChallengeCheckItem[];
  provenance: AnalysisProvenance;
  updated_call: CallSession | null;
}

export interface CallReportResponse {
  report_id: string;
  call_id: string;
  generated_at: string;
  caller_identity?: string;
  call_duration_sec?: number;
  analysis_mode?: AnalysisMode;
  verdict: TrustVerdict;
  score_based_verdict?: TrustVerdict;
  final_security_decision?: TrustVerdict;
  composite_score: number | null;
  provenance: AnalysisProvenance;
  executive_summary: string;
  recommendations?: string[];
  human_takeover_recorded?: boolean;
  operator_actions?: CallActionRecord[];
  multilingual_verdicts: Record<string, string>;
  call_session: CallSession;
}

export type ThreatVerificationStatus = 'PENDING REVIEW' | 'CONFIRMED THREAT' | 'MITIGATED';
export type ThreatSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ThreatRegistryEntry {
  entry_id: string;
  pattern_name: string;
  anonymous_speaker_ref: string;
  category: string;
  severity: ThreatSeverity;
  detection_date: string;
  evidence_reference: string;
  verification_status: ThreatVerificationStatus;
  institution_scope: string;
  indicators: string[];
  reported_institutions: number;
  last_seen: string;
  provenance: AnalysisProvenance;
}

export interface ThreatRegistryResponse {
  total: number;
  categories: string[];
  entries: ThreatRegistryEntry[];
}
