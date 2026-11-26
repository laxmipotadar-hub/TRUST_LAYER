import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AnalysisProvider } from "../context/AnalysisContext";
import { TrustScorePage } from "../pages/TrustScorePage";
import { CallerCard } from "../features/analyze/CallerCard";
import { VoiceprintList, getVoiceprintCapability } from "../features/voiceprints/VoiceprintList";
import { aegisApi } from "../lib/api";
import type { CallSession, VoiceprintRecord } from "../types";

const { mockVoiceprints, sampleHistoryCalls } = vi.hoisted(() => ({
  mockVoiceprints: [
  {
    voiceprint_id: "vp-live-1",
    customer_id: "CUST-LIVE-01",
    customer_name: "Arya Rao",
    account_tier: "Private Wealth",
    enrollment_purpose: "Authentication",
    consent_confirmed: true,
    consent_timestamp: "2026-11-25T10:00:00Z",
    retention_policy: "90 days",
    enrolled_at: "2026-11-25T10:00:00Z",
    sample_duration_sec: 8.2,
    enrollment_source: "REAL ANALYSIS",
    provider_speaker_id: "spk_real_9911",
    last_verification_status: "VERIFIED",
    verification_count: 3,
    mismatch_count: 0,
    verification_history: [],
    status: "ACTIVE",
  },
  {
    voiceprint_id: "vp-demo-2",
    customer_id: "CUST-DEMO-02",
    customer_name: "Marcus Demo",
    account_tier: "Retail",
    enrollment_purpose: "Demo",
    consent_confirmed: true,
    consent_timestamp: "2026-11-25T10:00:00Z",
    retention_policy: "90 days",
    enrolled_at: "2026-11-25T10:00:00Z",
    sample_duration_sec: 5.0,
    enrollment_source: "SIMULATION",
    provider_speaker_id: "sim-marcus-01",
    last_verification_status: "UNAVAILABLE",
    verification_count: 2,
    mismatch_count: 0,
    verification_history: [
      {
        verification_id: "v1",
        verified_at: "2026-11-25T11:00:00Z",
        match_percentage: null,
        result: "UNAVAILABLE",
        claimed_identity: "Marcus Demo",
        provenance: "SIMULATION",
        notes: "No live DetectifAI provider speaker ID enrolled",
      },
    ],
    status: "ACTIVE",
  },
  {
    voiceprint_id: "vp-missing-3",
    customer_id: "CUST-NONE-03",
    customer_name: "No ID Caller",
    account_tier: "Retail",
    enrollment_purpose: "Test",
    consent_confirmed: true,
    consent_timestamp: "2026-11-25T10:00:00Z",
    retention_policy: "90 days",
    enrolled_at: "2026-11-25T10:00:00Z",
    sample_duration_sec: 5.0,
    enrollment_source: "REAL ANALYSIS",
    provider_speaker_id: null,
    last_verification_status: "UNAVAILABLE",
    verification_count: 1,
    mismatch_count: 0,
    verification_history: [],
    status: "ACTIVE",
  },
] as VoiceprintRecord[],
sampleHistoryCalls: [
  {
    call_id: "CALL-OK-1",
    created_at: "2026-11-25T10:00:00Z",
    timestamp: "2026-11-25T10:00:00Z",
    caller_label: "Arya Rao",
    claimed_customer_id: "CUST-LIVE-01",
    call_state: "VERDICT",
    mode: "REAL",
    execution_mode: "LIVE",
    analysis_mode: "REAL",
    overall_provenance: "REAL ANALYSIS",
    synthetic_probability: 0.04,
    voice_authenticity_score: 96,
    speaker_match_percentage: 91,
    scam_risk_score: 5,
    behavioral_pressure_score: 4,
    trust_score: 91,
    verdict: "SAFE",
    band: "SAFE",
    decision: "ALLOW",
    decision_reason: "Verified caller",
    model_status: { aletheia: "OK", eidos: "OK", scam_analysis: "OK", manipulation: "OK" },
    voice_authenticity: { status: "PASS", deepfake_probability: 0.04, score: 96, model_name: "aletheia", artifacts_detected: [], provenance: "REAL ANALYSIS", detail: "", cache_hit: false },
    speaker_identity: { status: "PASS", score: 91, match_confidence: 91, claimed_customer_id: "CUST-LIVE-01", enrolled: true, model_name: "eidos", provenance: "REAL ANALYSIS", detail: "", cache_hit: false },
    scam_analysis: { status: "PASS", risk_score: 5, safety_score: 95, behavioral_pressure_score: 4, categories: [], detected_patterns: [], pressure_tactics: [], flagged_phrases: [], engine_used: "groq", provenance: "REAL ANALYSIS", summary: "", recommended_action: "", fallback_used: false, cache_hit: false },
    manipulation_analysis: { status: "PASS", score: 4, safety_score: 96, model_version: "1", category_counts: {}, markers: [], sparkline: [], provenance: "REAL ANALYSIS" },
    liveness: { passed: true, replay_detected: false, score: 95, status: "PASS", signal_notes: "", provenance: "REAL ANALYSIS" },
    trust_breakdown: {
      composite_score: 91,
      score_based_verdict: "SAFE",
      verdict: "SAFE",
      final_decision: "SAFE",
      band: "SAFE",
      decision: "ALLOW",
      liveness_override_applied: false,
      liveness_status: "PASSED",
      formula_summary: "",
      recommended_action: "Proceed",
      factor_contributions: [],
      primary_risk_drivers: [],
    },
    transcript: [],
    evidence_timeline: [],
    segment_chunks: [],
    audio_profile: { pitch_hz: 120, jitter_pct: 1, harmonic_noise_ratio_db: 20, spectral_flatness: 0.1, synthetic_cadence_index: 0.1, replay_echo_correlation: 0.1 },
    actions_taken: [],
    credits_saved: 0,
  },
  {
    call_id: "CALL-UNAVAIL-2",
    created_at: "2026-11-25T10:02:00Z",
    timestamp: "2026-11-25T10:02:00Z",
    caller_label: "Incomplete Session",
    claimed_customer_id: "CUST-LIVE-01",
    call_state: "VERDICT",
    mode: "REAL",
    execution_mode: "LIVE",
    analysis_mode: "REAL",
    overall_provenance: "REAL ANALYSIS",
    synthetic_probability: null,
    voice_authenticity_score: null,
    speaker_match_percentage: null,
    scam_risk_score: null,
    behavioral_pressure_score: null,
    trust_score: null,
    verdict: "INCOMPLETE ANALYSIS",
    band: "INCOMPLETE ANALYSIS",
    decision: "INCOMPLETE ANALYSIS",
    decision_reason: "Provider timeout",
    model_status: { aletheia: "UNAVAILABLE", eidos: "SKIPPED", scam_analysis: "UNAVAILABLE", manipulation: "UNAVAILABLE" },
    voice_authenticity: { status: "UNAVAILABLE", deepfake_probability: null, score: null, model_name: "aletheia", artifacts_detected: [], provenance: "REAL ANALYSIS", detail: "", cache_hit: false },
    speaker_identity: { status: "SKIPPED", score: null, match_confidence: null, claimed_customer_id: "CUST-LIVE-01", enrolled: false, model_name: "eidos", provenance: "REAL ANALYSIS", detail: "", cache_hit: false },
    scam_analysis: { status: "UNAVAILABLE", risk_score: null, safety_score: null, behavioral_pressure_score: null, categories: [], detected_patterns: [], pressure_tactics: [], flagged_phrases: [], engine_used: "groq", provenance: "REAL ANALYSIS", summary: "", recommended_action: "", fallback_used: false, cache_hit: false },
    manipulation_analysis: { status: "UNAVAILABLE", score: null, safety_score: null, model_version: "1", category_counts: {}, markers: [], sparkline: [], provenance: "REAL ANALYSIS" },
    liveness: { passed: false, replay_detected: false, score: null, status: "UNAVAILABLE", signal_notes: "", provenance: "REAL ANALYSIS" },
    trust_breakdown: {
      composite_score: null,
      score_based_verdict: "INCOMPLETE ANALYSIS",
      verdict: "INCOMPLETE ANALYSIS",
      final_decision: "INCOMPLETE ANALYSIS",
      band: "INCOMPLETE ANALYSIS",
      decision: "INCOMPLETE ANALYSIS",
      liveness_override_applied: false,
      liveness_status: "UNAVAILABLE",
      formula_summary: "",
      recommended_action: "Manual verify",
      factor_contributions: [],
      primary_risk_drivers: [],
    },
    transcript: [],
    evidence_timeline: [],
    segment_chunks: [],
    audio_profile: { pitch_hz: 120, jitter_pct: 1, harmonic_noise_ratio_db: 20, spectral_flatness: 0.1, synthetic_cadence_index: 0.1, replay_echo_correlation: 0.1 },
    actions_taken: [],
    credits_saved: 0,
  },
] as unknown as CallSession[],
}));

