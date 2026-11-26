import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AnalysisProvider, useAnalysis } from "../../../context/AnalysisContext";
import { PhonePanel } from "../PhonePanel";
import { OperatorActionsCard } from "../../analyze/OperatorActionsCard";
import { CallerPhoneScreen } from "../CallerPhoneScreen";
import { PhoneErrorBoundary } from "../PhoneErrorBoundary";

const mockStartRecording = vi.fn().mockResolvedValue(false);
const mockStopRecording = vi.fn().mockResolvedValue(null);

vi.mock("../../../lib/audio", () => ({
  useRecorder: () => ({
    status: "error",
    level: 0,
    elapsedSeconds: 0,
    errorReason: "PERMISSION_DENIED",
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    cancelRecording: vi.fn(),
  }),
  AudioCaptureHelper: class {
    start = vi.fn();
    stop = vi.fn();
  },
  transcodeBlobToWav16k: vi.fn(),
}));

vi.mock("../../../lib/api", () => ({
  aegisApi: {
    getHealth: vi.fn().mockResolvedValue({ status: "ok", detectifai: "SET", groq: "SET" }),
    getSettings: vi.fn().mockResolvedValue({
      app_mode: "DEMO",
      cache_enabled: true,
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
    getCredits: vi.fn().mockResolvedValue({ available: 3400, reserved: 0, currency: "credits", configured: true, latency_ms: 10 }),
    getScenarios: vi.fn().mockResolvedValue([]),
    getVoiceprints: vi.fn().mockResolvedValue([]),
    listCalls: vi.fn().mockResolvedValue([]),
    listReports: vi.fn().mockResolvedValue([]),
    runScenario: vi.fn().mockRejectedValue(new Error("Offline fixture fallback")),
    postCallAction: vi.fn().mockResolvedValue({ call_id: "c1", updated_status: "OK" }),
    getCall: vi.fn().mockResolvedValue(null),
    getCallReport: vi.fn().mockResolvedValue(null),
  },
}));

class FakeAudioContext {
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  resume = vi.fn().mockRejectedValue(new Error("Autoplay blocked without gesture"));
  createGain = vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
  createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }));
  destination = {};
}

const DashboardAndPhoneHarness: React.FC = () => {
  const { phoneState, guardState, executeCallAction, simulateIncomingPhoneCall, phoneDispatch } = useAnalysis();
  return (
    <div>
      <button
        type="button"
        onClick={() => phoneDispatch({ type: "START_CHALLENGE", phrase: "cobalt mango seven" })}
      >
        Force Challenge State
      </button>
      <OperatorActionsCard
        decision={phoneState.decision || undefined}
        guardState={guardState}
        disabled={false}
        hasActiveSession={phoneState.callState !== "idle"}
        isRecordingOrStreaming={false}
        onAction={(act, note) => void executeCallAction(act, note)}
      />
      <PhonePanel />
      <button type="button" onClick={simulateIncomingPhoneCall}>
        Manual Trigger Ring
      </button>
    </div>
  );
};

describe("PhonePanel UI, Ringtone & Two-Way Sync", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    mockStartRecording.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("switches views cleanly, shows autoplay fallback when suspended, and handles incoming call accept/decline", async () => {
    render(
      <AnalysisProvider>
        <DashboardAndPhoneHarness />
      </AnalysisProvider>
    );

    // Wait for initial async effects to settle, then trigger incoming call via PhonePanel
    const simBtn = await screen.findByRole("button", { name: "Simulate incoming call" });
    fireEvent.click(simBtn);

    // Suspended AudioContext shows Tap to enable sound fallback
    await waitFor(() => {
      expect(screen.getByText("Tap to enable sound")).toBeInTheDocument();
    });

    // Switch to Agent phone and accept call
    fireEvent.click(screen.getByRole("tab", { name: "Agent phone" }));
    expect(screen.getByRole("button", { name: "Accept incoming call" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline incoming call" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept incoming call" }));
    await waitFor(() => {
      expect(screen.getByTestId("agent-phone-screen")).toHaveAttribute("data-screen-state", "connecting");
    });

    // Side by side renders both frames cleanly
    fireEvent.click(screen.getByRole("tab", { name: "Side by side" }));
    expect(screen.getByTestId("caller-phone-screen")).toBeInTheDocument();
    expect(screen.getByTestId("agent-phone-screen")).toBeInTheDocument();

    // Dashboard action (Pause Bot -> On Hold) syncs synchronously to both phones
    fireEvent.click(screen.getAllByRole("button", { name: /^Pause bot$/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "on_hold");
      expect(screen.getByTestId("agent-phone-screen")).toHaveAttribute("data-screen-state", "on_hold");
    });

    // End call syncs immediately
    fireEvent.click(screen.getAllByRole("button", { name: /^End call$/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "ended");
    });
  });

  it("handles denied microphone cleanly inside CallerPhoneScreen challenge reply", async () => {
    const ChallengeRunner: React.FC = () => {
      const { phoneDispatch } = useAnalysis();
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              phoneDispatch({ type: "START_ANALYZING" });
              phoneDispatch({ type: "START_CHALLENGE", phrase: "cobalt mango seven" });
            }}
          >
            Enter Challenge
          </button>
          <CallerPhoneScreen />
        </div>
      );
    };

    render(
      <AnalysisProvider>
        <ChallengeRunner />
      </AnalysisProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Enter Challenge" }));
    const replyBtn = await screen.findByRole("button", { name: "Start Voice Reply" });
    fireEvent.click(replyBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Microphone unavailable");
    });
  });

  it("catches render failures inside PhoneErrorBoundary", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken: React.FC = () => {
      throw new Error("Simulated phone crash");
    };
    render(
      <PhoneErrorBoundary>
        <Broken />
      </PhoneErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Phone preview unavailable, reload");
    spy.mockRestore();
  });
});
