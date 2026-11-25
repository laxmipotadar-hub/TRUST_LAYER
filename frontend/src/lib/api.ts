import type {
  AnalyzeResponse,
  ApiError,
  CallReportResponse,
  ChallengeStartResponse,
  ChallengeVerifyResponse,
  HealthResponse,
  UsageResponse,
  Voiceprint,
} from "../types";
import { S1, S2, S3, S4, INITIAL_USAGE, INITIAL_VOICEPRINTS } from "../mocks/fixtures";
import { getError } from "../copy";
import {
  isValidAnalyzeResponse,
  isValidChallengeStart,
  isValidChallengeVerify,
  isValidUsageResponse,
  isValidVoiceprintList,
} from "./validate";

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const API_MODE = (import.meta.env.VITE_API_MODE || "mock").toLowerCase();

function apiUrl(path: string): string {
  if (!RAW_BASE) return `/api${path}`;
  return RAW_BASE.endsWith("/api") ? `${RAW_BASE}${path}` : `${RAW_BASE}/api${path}`;
}

export interface ExtendedApiError extends ApiError {
  rawPayload?: unknown;
}

export interface ExtendedHealthResponse extends HealthResponse {
  key_not_set?: boolean;
}

// Runtime fallback flag when live backend is unreachable
let forceDemoFallback = false;

export function setDemoFallback(enabled: boolean) {
  forceDemoFallback = enabled;
}

export function isUsingMock(): boolean {
  return API_MODE !== "live" || forceDemoFallback;
}

const mockAnalysisCache = new Set<string>();
const mockVoiceprints: Voiceprint[] = [...INITIAL_VOICEPRINTS];
const mockUsage: UsageResponse = { ...INITIAL_USAGE };

export function normalizeError(err: unknown): ExtendedApiError {
  if (err && typeof err === "object") {
    const maybe = err as {
      code?: unknown;
      message?: unknown;
      rawPayload?: unknown;
      error?: { code?: unknown; message?: unknown };
    };
    if (typeof maybe.code === "string" && typeof maybe.message === "string") {
      return {
        code: maybe.code,
        message: getError(maybe.code, maybe.message),
        rawPayload: maybe.rawPayload,
      };
    }
    if (
      maybe.error &&
      typeof maybe.error.code === "string" &&
      typeof maybe.error.message === "string"
    ) {
      return {
        code: maybe.error.code,
        message: getError(maybe.error.code, maybe.error.message),
      };
    }
    if (err instanceof Error) {
      return { code: "network_error", message: getError("network_error", err.message) };
    }
  }
  return { code: "network_error", message: getError("network_error") };
}

async function parseErrorResponse(res: Response): Promise<ExtendedApiError> {
  let errJson: Record<string, unknown> | null = null;
  try {
    errJson = await res.json();
  } catch {
    // non-json error response
  }
  const errObj = errJson?.error as { code?: string; message?: string } | undefined;
  if (errObj?.code) {
    return {
      code: errObj.code,
      message: getError(errObj.code, errObj.message),
      rawPayload: errJson,
    };
  }
  if (typeof errJson?.detail === "string") {
    return {
      code: `http_${res.status}`,
      message: errJson.detail,
      rawPayload: errJson,
    };
  }
  return {
    code: `http_${res.status}`,
    message: getError("server_busy", `Request failed with status ${res.status}`),
    rawPayload: errJson,
  };
}

