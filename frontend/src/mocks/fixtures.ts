// Placeholder values. Replace with real recorded responses from Member A when available.

import type {
  AnalyzeResponse,
  UsageResponse,
  Voiceprint,
} from "../types";

export const S1: AnalyzeResponse = {
  call_id: "CALL-DEMO-S1",
  mode: "DEMO",
  aletheia: {
    status: "done",
    verdict: "real",
    score: 0.03,
    operation_id: "op_ale_s1",
    cost_credits: 10,
  },
  eidos: {
    status: "done",
    decision: "match",
    similarity: 0.91,
    operation_id: "op_eid_s1",
    cost_credits: 25,
  },
  trust_score: {
    value: 93.7,
    band: "SAFE",
    breakdown: {
      voice: 97,
      speaker: 91,
      scam: 94,
      behavioural: 90,
    },
  },
  liveness: {
    status: "not_started",
  },
  decision: "CONTINUE",
  action_label: "Proceed with Call",
  credits_saved: 0,
};

export const S2: AnalyzeResponse = {
  call_id: "CALL-DEMO-S2",
  mode: "DEMO",
  aletheia: {
    status: "done",
    verdict: "fake",
    score: 0.94,
    operation_id: "op_ale_s2",
    cost_credits: 10,
  },
  eidos: {
    status: "skipped",
    skip_reason: "aletheia_fake",
    cost_credits: 0,
  },
  trust_score: {
    value: 31.35,
    band: "THREAT",
    breakdown: {
      voice: 6,
      speaker: 50,
      scam: 35,
      behavioural: 30,
    },
  },
  liveness: {
    status: "not_started",
  },
  decision: "END_CALL",
  action_label: "Terminate Call Immediately",
  credits_saved: 500,
};

export const S3: AnalyzeResponse = {
  call_id: "CALL-DEMO-S3",
  mode: "DEMO",
  aletheia: {
    status: "done",
    verdict: "real",
    score: 0.02,
    operation_id: "op_ale_s3",
    cost_credits: 10,
  },
  eidos: {
    status: "done",
    decision: "match",
    similarity: 0.93,
    operation_id: "op_eid_s3",
    cost_credits: 25,
  },
  trust_score: {
    value: 95.05,
    band: "SAFE",
    breakdown: {
      voice: 98,
      speaker: 93,
      scam: 95,
      behavioural: 92,
    },
  },
  liveness: {
    status: "not_started",
  },
  decision: "CONTINUE",
  action_label: "Proceed with Call",
  credits_saved: 0,
};

export function failLiveness(result: AnalyzeResponse): AnalyzeResponse {
  return {
    ...result,
    liveness: {
      status: "failed",
    },
    trust_score: {
      ...result.trust_score,
      band: "THREAT",
      // value unchanged
    },
    decision: "END_CALL",
    action_label: "Terminate Call (Liveness Failed)",
  };
}

export const S4: AnalyzeResponse = {
  call_id: "CALL-DEMO-S4",
  mode: "DEMO",
  aletheia: {
    status: "done",
    verdict: "real",
    score: 0.05,
    operation_id: "op_ale_s4",
    cost_credits: 10,
  },
  eidos: {
    status: "done",
    decision: "no_match",
    similarity: -0.22,
    operation_id: "op_eid_s4",
    cost_credits: 25,
  },
  trust_score: {
    value: 37.75,
    band: "THREAT",
    breakdown: {
      voice: 95,
      speaker: 10,
      scam: 30,
      behavioural: 25,
    },
  },
  liveness: {
    status: "not_started",
  },
  decision: "STEP_UP",
  action_label: "Request Step-Up Verification",
  credits_saved: 0,
};

export interface ScenarioMeta {
  callerLabel: string;
  claimedUserId: string;
  enrolled: boolean;
  mode: "DEMO";
}

export const scenarioMeta: Record<"S1" | "S2" | "S3" | "S4", ScenarioMeta> = {
  S1: {
    callerLabel: "Marcus Aurelius (S1)",
    claimedUserId: "CUST-4821-MARCUS",
    enrolled: true,
    mode: "DEMO",
  },
  S2: {
    callerLabel: "Valeria Chen Clone (S2)",
    claimedUserId: "CUST-8831-VALERIA",
    enrolled: true,
    mode: "DEMO",
  },
  S3: {
    callerLabel: "Marcus Aurelius Replay (S3)",
    claimedUserId: "CUST-4821-MARCUS",
    enrolled: true,
    mode: "DEMO",
  },
  S4: {
    callerLabel: "Unknown Caller (S4)",
    claimedUserId: "CUST-9011-UNKNOWN",
    enrolled: false,
    mode: "DEMO",
  },
};

export const DEMO_SCENARIO_LIST = [
  { id: "S1", label: "S1: Genuine Customer", data: S1 },
  { id: "S2", label: "S2: Synthetic Speech", data: S2 },
  { id: "S3", label: "S3: Replay / Liveness Probe", data: S3 },
  { id: "S4", label: "S4: Speaker Mismatch", data: S4 },
];

export const INITIAL_VOICEPRINTS: Voiceprint[] = [
  {
    id: "VP-001",
    claimed_user_id: "CUST-4821-MARCUS",
    user_name: "Marcus Aurelius",
    enrolled_at: "2026-11-20T14:32:00Z",
    last_verified_at: "2026-11-25T10:55:04Z",
    status: "active",
    consent_given: true,
    sample_duration_seconds: 24.5,
    notes: "Enrolled in-branch via secure microphone",
  },
  {
    id: "VP-002",
    claimed_user_id: "CUST-8831-VALERIA",
    user_name: "Valeria Chen",
    enrolled_at: "2026-11-22T09:15:00Z",
    last_verified_at: "2026-11-24T16:10:00Z",
    status: "active",
    consent_given: true,
    sample_duration_seconds: 26.2,
    notes: "Verified with branch KYC credentials",
  },
];

export const INITIAL_USAGE: UsageResponse = {
  credit_balance: 4880,
  total_calls_analyzed: 4,
  total_credits_used: 120,
  total_credits_saved: 500,
  aletheia_calls: 4,
  eidos_calls: 3,
  cache_hits: 1,
  operations: [
    {
      id: "op_ale_s2",
      timestamp: "2026-11-25T11:20:12Z",
      service: "aletheia",
      cost_credits: 10,
      mode: "DEMO",
      call_id: "CALL-DEMO-S2",
      cached: false,
      status: "done",
    },
    {
      id: "op_eid_s1",
      timestamp: "2026-11-25T10:55:04Z",
      service: "eidos",
      cost_credits: 25,
      mode: "DEMO",
      call_id: "CALL-DEMO-S1",
      cached: false,
      status: "done",
    },
  ],
};
