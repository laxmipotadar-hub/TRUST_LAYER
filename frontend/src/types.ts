export type ModeType = "REAL" | "CACHED" | "DEMO";

export type DecisionType = "CONTINUE" | "STEP_UP" | "END_CALL";

export type AletheiaVerdict = "real" | "fake";

export type EidosDecision = "match" | "no_match";

export type LivenessStatus = "not_started" | "passed" | "failed";

export type TrustBand = "SAFE" | "CAUTION" | "THREAT";

export interface AletheiaResult {
  status: "done" | "error";
  verdict: AletheiaVerdict;
  score: number; // 0 to 1 (synthetic likelihood)
  operation_id: string;
  cost_credits: number;
}

export interface EidosResult {
  status: "done" | "skipped" | "error";
  decision?: EidosDecision;
  similarity?: number; // scale -1 to 1
  operation_id?: string;
  cost_credits?: number;
  skip_reason?: string;
}

export interface TrustScoreBreakdown {
  voice: number;
  speaker: number;
  scam: number;
  behavioural: number;
}

export interface TrustScore {
  value: number; // e.g. 93.7
  band: TrustBand;
  breakdown: TrustScoreBreakdown;
}

export interface LivenessResult {
  status: LivenessStatus;
}

export interface AnalyzeResponse {
  call_id: string;
  mode: ModeType;
  aletheia: AletheiaResult;
  eidos: EidosResult;
  trust_score: TrustScore;
  liveness: LivenessResult;
  decision: DecisionType;
  action_label: string;
  credits_saved: number;
}

export type AnalyzeCallResponse = AnalyzeResponse;

export interface Voiceprint {
  id: string;
  claimed_user_id: string;
  user_name: string;
  enrolled_at: string;
  last_verified_at?: string;
  status?: "active" | "revoked";
  consent_given: boolean;
  sample_duration_seconds?: number;
  notes?: string;
}

export interface HealthResponse {
  status: string;
  mode: ModeType;
  version: string;
  timestamp: string;
  backend_active?: boolean;
}

export interface UsageOperation {
  id: string;
  timestamp: string;
  service: "aletheia" | "eidos" | "pipeline";
  cost_credits: number;
  mode: ModeType;
  call_id?: string;
  cached?: boolean;
  status: "done" | "error" | "skipped";
}

export interface UsageResponse {
  credit_balance?: number | null;
  total_calls_analyzed: number;
  total_credits_used: number;
  total_credits_saved: number;
  aletheia_calls: number;
  eidos_calls: number;
  cache_hits: number;
  operations: UsageOperation[];
}

export interface ChallengeStartResponse {
  challenge_id: string;
  nonce: string;
  phrase: string;
  expires_in_seconds: number;
}

export interface ChallengeVerifyResponse {
  status: "passed" | "failed";
  decision?: DecisionType;
  challenge_id?: string;
  passed?: boolean;
  score?: number;
  latency_ms?: number;
  detail?: string;
}

export type CallEventType = "analysis" | "alert" | "action" | "guard" | "challenge";

export interface CallEvent {
  id: string;
  ts: string; // ISO
  type: CallEventType;
  message: string;
}

export type GuardState =
  | "IDLE"
  | "SPEAKING"
  | "PAUSED_BY_GUARD"
  | "TRANSFERRED_TO_HUMAN";

export interface ReportRecord {
  call_id: string;
  saved_at: string;
  caller_label: string;
  analysis: AnalyzeResponse;
  events: CallEvent[];
  challenge?: {
    status: "passed" | "failed" | "incomplete";
  };
}

export interface CallReportResponse {
  call_id: string;
  generated_at: string;
  decision: DecisionType;
  analysis: AnalyzeResponse;
  transcript?: string;
  caller_info: {
    claimed_user_id: string;
    phone_number?: string;
    caller_name?: string;
  };
  recommendations: string[];
}

export interface ApiError {
  code: string;
  message: string;
}
