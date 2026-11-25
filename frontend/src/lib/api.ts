import type {
  CallFeedbackRecord,
  CallReportResponse,
  CallSession,
  ChallengeSession,
  ChallengeVerifyResponse,
  CreditsResponse,
  ExecutionMode,
  HealthResponse,
  ScenarioDefinition,
  SecretsStatusResponse,
  SettingsResponse,
  ThreatRegistryEntry,
  ThreatRegistryResponse,
  UnifiedCallAnalysisResponse,
  UsageSummaryResponse,
  VoiceprintRecord,
  VoiceprintVerifyResponse,
} from "../types";

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (!RAW_BASE) return `/api${path}`;
  return RAW_BASE.endsWith("/api") ? `${RAW_BASE}${path}` : `${RAW_BASE}/api${path}`;
}

export function wsUrl(path: string): string {
  if (RAW_BASE.startsWith("http://") || RAW_BASE.startsWith("https://")) {
    const wsProto = RAW_BASE.replace(/^http/, "ws");
    return wsProto.endsWith("/api") ? `${wsProto}${path}` : `${wsProto}/api${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api${path}`;
}

export interface ExtendedApiError {
  code: string;
  message: string;
  status?: number;
  rawPayload?: unknown;
}

async function parseErrorResponse(res: Response): Promise<ExtendedApiError> {
  let errJson: Record<string, unknown> | null = null;
  try {
    errJson = await res.json();
  } catch {
    // ignore
  }
  const errObj = errJson?.error as { code?: string; message?: string } | undefined;
  if (errObj?.code) {
    return {
      code: errObj.code,
      message: errObj.message || `Request failed (${res.status})`,
      status: res.status,
      rawPayload: errJson,
    };
  }
  if (typeof errJson?.detail === "string") {
    return {
      code: `http_${res.status}`,
      message: errJson.detail,
      status: res.status,
      rawPayload: errJson,
    };
  }
  return {
    code: `http_${res.status}`,
    message: `Backend returned HTTP ${res.status}`,
    status: res.status,
    rawPayload: errJson,
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch (err) {
    throw {
      code: "network_error",
      message: err instanceof Error ? err.message : "Backend network connection lost.",
    } satisfies ExtendedApiError;
  }
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as T;
}

export const aegisApi = {
  // System, Health, Settings, Secrets, Cache
  async getHealth(): Promise<HealthResponse> {
    const data = await fetchJson<HealthResponse>("/health");
    return { ...data, backend_active: true };
  },

  async getSettings(): Promise<SettingsResponse> {
    return fetchJson<SettingsResponse>("/settings");
  },

  async updateSettings(payload: Partial<{
    app_mode: "DEMO" | "REAL";
    cache_enabled: boolean;
    bot_guard_enabled: boolean;
    bot_guard_threshold: number;
    layer_weights: Record<string, number>;
    safe_threshold: number;
    review_threshold: number;
    ema_alpha: number;
    language: string;
  }>): Promise<SettingsResponse> {
    return fetchJson<SettingsResponse>("/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async getSecretsStatus(): Promise<SecretsStatusResponse> {
    return fetchJson<SecretsStatusResponse>("/settings/secrets");
  },

  async updateSecrets(payload: {
    detectif_api_key?: string;
    gemini_api_key?: string;
    detectif_api_base_url?: string;
    gemini_model?: string;
  }): Promise<SecretsStatusResponse> {
    return fetchJson<SecretsStatusResponse>("/settings/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async clearSecrets(): Promise<SecretsStatusResponse> {
    return fetchJson<SecretsStatusResponse>("/settings/secrets", { method: "DELETE" });
  },

  async getCacheStats(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>("/cache/stats");
  },

  async clearCache(): Promise<{ cleared_entries: number }> {
    return fetchJson<{ cleared_entries: number }>("/cache", { method: "DELETE" });
  },

  // Scenarios & Calls
  async getScenarios(): Promise<ScenarioDefinition[]> {
    return fetchJson<ScenarioDefinition[]>("/scenarios");
  },

  async runScenario(scenarioId: "S1" | "S2" | "S3" | "S4"): Promise<CallSession> {
    return fetchJson<CallSession>("/scenarios/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
  },

  async listCalls(limit = 30): Promise<CallSession[]> {
    return fetchJson<CallSession[]>(`/calls?limit=${limit}`);
  },

  async getCurrentCall(): Promise<CallSession> {
    return fetchJson<CallSession>("/calls/current");
  },

  async getCall(callId: string): Promise<CallSession> {
    return fetchJson<CallSession>(`/calls/${encodeURIComponent(callId)}`);
  },

  async analyzeCall(params: {
    file?: Blob;
    filename?: string;
    transcript_text?: string;
    claimed_customer_id?: string;
    caller_label?: string;
    execution_mode: ExecutionMode;
    duration_hint_sec?: number;
    previous_score?: number | null;
  }): Promise<UnifiedCallAnalysisResponse> {
    const form = new FormData();
    if (params.file) {
      form.append("file", params.file, params.filename || "call_audio.wav");
    }
    form.append("transcript_text", params.transcript_text || "");
    form.append("claimed_customer_id", params.claimed_customer_id || "CUST-4821-MARCUS");
    form.append("caller_label", params.caller_label || "Live Call Analysis");
    form.append("execution_mode", params.execution_mode);
    if (params.duration_hint_sec !== undefined) {
      form.append("duration_hint_sec", String(params.duration_hint_sec));
    }
    if (params.previous_score !== undefined && params.previous_score !== null) {
      form.append("previous_score", String(params.previous_score));
    }
    return fetchJson<UnifiedCallAnalysisResponse>("/calls/analyze", {
      method: "POST",
      body: form,
    });
  },

  async postCallAction(
    callId: string,
    action: string,
    operatorNote = ""
  ): Promise<{ call_id: string; updated_status: string }> {
    return fetchJson(`/calls/${encodeURIComponent(callId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, operator_note: operatorNote }),
    });
  },

  async postCallFeedback(
    callId: string,
    payload: { is_scam: boolean | null; label: "SCAM" | "LEGITIMATE" | "UNCERTAIN"; notes: string }
  ): Promise<CallSession> {
    return fetchJson<CallSession>(`/calls/${encodeURIComponent(callId)}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async getCallReport(callId: string): Promise<CallReportResponse> {
    return fetchJson<CallReportResponse>(`/calls/${encodeURIComponent(callId)}/report`);
  },

  async listReports(limit = 30): Promise<CallReportResponse[]> {
    return fetchJson<CallReportResponse[]>(`/reports?limit=${limit}`);
  },

  // Voiceprints
  async getVoiceprints(): Promise<VoiceprintRecord[]> {
    return fetchJson<VoiceprintRecord[]>("/voiceprints");
  },

  async enrollVoiceprintAudio(params: {
    file: Blob;
    customer_id: string;
    customer_name: string;
    account_tier?: string;
    enrollment_purpose?: string;
    consent_confirmed: boolean;
    sample_duration_sec: number;
  }): Promise<VoiceprintRecord> {
    const form = new FormData();
    form.append("file", params.file, "enroll.wav");
    form.append("customer_id", params.customer_id);
    form.append("customer_name", params.customer_name);
    form.append("account_tier", params.account_tier || "Private Banking");
    form.append(
      "enrollment_purpose",
      params.enrollment_purpose || "Banking Call Authentication & Fraud Prevention"
    );
    form.append("consent_confirmed", params.consent_confirmed ? "true" : "false");
    form.append("sample_duration_sec", String(params.sample_duration_sec));
    return fetchJson<VoiceprintRecord>("/voiceprints/enroll-audio", {
      method: "POST",
      body: form,
    });
  },

  async verifyVoiceprint(params: {
    file?: Blob;
    claimed_customer_id: string;
    simulate_outcome?: "match" | "mismatch";
  }): Promise<VoiceprintVerifyResponse> {
    const form = new FormData();
    if (params.file) form.append("file", params.file, "verify.wav");
    form.append("claimed_customer_id", params.claimed_customer_id);
    form.append("simulate_outcome", params.simulate_outcome || "match");
    return fetchJson<VoiceprintVerifyResponse>("/voiceprints/verify", {
      method: "POST",
      body: form,
    });
  },

  async revokeVoiceprint(voiceprintId: string): Promise<VoiceprintRecord> {
    return fetchJson<VoiceprintRecord>(
      `/voiceprints/${encodeURIComponent(voiceprintId)}/revoke`,
      { method: "POST" }
    );
  },

  async deleteVoiceprint(voiceprintId: string): Promise<{ deleted: boolean; voiceprint_id: string }> {
    return fetchJson<{ deleted: boolean; voiceprint_id: string }>(
      `/voiceprints/${encodeURIComponent(voiceprintId)}`,
      { method: "DELETE" }
    );
  },

  // Challenge Liveness
  async startChallenge(callId?: string, customerId = "CUST-4821-MARCUS"): Promise<ChallengeSession> {
    return fetchJson<ChallengeSession>("/challenge/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_id: callId || null, customer_id: customerId, window_seconds: 20 }),
    });
  },

  async verifyChallengeAudio(params: {
    challenge_id: string;
    spoken_response: string;
    response_latency_ms: number;
    capture_mode: string;
    file?: Blob;
  }): Promise<ChallengeVerifyResponse> {
    const form = new FormData();
    form.append("challenge_id", params.challenge_id);
    form.append("spoken_response", params.spoken_response);
    form.append("response_latency_ms", String(params.response_latency_ms));
    form.append("capture_mode", params.capture_mode);
    if (params.file) form.append("file", params.file, "challenge.wav");
    return fetchJson<ChallengeVerifyResponse>("/challenge/verify-audio", {
      method: "POST",
      body: form,
    });
  },

  // Usage, Credits & CSV Export
  async getCredits(): Promise<CreditsResponse> {
    return fetchJson<CreditsResponse>("/credits");
  },

  async getUsage(includeProvider = true): Promise<UsageSummaryResponse> {
    return fetchJson<UsageSummaryResponse>(`/usage?include_provider=${includeProvider}`);
  },

  getUsageCsvUrl(): string {
    return apiUrl("/usage/export.csv");
  },

  // Threat Registry
  async getThreatRegistry(category?: string): Promise<ThreatRegistryResponse> {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return fetchJson<ThreatRegistryResponse>(`/threat-registry${q}`);
  },

  async submitThreatRecord(payload: {
    pattern_name: string;
    raw_speaker_reference: string;
    category: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    evidence_reference: string;
    indicators: string[];
  }): Promise<ThreatRegistryEntry> {
    return fetchJson<ThreatRegistryEntry>("/threat-registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, operator_authorized: true }),
    });
  },

  async updateThreatStatus(
    entryId: string,
    verificationStatus: "PENDING REVIEW" | "CONFIRMED THREAT" | "MITIGATED"
  ): Promise<ThreatRegistryEntry> {
    return fetchJson<ThreatRegistryEntry>(`/threat-registry/${encodeURIComponent(entryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_status: verificationStatus }),
    });
  },

  // Feedback helper type reference check
  _feedbackTypeCheck(f: CallFeedbackRecord): CallFeedbackRecord {
    return f;
  },
};

export interface LiveWsHandlers {
  onStatus: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
  onMessage: (payload: Record<string, unknown>) => void;
  onError?: (err: string) => void;
}

export class LiveCallSocketClient {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private retries = 0;
  private seq = 0;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private handlers: LiveWsHandlers;

  constructor(handlers: LiveWsHandlers) {
    this.handlers = handlers;
  }

  connect(): void {
    this.closedByUser = false;
    this.openSocket();
  }

  private openSocket(): void {
    this.handlers.onStatus(this.retries > 0 ? "reconnecting" : "connecting");
    try {
      const socket = new WebSocket(wsUrl("/ws/live-call"));
      this.ws = socket;

      socket.onopen = () => {
        this.retries = 0;
        this.handlers.onStatus("connected");
        this.startHeartbeat();
      };

      socket.onmessage = (evt) => {
        try {
          const data = JSON.parse(String(evt.data));
          if (data && typeof data === "object") {
            this.handlers.onMessage(data as Record<string, unknown>);
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onerror = () => {
        this.handlers.onError?.("WebSocket transport error");
      };

      socket.onclose = () => {
        this.stopHeartbeat();
        if (this.closedByUser) {
          this.handlers.onStatus("disconnected");
          return;
        }
        const delayMs = Math.min(8000, 600 * Math.pow(2, this.retries));
        this.retries += 1;
        this.handlers.onStatus("reconnecting");
        this.reconnectTimer = window.setTimeout(() => this.openSocket(), delayMs);
      };
    } catch (err) {
      this.handlers.onStatus("disconnected");
      this.handlers.onError?.(err instanceof Error ? err.message : "Failed to open WebSocket");
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = window.setInterval(() => {
      this.sendJson({ type: "ping" });
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  sendJson(payload: Record<string, unknown>): number {
    this.seq += 1;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...payload, seq: this.seq }));
    }
    return this.seq;
  }

  disconnect(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.onStatus("disconnected");
  }
}