vi.mock("../lib/api", () => ({
  aegisApi: {
    getHealth: vi.fn().mockResolvedValue({ status: "ok", detectifai: "SET", groq: "SET" }),
    getSettings: vi.fn().mockResolvedValue({
      app_mode: "REAL",
      cache_enabled: false,
      bot_guard_enabled: true,
      bot_guard_threshold: 55,
      layer_weights: {
        voice_authenticity: 0.35,
        speaker_identity: 0.3,
        scam_safety: 0.2,
        behavioral_safety: 0.15,
      },
      safe_threshold: 75,
      review_threshold: 45,
      ema_alpha: 0.35,
      language: "en",
      detectifai_configured: true,
      groq_configured: true,
      detectifai_base_url: "https://platform.detectif.ai",
      groq_stt_model: "whisper-large-v3",
      groq_llm_model: "llama-3.3-70b-versatile",
    }),
    updateSettings: vi.fn().mockImplementation(async (patch) => ({
      app_mode: "REAL",
      cache_enabled: false,
      bot_guard_enabled: true,
      bot_guard_threshold: 55,
      layer_weights: patch.layer_weights || {
        voice_authenticity: 0.35,
        speaker_identity: 0.3,
        scam_safety: 0.2,
        behavioral_safety: 0.15,
      },
      safe_threshold: patch.safe_threshold ?? 75,
      review_threshold: patch.review_threshold ?? 45,
      ema_alpha: patch.ema_alpha ?? 0.35,
      language: "en",
      detectifai_configured: true,
      groq_configured: true,
      detectifai_base_url: "https://platform.detectif.ai",
      groq_stt_model: "whisper-large-v3",
      groq_llm_model: "llama-3.3-70b-versatile",
    })),
    getSecretsStatus: vi.fn().mockResolvedValue({
      detectifai_configured: true,
      groq_configured: true,
      detectif_key_hint: "dtf_***",
      groq_key_hint: "gsk_***",
    }),
    getCredits: vi.fn().mockResolvedValue({ available: 3400, reserved: 0, currency: "credits", configured: true, latency_ms: 10 }),
    getScenarios: vi.fn().mockResolvedValue([]),
    getVoiceprints: vi.fn().mockResolvedValue(mockVoiceprints),
    reconcileVoiceprints: vi.fn().mockResolvedValue(mockVoiceprints),
    listCalls: vi.fn().mockResolvedValue(sampleHistoryCalls),
    listReports: vi.fn().mockResolvedValue([]),
  },
}));

