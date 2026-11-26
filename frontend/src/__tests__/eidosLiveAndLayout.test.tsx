import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ClipBar } from "../features/analyze/ClipBar";
import { LayerCardsGrid } from "../features/analyze/LayerCardsGrid";
import { CallerCard } from "../features/analyze/CallerCard";
import { ChallengeModal } from "../features/challenge/ChallengeModal";
import { OperatorActionsCard } from "../features/analyze/OperatorActionsCard";
import { PipelineStrip } from "../features/analyze/PipelineStrip";
import { AnalysisProvider, useAnalysis } from "../context/AnalysisContext";
import type { CallSession, SpeakerIdentityResult, VoiceprintRecord } from "../types";

const mockVoiceprints: VoiceprintRecord[] = [
  {
    voiceprint_id: "VP-DEMO-MARCUS",
    customer_id: "CUST-DEMO-MARCUS",
    customer_name: "Marcus Demo",
    account_tier: "Retail",
    enrollment_purpose: "Demo",
    consent_confirmed: true,
    consent_timestamp: "2026-11-26T00:00:00Z",
    retention_policy: "90 days",
    enrolled_at: "2026-11-26T00:00:00Z",
    sample_duration_sec: 12.0,
    enrollment_source: "SIMULATION",
    provider_speaker_id: null,
    provider_speaker_ref: "sim-CUST-DEMO-MARCUS",
    last_verification_status: "UNVERIFIED",
    verification_count: 0,
    mismatch_count: 0,
    verification_history: [],
    status: "ACTIVE",
  },
  {
    voiceprint_id: "VP-LIVE-X",
    customer_id: "CUST-LIVE-X",
    customer_name: "Live Verified Speaker",
    account_tier: "Private Wealth",
    enrollment_purpose: "Auth",
    consent_confirmed: true,
    consent_timestamp: "2026-11-26T00:00:00Z",
    retention_policy: "90 days",
    enrolled_at: "2026-11-26T00:00:00Z",
    sample_duration_sec: 15.0,
    enrollment_source: "REAL ANALYSIS",
    provider_speaker_id: "spk_live_x",
    provider_speaker_ref: "spk_live_x",
    last_verification_status: "VERIFIED",
    verification_count: 1,
    mismatch_count: 0,
    verification_history: [],
    status: "ACTIVE",
  },
];

const { mockStartChallenge, mockVerifyChallengeAudio, mockPostCallAction } = vi.hoisted(() => ({
  mockStartChallenge: vi.fn(),
  mockVerifyChallengeAudio: vi.fn(),
  mockPostCallAction: vi.fn(),
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
    getSecretsStatus: vi.fn().mockResolvedValue({
      detectifai_configured: true,
      groq_configured: true,
      detectif_key_hint: "dtf_***",
      groq_key_hint: "gsk_***",
    }),
    getCredits: vi.fn().mockResolvedValue({ available: 3824, reserved: 0, currency: "credits", configured: true, latency_ms: 10 }),
    getScenarios: vi.fn().mockResolvedValue([]),
    getVoiceprints: vi.fn().mockResolvedValue([]),
    listCalls: vi.fn().mockResolvedValue([]),
    listReports: vi.fn().mockResolvedValue([]),
    startChallenge: mockStartChallenge,
    verifyChallengeAudio: mockVerifyChallengeAudio,
    postCallAction: mockPostCallAction,
    getCall: vi.fn().mockResolvedValue(null),
    getCallReport: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../lib/audio", () => ({
  useRecorder: () => ({
    status: "idle",
    level: 0,
    elapsedSeconds: 0,
    errorReason: null,
    startRecording: vi.fn().mockResolvedValue(true),
    stopRecording: vi.fn().mockResolvedValue(null),
    cancelRecording: vi.fn(),
  }),
  AudioCaptureHelper: class {
    start = vi.fn();
    stop = vi.fn();
  },
  transcodeBlobToWav16k: vi.fn().mockResolvedValue({
    blob: new Blob([new Uint8Array(100)], { type: "audio/wav" }),
    quality: { durationSeconds: 6.2, sampleRate: 16000, silenceRatio: 0.1 },
  }),
}));