export const aegisApi = {
  getMode(): "mock" | "live" {
    return isUsingMock() ? "mock" : "live";
  },

  async getHealth(): Promise<ExtendedHealthResponse> {
    if (API_MODE !== "live") {
      return {
        status: "ok",
        mode: "DEMO",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        backend_active: false,
      };
    }

    try {
      const res = await fetch(apiUrl("/health"));
      if (!res.ok) {
        forceDemoFallback = true;
        return {
          status: "offline",
          mode: "DEMO",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          backend_active: false,
        };
      }
      const data = await res.json();
      forceDemoFallback = false;
      const keyNotSet =
        data?.detectifai_configured === false ||
        data?.key_status === "NOT SET";
      return {
        status: String(data?.status || "ok"),
        mode: data?.mode || data?.app_mode || "REAL",
        version: String(data?.version || "1.0.0"),
        timestamp: data?.timestamp || new Date().toISOString(),
        backend_active: true,
        key_not_set: keyNotSet,
      };
    } catch {
      forceDemoFallback = true;
      return {
        status: "offline",
        mode: "DEMO",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        backend_active: false,
      };
    }
  },

  async analyzeCall(params: {
    audio?: Blob;
    claimed_user_id?: string;
    scenario_id?: string;
  }): Promise<AnalyzeResponse> {
    if (isUsingMock()) {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const cacheKey = params.scenario_id
        ? `scenario_${params.scenario_id}`
        : params.audio
        ? `audio_${params.audio.size}_${params.audio.type}_${params.claimed_user_id || "guest"}`
        : "default_s1";

      const isCached = !forceDemoFallback && mockAnalysisCache.has(cacheKey);
      const baseResult =
        params.scenario_id === "S2"
          ? S2
          : params.scenario_id === "S3"
          ? S3
          : params.scenario_id === "S4"
          ? S4
          : S1;

      if (isCached) {
        const cachedResp: AnalyzeResponse = {
          ...baseResult,
          mode: "CACHED",
          aletheia: { ...baseResult.aletheia, cost_credits: 0 },
          eidos: { ...baseResult.eidos, cost_credits: 0 },
        };
        mockUsage.total_calls_analyzed += 1;
        mockUsage.cache_hits += 1;
        mockUsage.total_credits_saved +=
          baseResult.aletheia.cost_credits + (baseResult.eidos.cost_credits || 0);
        mockUsage.operations.unshift({
          id: `${baseResult.aletheia.operation_id}_cached_${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          service: "pipeline",
          cost_credits: 0,
          mode: "CACHED",
          call_id: baseResult.call_id,
          cached: true,
          status: "done",
        });
        return cachedResp;
      }

      mockAnalysisCache.add(cacheKey);
      const demoResp: AnalyzeResponse = { ...baseResult, mode: "DEMO" };
      const totalCost = demoResp.aletheia.cost_credits + (demoResp.eidos.cost_credits || 0);
      mockUsage.total_calls_analyzed += 1;
      mockUsage.total_credits_used += totalCost;
      mockUsage.total_credits_saved += demoResp.credits_saved;
      mockUsage.aletheia_calls += 1;
      if (demoResp.eidos.status === "done") mockUsage.eidos_calls += 1;
      if (typeof mockUsage.credit_balance === "number") {
        mockUsage.credit_balance = Math.max(0, mockUsage.credit_balance - totalCost);
      }
      mockUsage.operations.unshift({
        id: demoResp.aletheia.operation_id,
        timestamp: new Date().toISOString(),
        service: "aletheia",
        cost_credits: demoResp.aletheia.cost_credits,
        mode: "DEMO",
        call_id: demoResp.call_id,
        cached: false,
        status: "done",
      });
      return demoResp;
    }

    try {
      const formData = new FormData();
      if (params.audio) formData.append("audio", params.audio, "call_sample.wav");
      if (params.claimed_user_id) formData.append("claimed_user_id", params.claimed_user_id);
      if (params.scenario_id) formData.append("scenario_id", params.scenario_id);

      const res = await fetch(apiUrl("/calls/analyze"), { method: "POST", body: formData });
      if (!res.ok) throw await parseErrorResponse(res);

      const data = await res.json();
      if (!isValidAnalyzeResponse(data)) {
        throw {
          code: "unexpected_response",
          message: getError("unexpected_response"),
          rawPayload: data,
        } satisfies ExtendedApiError;
      }
      return data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async getVoiceprints(): Promise<Voiceprint[]> {
    if (isUsingMock()) return [...mockVoiceprints];
    try {
      const res = await fetch(apiUrl("/voiceprints"));
      if (!res.ok) throw await parseErrorResponse(res);
      const data = await res.json();
      if (!isValidVoiceprintList(data)) {
        throw {
          code: "unexpected_response",
          message: getError("unexpected_response"),
          rawPayload: data,
        } satisfies ExtendedApiError;
      }
      return data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async enrollVoiceprint(params: {
    audio: Blob;
    secondAudio?: Blob;
    claimed_user_id: string;
    user_name: string;
    consent: boolean;
    durationSeconds?: number;
  }): Promise<Voiceprint> {
    if (!params.consent) {
      throw { code: "invalid_payload", message: "Explicit customer biometric consent is required." };
    }

    if (isUsingMock()) {
      await new Promise((r) => setTimeout(r, 600));
      const record: Voiceprint = {
        id: `VP-${Math.floor(100 + Math.random() * 900)}`,
        claimed_user_id: params.claimed_user_id.toUpperCase(),
        user_name: params.user_name,
        enrolled_at: new Date().toISOString(),
        status: "active",
        consent_given: true,
        sample_duration_seconds: params.durationSeconds ?? 24.0,
      };
      mockVoiceprints.unshift(record);
      return record;
    }

    try {
      const form = new FormData();
      form.append("audio", params.audio, "enrollment.wav");
      if (params.secondAudio) form.append("second_audio", params.secondAudio, "enrollment_2.wav");
      form.append("claimed_user_id", params.claimed_user_id);
      form.append("user_name", params.user_name);
      form.append("consent", "true");

      const res = await fetch(apiUrl("/voiceprints/enroll"), { method: "POST", body: form });
      if (!res.ok) throw await parseErrorResponse(res);
      const data = await res.json();
      if (!data || typeof data.id !== "string") {
        throw {
          code: "unexpected_response",
          message: getError("unexpected_response"),
          rawPayload: data,
        } satisfies ExtendedApiError;
      }
      return data as Voiceprint;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async deleteVoiceprint(id: string): Promise<void> {
    if (isUsingMock()) {
      await new Promise((r) => setTimeout(r, 500));
      const vp = mockVoiceprints.find((item) => item.id === id);
      if (vp) vp.status = "revoked";
      return;
    }
    try {
      const res = await fetch(apiUrl(`/voiceprints/${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      if (!res.ok) throw await parseErrorResponse(res);
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async getUsage(): Promise<UsageResponse> {
    if (isUsingMock()) {
      return { ...mockUsage, operations: [...mockUsage.operations] };
    }
    try {
      const res = await fetch(apiUrl("/usage"));
      if (!res.ok) throw await parseErrorResponse(res);
      const data = await res.json();
      if (!isValidUsageResponse(data)) {
        throw {
          code: "unexpected_response",
          message: getError("unexpected_response"),
          rawPayload: data,
        } satisfies ExtendedApiError;
      }
      return data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async startChallenge(): Promise<ChallengeStartResponse> {
    if (isUsingMock()) {
      return {
        challenge_id: `chal_${Date.now().toString().slice(-6)}`,
        nonce: Math.random().toString(36).substring(2, 9).toUpperCase(),
        phrase: "cobalt mango seven",
        expires_in_seconds: 10,
      };
    }
    try {
      const res = await fetch(apiUrl("/challenge/start"), { method: "POST" });
      if (!res.ok) throw await parseErrorResponse(res);
      const data = await res.json();
      if (!isValidChallengeStart(data)) {
        throw {
          code: "unexpected_response",
          message: getError("unexpected_response"),
          rawPayload: data,
        } satisfies ExtendedApiError;
      }
      return data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async verifyChallenge(params: {
    challenge_id: string;
    nonce?: string;
    audio?: Blob;
    scenario_id?: string | null;
    passed?: boolean;
  }): Promise<ChallengeVerifyResponse> {
    if (isUsingMock()) {
      await new Promise((r) => setTimeout(r, 600));
      const shouldPass =
        params.passed !== undefined ? params.passed : params.scenario_id === "S3" ? false : true;
      return {
        status: shouldPass ? "passed" : "failed",
        decision: shouldPass ? "CONTINUE" : "END_CALL",
        challenge_id: params.challenge_id,
        passed: shouldPass,
        score: shouldPass ? 0.95 : 0.2,
        latency_ms: 1100,
        detail: shouldPass ? "Verified in window" : "Mismatch or replay anomaly",
      };
    }
    try {
      let res: Response;
      if (params.audio) {
        const formData = new FormData();
        formData.append("challenge_id", params.challenge_id);
        if (params.nonce) formData.append("nonce", params.nonce);
        formData.append("audio", params.audio, "challenge.wav");
        res = await fetch(apiUrl("/challenge/verify"), { method: "POST", body: formData });
      } else {
        res = await fetch(apiUrl("/challenge/verify"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
      }
      if (!res.ok) throw await parseErrorResponse(res);
      const data = await res.json();
      if (!isValidChallengeVerify(data)) {
        throw {
          code: "unexpected_response",
          message: getError("unexpected_response"),
          rawPayload: data,
        } satisfies ExtendedApiError;
      }
      return data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async getCallReport(id: string): Promise<CallReportResponse> {
    if (isUsingMock()) {
      return {
        call_id: id,
        generated_at: new Date().toISOString(),
        decision: S1.decision,
        analysis: S1,
        recommendations: [
          "Sensitive actions still require OTP or a second factor.",
          "Voice biometrics logged for fraud intelligence audit.",
        ],
        caller_info: {
          claimed_user_id: "CUST-4821-MARCUS",
          caller_name: "Marcus Aurelius",
        },
      };
    }
    try {
      const res = await fetch(apiUrl(`/calls/${encodeURIComponent(id)}/report`));
      if (!res.ok) throw await parseErrorResponse(res);
      return await res.json();
    } catch (err) {
      throw normalizeError(err);
    }
  },
};
