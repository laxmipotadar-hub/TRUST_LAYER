import type {
  AnalysisMode,
  AppMode,
  CallActionResponse,
  CallActionType,
  CallReportResponse,
  CallSession,
  ChallengeSession,
  ChallengeVerifyResponse,
  HealthResponse,
  ScenarioDefinition,
  SettingsResponse,
  ThreatRegistryEntry,
  ThreatRegistryResponse,
  ThreatSeverity,
  ThreatVerificationStatus,
  UnifiedCallAnalysisResponse,
  VoiceprintRecord,
  VoiceprintVerifyResponse,
} from '../types/aegis';

const API_BASE = '/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        detail = String(errBody.detail);
      }
    } catch {
      // Ignore parse errors on non-JSON responses
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export const aegisApi = {
  getHealth(): Promise<HealthResponse> {
    return requestJson<HealthResponse>('/health');
  },

  getSettings(): Promise<SettingsResponse> {
    return requestJson<SettingsResponse>('/settings');
  },

  updateSettings(payload: {
    app_mode?: AppMode;
    cache_enabled?: boolean;
    bot_guard_enabled?: boolean;
    bot_guard_threshold?: number;
  }): Promise<SettingsResponse> {
    return requestJson<SettingsResponse>('/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getScenarios(): Promise<ScenarioDefinition[]> {
    return requestJson<ScenarioDefinition[]>('/scenarios');
  },

  runScenario(scenarioId: string): Promise<CallSession> {
    return requestJson<CallSession>('/scenarios/run', {
      method: 'POST',
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
  },

  async analyzeLiveCall(payload: {
    file?: Blob;
    filename?: string;
    transcript_text: string;
    claimed_customer_id: string;
    caller_label: string;
    analysis_mode: AnalysisMode;
    duration_hint_sec?: number;
  }): Promise<UnifiedCallAnalysisResponse> {
    const form = new FormData();
    form.append('transcript_text', payload.transcript_text);
    form.append('claimed_customer_id', payload.claimed_customer_id);
    form.append('caller_label', payload.caller_label);
    form.append('analysis_mode', payload.analysis_mode);
    if (payload.duration_hint_sec !== undefined) {
      form.append('duration_hint_sec', String(payload.duration_hint_sec));
    }
    if (payload.file) {
      form.append('file', payload.file, payload.filename ?? 'live_call.webm');
    }
    const response = await fetch(`${API_BASE}/calls/analyze`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      let detail = `Live call analysis failed (${response.status})`;
      try {
        const err = await response.json();
        if (err?.detail) detail = String(err.detail);
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return response.json() as Promise<UnifiedCallAnalysisResponse>;
  },

  listCalls(limit = 20): Promise<CallSession[]> {
    return requestJson<CallSession[]>(`/calls?limit=${limit}`);
  },

  getCurrentCall(): Promise<CallSession> {
    return requestJson<CallSession>('/calls/current');
  },

  getCall(callId: string): Promise<CallSession> {
    return requestJson<CallSession>(`/calls/${encodeURIComponent(callId)}`);
  },

  getCallReport(callId: string): Promise<CallReportResponse> {
    return requestJson<CallReportResponse>(`/calls/${encodeURIComponent(callId)}/report`);
  },

  recordCallAction(
    callId: string,
    payload: { action: CallActionType; operator_note: string },
  ): Promise<CallActionResponse> {
    return requestJson<CallActionResponse>(`/calls/${encodeURIComponent(callId)}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listVoiceprints(): Promise<VoiceprintRecord[]> {
    return requestJson<VoiceprintRecord[]>('/voiceprints');
  },

  enrollVoiceprint(payload: {
    customer_id: string;
    customer_name: string;
    account_tier: string;
    enrollment_purpose: string;
    consent_confirmed: boolean;
    sample_duration_sec: number;
  }): Promise<VoiceprintRecord> {
    return requestJson<VoiceprintRecord>('/voiceprints/enroll', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async enrollVoiceprintAudio(payload: {
    file: Blob;
    filename: string;
    customer_id: string;
    customer_name: string;
    account_tier: string;
    enrollment_purpose: string;
    consent_confirmed: boolean;
    sample_duration_sec: number;
  }): Promise<VoiceprintRecord> {
    const form = new FormData();
    form.append('file', payload.file, payload.filename);
    form.append('customer_id', payload.customer_id);
    form.append('customer_name', payload.customer_name);
    form.append('account_tier', payload.account_tier);
    form.append('enrollment_purpose', payload.enrollment_purpose);
    form.append('consent_confirmed', String(payload.consent_confirmed));
    form.append('sample_duration_sec', String(payload.sample_duration_sec));
    const response = await fetch(`${API_BASE}/voiceprints/enroll-audio`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      let msg = `Enrollment failed (${response.status})`;
      try {
        const err = await response.json();
        if (err?.detail) msg = String(err.detail);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return response.json() as Promise<VoiceprintRecord>;
  },

  async verifyVoiceprint(payload: {
    claimed_customer_id: string;
    file?: Blob;
    filename?: string;
    simulate_outcome?: 'match' | 'mismatch';
  }): Promise<VoiceprintVerifyResponse> {
    const form = new FormData();
    form.append('claimed_customer_id', payload.claimed_customer_id);
    if (payload.simulate_outcome) {
      form.append('simulate_outcome', payload.simulate_outcome);
    }
    if (payload.file) {
      form.append('file', payload.file, payload.filename ?? 'verify.webm');
    }
    const response = await fetch(`${API_BASE}/voiceprints/verify`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Verification failed (${response.status})`);
    }
    return response.json() as Promise<VoiceprintVerifyResponse>;
  },

  revokeVoiceprint(voiceprintId: string): Promise<VoiceprintRecord> {
    return requestJson<VoiceprintRecord>(
      `/voiceprints/${encodeURIComponent(voiceprintId)}/revoke`,
      { method: 'POST' },
    );
  },

  deleteVoiceprint(voiceprintId: string): Promise<{ deleted: boolean; voiceprint_id: string }> {
    return requestJson<{ deleted: boolean; voiceprint_id: string }>(
      `/voiceprints/${encodeURIComponent(voiceprintId)}`,
      { method: 'DELETE' },
    );
  },

  startChallenge(payload: {
    call_id?: string;
    customer_id: string;
    window_seconds?: number;
  }): Promise<ChallengeSession> {
    return requestJson<ChallengeSession>('/challenge/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyChallenge(payload: {
    challenge_id: string;
    spoken_response: string;
    response_latency_ms: number;
    capture_mode?: string;
    audio_captured?: boolean;
  }): Promise<ChallengeVerifyResponse> {
    return requestJson<ChallengeVerifyResponse>('/challenge/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyChallengeAudio(payload: {
    challenge_id: string;
    spoken_response: string;
    response_latency_ms: number;
    capture_mode: string;
    file?: Blob;
  }): Promise<ChallengeVerifyResponse> {
    const form = new FormData();
    form.append('challenge_id', payload.challenge_id);
    form.append('spoken_response', payload.spoken_response);
    form.append('response_latency_ms', String(payload.response_latency_ms));
    form.append('capture_mode', payload.capture_mode);
    if (payload.file) {
      form.append('file', payload.file, 'challenge_response.webm');
    }
    const response = await fetch(`${API_BASE}/challenge/verify-audio`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Challenge audio verification failed (${response.status})`);
    }
    return response.json() as Promise<ChallengeVerifyResponse>;
  },

  getThreatRegistry(category?: string): Promise<ThreatRegistryResponse> {
    const query = category && category !== 'ALL' ? `?category=${encodeURIComponent(category)}` : '';
    return requestJson<ThreatRegistryResponse>(`/threat-registry${query}`);
  },

  submitThreatRecord(payload: {
    pattern_name: string;
    raw_speaker_reference: string;
    category: string;
    severity: ThreatSeverity;
    evidence_reference: string;
    indicators: string[];
    operator_authorized: boolean;
  }): Promise<ThreatRegistryEntry> {
    return requestJson<ThreatRegistryEntry>('/threat-registry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateThreatStatus(
    entryId: string,
    verificationStatus: ThreatVerificationStatus,
  ): Promise<ThreatRegistryEntry> {
    return requestJson<ThreatRegistryEntry>(`/threat-registry/${encodeURIComponent(entryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ verification_status: verificationStatus }),
    });
  },
};