function buildSkippedCall(identityPatch: Partial<SpeakerIdentityResult>): CallSession {
  return {
    call_id: "CALL-SKIP-TEST",
    created_at: "2026-11-26T00:00:00Z",
    timestamp: "2026-11-26T00:00:00Z",
    caller_label: "Test",
    claimed_customer_id: "CUST-DEMO-MARCUS",
    call_state: "VERDICT",
    mode: "REAL",
    execution_mode: "LIVE",
    analysis_mode: "REAL",
    overall_provenance: "REAL ANALYSIS",
    synthetic_probability: 0.04,
    voice_authenticity_score: 96,
    speaker_match_percentage: null,
    scam_risk_score: 5,
    behavioral_pressure_score: 5,
    trust_score: 65,
    verdict: "CAUTION",
    band: "REVIEW",
    decision: "STEP_UP",
    decision_reason: "Skipped",
    model_status: { aletheia: "OK", eidos: "SKIPPED", scam_analysis: "OK", manipulation: "OK" },
    voice_authenticity: { status: "PASS", deepfake_probability: 0.04, score: 96, model_name: "aletheia", artifacts_detected: [], provenance: "REAL ANALYSIS", detail: "OK", cache_hit: false },
    speaker_identity: {
      status: "skipped",
      score: null,
      match_confidence: null,
      claimed_customer_id: "CUST-DEMO-MARCUS",
      enrolled: false,
      skip_reason: "no_voice_id",
      model_name: "eidos",
      provenance: "REAL ANALYSIS",
      detail: "No live Voice ID",
      cache_hit: false,
      ...identityPatch,
    },
    scam_analysis: { status: "PASS", risk_score: 5, safety_score: 95, behavioral_pressure_score: 5, categories: [], detected_patterns: [], pressure_tactics: [], flagged_phrases: [], engine_used: "groq", provenance: "REAL ANALYSIS", summary: "", recommended_action: "", fallback_used: false, cache_hit: false },
    manipulation_analysis: { status: "PASS", score: 5, safety_score: 95, model_version: "1", category_counts: {}, markers: [], sparkline: [], provenance: "REAL ANALYSIS" },
    liveness: { passed: true, replay_detected: false, score: 96, status: "PASS", signal_notes: "", provenance: "REAL ANALYSIS" },
    trust_breakdown: { composite_score: 65, score_based_verdict: "CAUTION", verdict: "CAUTION", final_decision: "CAUTION", band: "REVIEW", decision: "STEP_UP", liveness_override_applied: false, liveness_status: "PASSED", formula_summary: "", recommended_action: "", factor_contributions: [], primary_risk_drivers: [] },
    transcript: [],
    evidence_timeline: [],
    segment_chunks: [],
    audio_profile: { pitch_hz: 120, jitter_pct: 1, harmonic_noise_ratio_db: 20, spectral_flatness: 0.1, synthetic_cadence_index: 0.1, replay_echo_correlation: 0.1 },
    actions_taken: [],
    credits_saved: 0,
  };
}

