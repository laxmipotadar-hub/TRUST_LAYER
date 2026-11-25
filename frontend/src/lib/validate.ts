import type {
  AnalyzeResponse,
  ChallengeStartResponse,
  ChallengeVerifyResponse,
  UsageResponse,
  Voiceprint,
} from "../types";

export function isValidAnalyzeResponse(data: unknown): data is AnalyzeResponse {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  if (typeof d.call_id !== "string") return false;
  if (d.mode !== "REAL" && d.mode !== "CACHED" && d.mode !== "DEMO") return false;
  if (d.decision !== "CONTINUE" && d.decision !== "STEP_UP" && d.decision !== "END_CALL") return false;
  if (typeof d.action_label !== "string") return false;
  if (typeof d.credits_saved !== "number") return false;

  const ale = d.aletheia as Record<string, unknown> | undefined;
  if (
    !ale ||
    typeof ale !== "object" ||
    (ale.status !== "done" && ale.status !== "error") ||
    (ale.verdict !== "real" && ale.verdict !== "fake") ||
    typeof ale.score !== "number" ||
    typeof ale.operation_id !== "string" ||
    typeof ale.cost_credits !== "number"
  ) {
    return false;
  }

  const eid = d.eidos as Record<string, unknown> | undefined;
  if (!eid || typeof eid !== "object" || (eid.status !== "done" && eid.status !== "skipped" && eid.status !== "error")) {
    return false;
  }

  const ts = d.trust_score as Record<string, unknown> | undefined;
  if (
    !ts ||
    typeof ts !== "object" ||
    typeof ts.value !== "number" ||
    (ts.band !== "SAFE" && ts.band !== "CAUTION" && ts.band !== "THREAT")
  ) {
    return false;
  }

  const bd = ts.breakdown as Record<string, unknown> | undefined;
  if (
    !bd ||
    typeof bd !== "object" ||
    typeof bd.voice !== "number" ||
    typeof bd.speaker !== "number" ||
    typeof bd.scam !== "number" ||
    typeof bd.behavioural !== "number"
  ) {
    return false;
  }

  const liv = d.liveness as Record<string, unknown> | undefined;
  if (
    !liv ||
    typeof liv !== "object" ||
    (liv.status !== "not_started" && liv.status !== "passed" && liv.status !== "failed")
  ) {
    return false;
  }

  return true;
}

export function isValidVoiceprintList(data: unknown): data is Voiceprint[] {
  if (!Array.isArray(data)) return false;
  return data.every((item) => {
    if (!item || typeof item !== "object") return false;
    const v = item as Record<string, unknown>;
    return (
      typeof v.id === "string" &&
      typeof v.claimed_user_id === "string" &&
      typeof v.user_name === "string" &&
      typeof v.enrolled_at === "string" &&
      typeof v.consent_given === "boolean"
    );
  });
}

export function isValidUsageResponse(data: unknown): data is UsageResponse {
  if (!data || typeof data !== "object") return false;
  const u = data as Record<string, unknown>;
  return (
    typeof u.total_calls_analyzed === "number" &&
    typeof u.total_credits_used === "number" &&
    typeof u.total_credits_saved === "number" &&
    Array.isArray(u.operations)
  );
}

export function isValidChallengeStart(data: unknown): data is ChallengeStartResponse {
  if (!data || typeof data !== "object") return false;
  const c = data as Record<string, unknown>;
  return (
    typeof c.challenge_id === "string" &&
    typeof c.nonce === "string" &&
    typeof c.phrase === "string" &&
    typeof c.expires_in_seconds === "number"
  );
}

export function isValidChallengeVerify(data: unknown): data is ChallengeVerifyResponse {
  if (!data || typeof data !== "object") return false;
  const c = data as Record<string, unknown>;
  return c.status === "passed" || c.status === "failed";
}
