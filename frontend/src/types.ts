export type AppMode = "DEMO" | "REAL";
export type ExecutionMode = "LIVE" | "DEMO" | "CACHED";
export type AnalysisMode = "REAL" | "CACHED" | "SIMULATION";
export type AnalysisProvenance = "REAL ANALYSIS" | "CACHED ANALYSIS" | "SIMULATION";
export type TrustVerdict = "SAFE" | "CAUTION" | "THREAT" | "INCOMPLETE ANALYSIS";
export type FusionBand = "SAFE" | "REVIEW" | "THREAT" | "INCOMPLETE ANALYSIS";
export type CallDecision = "ALLOW" | "STEP_UP" | "BLOCK" | "END_CALL" | "INCOMPLETE ANALYSIS";
export type SignalStatus = "PASS" | "WARN" | "FAIL" | "UNAVAILABLE" | "INCOMPLETE" | "SKIPPED" | "skipped" | "error";
export type LayerRunStatus = "queued" | "running" | "done" | "error" | "skipped" | "unavailable";
export type ManipulationCategory = "urgency" | "secrecy" | "authority" | "threat";
export type GuardState = "IDLE" | "SPEAKING" | "PAUSED_BY_GUARD" | "TRANSFERRED_TO_HUMAN";

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
  severity: "LOW" | "MEDIUM" | "HIGH";
  weight: number;
  explanation: string;
}