describe("Eidos LIVE Reliability, Reasons, Liveness & Operator Timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups live customers first in LIVE mode and shows demo-only banner + Enroll button + short-clip warning", async () => {
    render(
      <MemoryRouter>
        <ClipBar
          executionMode="LIVE"
          activeScenarioId={null}
          voiceprints={mockVoiceprints}
          selectedCustomerId="CUST-DEMO-MARCUS"
          onSelectCustomerId={vi.fn()}
          isLoading={false}
          onSelectScenario={vi.fn()}
          onAnalyzeAudio={vi.fn()}
        />
      </MemoryRouter>
    );

    const select = screen.getByLabelText("Claimed Customer ID");
    const groups = select.querySelectorAll("optgroup");
    expect(groups).toHaveLength(2);
    expect(groups[0].getAttribute("label")).toContain("Live-Enrolled");
    expect(groups[1].getAttribute("label")).toBe("Demo only (cannot verify live)");

    expect(
      screen.getByText(/No live Voice ID: Eidos will be skipped\. Enroll one or pick a live customer\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enroll live Voice ID" })).toBeInTheDocument();

    // Short 6.2s upload triggers Clip too short for speaker verification warning before analysis
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(100)], "short6s.wav", { type: "audio/wav" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/Clip too short for speaker verification/i)).toBeInTheDocument();
  });

  it("shows exact skip reasons on Eidos Card and Caller Profile, never bare 'Skipped'", async () => {
    const cases: Array<{ patch: Partial<SpeakerIdentityResult>; expected: string }> = [
      { patch: { skip_reason: "no_voice_id" }, expected: "No live Voice ID" },
      { patch: { skip_reason: "l1_error", detail: "Blocked by L1 error" }, expected: "Blocked by L1 error" },
      { patch: { skip_reason: "aletheia_fake" }, expected: "L1 flagged fake" },
      { patch: { skip_reason: "clip_too_short" }, expected: "Clip too short: need >= 10 s of speech" },
      {
        patch: { skip_reason: "insufficient_credits", detail: "Insufficient credits: need ~500 have 140" },
        expected: "Insufficient credits: need ~500 have 140",
      },
    ];

    for (const c of cases) {
      const call = buildSkippedCall(c.patch);
      const { unmount } = render(
        <MemoryRouter>
          <AnalysisProvider>
            <LayerCardsGrid
              call={call}
              statuses={{ asr: "done", aletheia: "done", eidos: "skipped", script: "done", manipulation: "done" }}
              isLoading={false}
            />
            <CallerCard call={call} voiceprints={mockVoiceprints} selectedCustomerId="CUST-DEMO-MARCUS" executionMode="LIVE" />
          </AnalysisProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getAllByText(new RegExp(c.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).length).toBeGreaterThanOrEqual(2);
      });
      expect(screen.queryByText(/^Skipped$/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("separates Challenge Technical Error (Retryable - No END_CALL) from Challenge Failed (END_CALL Override)", async () => {
    mockStartChallenge.mockResolvedValue({
      challenge_id: "CHL-TEST",
      customer_id: "CUST-LIVE-X",
      phrase: "cobalt mango seven",
      window_seconds: 20,
      created_at: "2026-11-26T00:00:00Z",
      expires_at: "2026-11-26T00:00:20Z",
      status: "PENDING",
      provenance: "SIMULATION",
    });

    mockVerifyChallengeAudio.mockResolvedValueOnce({
      challenge_id: "CHL-TEST",
      passed: false,
      status: "incomplete",
      reason: "aletheia_unavailable",
      phrase_similarity: 1.0,
      liveness_status: "INCOMPLETE",
      capture_mode: "LIVE_SPEECH_AUDIO",
      notes: "Technical error",
      explanation: "Aletheia unavailable",
      banner_lines: [],
      checks: [],
      provenance: "REAL ANALYSIS",
    });

    const onComplete = vi.fn();
    render(
      <ChallengeModal
        isOpen
        callId="CALL-1"
        customerId="CUST-LIVE-X"
        executionMode="DEMO"
        onClose={vi.fn()}
        onComplete={onComplete}
      />
    );

    const simPassBtn = await screen.findByRole("button", { name: /Simulate Live Pass/i });
    fireEvent.click(simPassBtn);

    expect(await screen.findByText(/Challenge Technical Error \(Retryable — No END_CALL\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Challenge" })).toBeInTheDocument();

    mockVerifyChallengeAudio.mockResolvedValueOnce({
      challenge_id: "CHL-TEST",
      passed: false,
      status: "failed",
      reason: "phrase_mismatch",
      phrase_similarity: 0.0,
      liveness_status: "FAIL",
      capture_mode: "SIMULATED_REPLAY_FAIL",
      notes: "Replay failed",
      explanation: "Replay failure",
      banner_lines: [],
      checks: [],
      provenance: "SIMULATION",
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry Challenge" }));
    fireEvent.click(await screen.findByRole("button", { name: /Simulate Replay Attack/i }));
    expect(await screen.findByText(/Challenge Failed — END_CALL Override/i)).toBeInTheDocument();
  });

  it("times out hanging Operator Actions at 30s and clears Running state with visible reason", async () => {
    vi.useFakeTimers();
    mockPostCallAction.mockImplementation(() => new Promise(() => {}));

    const Harness = () => {
      const ctx = useAnalysis();
      return (
        <div>
          <button
            type="button"
            onClick={() => void ctx.executeCallAction("TERMINATE_CALL", "Hanging test", "CALL-HANG-1")}
          >
            Trigger Hanging Action
          </button>
          <PipelineStrip
            call={null}
            layerStatuses={ctx.layerStatuses}
            isLoading={false}
            operatorActionStatus={ctx.operatorActionStatus}
            operatorActionReason={ctx.operatorActionReason}
          />
          <OperatorActionsCard
            decision="ALLOW"
            guardState={ctx.guardState}
            disabled={false}
            actionStatus={ctx.operatorActionStatus}
            actionReason={ctx.operatorActionReason}
            onAction={() => {}}
          />
        </div>
      );
    };

    render(
      <AnalysisProvider>
        <Harness />
      </AnalysisProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger Hanging Action" }));
    });
    expect(screen.getByText("RUNNING")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30005);
      await Promise.resolve();
    });

    expect(screen.getByText("TIMED OUT")).toBeInTheDocument();
    expect(screen.getByText("Timed out (30s)")).toBeInTheDocument();
    expect(screen.getAllByText(/Operator action timed out after 30 s/i).length).toBeGreaterThanOrEqual(1);
  });
});