describe("Part A bug fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A1 & A2: TrustScorePage shows 0.35/0.30/0.20/0.15 defaults, guards zero L3/L4 save, and plots unavailable session on UNAVAILABLE track", async () => {
    render(
      <MemoryRouter>
        <AnalysisProvider>
          <TrustScorePage />
        </AnalysisProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("N/A")).toBeInTheDocument();
    expect(screen.getByText(/L1 Voice Authenticity Weight \(0\.35\)/)).toBeInTheDocument();
    expect(screen.getByText(/L3 Script Safety Weight \(0\.20\)/)).toBeInTheDocument();
    expect(screen.getByText(/L4 Behavioral Safety Weight \(0\.15\)/)).toBeInTheDocument();

    // Unavailable session plotted with N/A label on UNAVAILABLE track
    expect(screen.getByText("UNAVAILABLE")).toBeInTheDocument();

    // Zero L3 & L4 triggers confirmation guard before saving
    const l3Input = screen.getByLabelText(/L3 Script Safety Weight/i);
    const l4Input = screen.getByLabelText(/L4 Behavioral Safety Weight/i);
    fireEvent.change(l3Input, { target: { value: "0" } });
    fireEvent.change(l4Input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Fusion Settings/i }));

    expect(await screen.findByText(/Confirm Zero Transcript Weights/i)).toBeInTheDocument();
    expect(aegisApi.updateSettings).not.toHaveBeenCalled();

    // Reset to defaults restores canonical weights and persists
    fireEvent.click(screen.getByRole("button", { name: /Reset to defaults/i }));
    await waitFor(() => {
      expect(aegisApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          layer_weights: {
            voice_authenticity: 0.35,
            speaker_identity: 0.3,
            scam_safety: 0.2,
            behavioral_safety: 0.15,
          },
        })
      );
    });
  });

  it("A3: CallerCard immediately displays selected customer identity and Live Enrolled status before analysis", async () => {
    render(
      <MemoryRouter>
        <AnalysisProvider>
          <CallerCard
            call={null}
            voiceprints={mockVoiceprints}
            selectedCustomerId="CUST-LIVE-01"
            executionMode="LIVE"
          />
        </AnalysisProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Arya Rao")).toBeInTheDocument();
    expect(screen.getByText("CUST-LIVE-01")).toBeInTheDocument();
    expect(screen.getByText("vp-live-1")).toBeInTheDocument();
    expect(screen.getByText("spk_real_9911")).toBeInTheDocument();
    expect(screen.getByText("Live Enrolled")).toBeInTheDocument();
  });

  it("A4: VoiceprintList classifies Live, Demo, No Voice ID accurately and never renders plain ACTIVE on placeholders", async () => {
    expect(getVoiceprintCapability(mockVoiceprints[0])).toBe("LIVE");
    expect(getVoiceprintCapability(mockVoiceprints[1])).toBe("DEMO");
    expect(getVoiceprintCapability(mockVoiceprints[2])).toBe("NO_VOICE_ID");

    render(
      <MemoryRouter>
        <VoiceprintList onNavigateEnroll={vi.fn()} onVoiceprintRevoked={vi.fn()} />
      </MemoryRouter>
    );

    expect(await screen.findByText("Arya Rao")).toBeInTheDocument();
    expect(screen.getByText("LIVE ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("DEMO PLACEHOLDER")).toBeInTheDocument();
    expect(screen.getByText("MISSING ID")).toBeInTheDocument();
    expect(screen.queryByText(/^ACTIVE$/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/No live DetectifAI provider speaker ID enrolled/i)).toBeInTheDocument();
  });
});