export interface VoiceAuthenticityResult {
  score: number | null;
  deepfake_probability: number | null;
  verdict?: string | null;
  model_name: string;
  model_version?: string;
  status: SignalStatus;
  artifacts_detected: string[];
  provenance: AnalysisProvenance;
  detail: string;
  cache_hit: boolean;
  request_id?: string | null;
  operation_id?: string | null;
  cost_credits?: number;
  latency_ms?: number | null;
  error_code?: string | null;
  http_status?: number | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface SpeakerIdentityResult {
  score: number | null;
  match_confidence: number | null;
  claimed_customer_id: string;
  matched_customer_name?: string | null;
  provider_speaker_id?: string | null;
  decision?: string | null;
  enrolled: boolean;
  skip_reason?: string | null;
  similarity_tier?: string | null;
  model_name: string;
  model_version?: string;
  status: SignalStatus;
  provenance: AnalysisProvenance;
  detail: string;
  cache_hit: boolean;
  request_id?: string | null;
  operation_id?: string | null;
  cost_credits?: number;
  latency_ms?: number | null;
  error_code?: string | null;
  http_status?: number | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface ManipulationMarker {
  category: ManipulationCategory;
  phrase: string;
  excerpt: string;
  timestamp_sec: number;
  weight: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export interface ManipulationAnalysisResult {
  score: number | null;
  safety_score: number | null;
  status?: SignalStatus;
  model_version: string;
  latency_ms?: number | null;
  category_counts: Record<ManipulationCategory | string, number>;
  markers: ManipulationMarker[];
  sparkline: number[];
  provenance: AnalysisProvenance;
  raw_payload?: Record<string, unknown> | null;
}

export interface ScamAnalysisResult {
  risk_score: number | null;
  safety_score: number | null;
  behavioral_pressure_score: number | null;
  status?: SignalStatus;
  categories: string[];
  detected_patterns: string[];
  pressure_tactics: string[];
  flagged_phrases: FlaggedPhrase[];
  engine_used: string;
  model_version?: string;
  latency_ms?: number | null;
  provenance: AnalysisProvenance;
  summary: string;
  recommended_action: string;
  fallback_used: boolean;
  fallback_reason?: string | null;
  cache_hit: boolean;
  operation_id?: string | null;
  cost_credits?: number;
  raw_payload?: Record<string, unknown> | null;
}

export interface LivenessCheckResult {
  passed: boolean;
  replay_detected: boolean;
  score: number | null;
  status: SignalStatus;
  signal_notes: string;
  provenance: AnalysisProvenance;
  latency_ms?: number | null;
  model_version?: string;
  raw_payload?: Record<string, unknown> | null;
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
  raw_composite_score?: number | null;
  ema_applied?: boolean;
  previous_smoothed_score?: number | null;
  score_based_verdict: TrustVerdict;
  verdict: TrustVerdict;
  final_decision: TrustVerdict;
  band: FusionBand;
  decision: CallDecision;
  decision_reason?: string | null;
  liveness_override_applied: boolean;
  voice_clone_override_applied?: boolean;
  conflict_overrides?: string[];
  weights_used?: Record<string, number>;
  liveness_status: "PASSED" | "FAILED" | "UNAVAILABLE";
  formula_summary: string;
  recommended_action: string;
  policy_override_applied?: string | null;
  factor_contributions: FactorContribution[];
  primary_risk_drivers: string[];
}

export interface TranscriptSegment {
  id: string;
  timestamp_sec: number;
  speaker: "CALLER" | "AGENT";
  text: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  triggers: string[];
}

export interface EvidenceEvent {
  id: string;
  timestamp_sec: number;
  category: "VOICE" | "IDENTITY" | "SCAM" | "PRESSURE" | "LIVENESS" | "POLICY";
  severity: "INFO" | "WARNING" | "CRITICAL";
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
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  score: number | null;
  provenance: AnalysisProvenance;
}

export interface CallActionRecord {
  action: string;
  operator_note: string;
  executed_at: string;
}

export interface CallFeedbackRecord {
  is_scam: boolean | null;
  label: "SCAM" | "LEGITIMATE" | "UNCERTAIN";
  notes: string;
  submitted_at: string;
}

export interface CallSession {
  call_id: string;
  created_at: string;
  timestamp: string;
  scenario_id?: string | null;
  caller_label: string;
  claimed_customer_id: string;
  caller_profile?: CallerProfile | null;
  call_state: string;
  mode: AppMode;
  execution_mode: ExecutionMode;
  analysis_mode: AnalysisMode;
  overall_provenance: AnalysisProvenance;
  synthetic_probability: number | null;
  voice_authenticity_score: number | null;
  speaker_match_percentage: number | null;
  scam_risk_score: number | null;
  behavioral_pressure_score: number | null;
  trust_score: number | null;
  verdict: TrustVerdict;
  band: FusionBand;
  decision: CallDecision;
  decision_reason?: string | null;
  model_status: Record<string, string>;
  voice_authenticity: VoiceAuthenticityResult;
  speaker_identity: SpeakerIdentityResult;
  scam_analysis: ScamAnalysisResult;
  manipulation_analysis: ManipulationAnalysisResult;
  liveness: LivenessCheckResult;
  trust_breakdown: CompositeTrustBreakdown;
  transcript: TranscriptSegment[];
  evidence_timeline: EvidenceEvent[];
  segment_chunks: SegmentRiskChunk[];
  audio_profile: AudioProfile;
  actions_taken: CallActionRecord[];
  feedback?: CallFeedbackRecord | null;
  credits_saved: number;
}

export interface UnifiedCallAnalysisResponse {
  call_id: string;
  execution_mode: ExecutionMode;
  analysis_mode: AnalysisMode;
  synthetic_probability: number | null;
  voice_authenticity: number | null;
  speaker_match_percentage: number | null;
  scam_risk_score: number | null;
  behavioral_pressure_score: number | null;
  trust_score: number | null;
  verdict: TrustVerdict;
  band: FusionBand;
  decision: CallDecision;
  decision_reason?: string | null;
  evidence: EvidenceEvent[];
  timestamp: string;
  model_status: Record<string, string>;
  recommended_action: string;
  credits_saved: number;
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
}

export interface VoiceprintVerificationEntry {
  verification_id: string;
  verified_at: string;
  match_percentage: number | null;
  result: "VERIFIED" | "MISMATCH" | "UNVERIFIED" | "UNAVAILABLE";
  claimed_identity: string;
  verified_identity?: string | null;
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
  revoked_at?: string | null;
  sample_duration_sec: number;
  enrollment_source: AnalysisProvenance;
  provider_speaker_id?: string | null;
  provider_speaker_ref?: string | null;
  provider_operation_id?: string | null;
  credits_used?: number | null;
  reconciled?: boolean;
  last_verified_at?: string | null;
  last_verification_status: string;
  last_match_percentage?: number | null;
  verification_count: number;
  mismatch_count: number;
  verification_history: VoiceprintVerificationEntry[];
  status: "ACTIVE" | "REVOKED";
}

export interface VoiceprintVerifyResponse {
  voiceprint_id: string;
  match_percentage: number | null;
  verification_result: "VERIFIED" | "MISMATCH" | "UNVERIFIED" | "UNAVAILABLE";
  claimed_identity: string;
  verified_identity?: string | null;
  timestamp: string;
  provenance: AnalysisProvenance;
  notes: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  app_mode: AppMode;
  cache_enabled: boolean;
  detectifai_configured: boolean;
  groq_configured: boolean;
  detectifai?: "SET" | "NOT SET";
  groq?: "SET" | "NOT SET";
  active_calls_count: number;
  voiceprints_count: number;
  real_mode_note: string;
  backend_active?: boolean;
}

export interface SettingsResponse {
  app_mode: AppMode;
  cache_enabled: boolean;
  bot_guard_enabled: boolean;
  bot_guard_threshold: number;
  layer_weights: Record<string, number>;
  safe_threshold: number;
  review_threshold: number;
  ema_alpha: number;
  language: string;
  detectifai_configured: boolean;
  groq_configured: boolean;
  detectifai_base_url: string;
  groq_stt_model: string;
  groq_llm_model: string;
}

export interface SecretsStatusResponse {
  detectifai_configured: boolean;
  groq_configured: boolean;
  detectif_key_hint: string;
  groq_key_hint: string;
  detectifai_base_url: string;
  groq_stt_model: string;
  groq_llm_model: string;
}

export interface CreditsResponse {
  available: number | null;
  reserved: number | null;
  currency: string;
  configured: boolean;
  latency_ms: number;
  error?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface OperationLedgerEntry {
  operation_id: string;
  call_id: string;
  service: "aletheia" | "eidos" | "groq" | "enroll" | "challenge" | "pipeline";
  endpoint: string;
  mode: "FRESH" | "CACHED" | "DEMO";
  status: string;
  cost_credits: number;
  latency_ms: number;
  timestamp: string;
  cached: boolean;
}

export interface ProviderReconciliation {
  status: "RECONCILED" | "PARTIAL" | "UNAVAILABLE";
  matched_count: number;
  unmatched_local_count: number;
  provider_record_count: number;
  provider_credits_total: number;
  matched_operation_ids: string[];
  note: string;
}

export interface UsageSummaryResponse {
  credit_balance: number | null;
  credit_balance_error?: string | null;
  total_calls_analyzed: number;
  total_credits_used: number;
  total_credits_saved: number;
  burn_rate_per_call: number;
  aletheia_calls: number;
  eidos_calls: number;
  groq_calls: number;
  cache_hits: number;
  fresh_calls: number;
  operations: OperationLedgerEntry[];
  provider_usage_raw?: Record<string, unknown> | null;
  reconciliation?: ProviderReconciliation;
}

export interface ChallengeSession {
  challenge_id: string;
  call_id?: string | null;
  customer_id: string;
  phrase: string;
  window_seconds: number;
  created_at: string;
  expires_at: string;
  status: "PENDING" | "PASSED" | "FAILED";
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
  status?: "passed" | "failed" | "incomplete";
  reason?: string | null;
  phrase_similarity: number;
  liveness_status: "PASS" | "FAIL" | "INCOMPLETE";
  capture_mode: string;
  notes: string;
  explanation: string;
  banner_lines: string[];
  checks: ChallengeCheckItem[];
  provenance: AnalysisProvenance;
  updated_call?: CallSession | null;
}

export interface CallReportResponse {
  report_id: string;
  call_id: string;
  generated_at: string;
  caller_identity: string;
  call_duration_sec: number;
  analysis_mode: AnalysisMode;
  verdict: TrustVerdict;
  score_based_verdict: TrustVerdict;
  final_security_decision: TrustVerdict;
  composite_score: number | null;
  provenance: AnalysisProvenance;
  executive_summary: string;
  recommendations: string[];
  human_takeover_recorded: boolean;
  operator_actions: CallActionRecord[];
  multilingual_verdicts: Record<string, string>;
  call_session: CallSession;
}

export interface ThreatRegistryEntry {
  entry_id: string;
  pattern_name: string;
  anonymous_speaker_ref: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detection_date: string;
  evidence_reference: string;
  verification_status: "PENDING REVIEW" | "CONFIRMED THREAT" | "MITIGATED";
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

export interface ApiError {
  code: string;
  message: string;
}
