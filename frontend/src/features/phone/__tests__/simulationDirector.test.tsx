import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AnalysisProvider, useAnalysis } from "../../../context/AnalysisContext";

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

describe("Simulation Director & Phone Timers", () => {
  let latestCtx: ReturnType<typeof useAnalysis> | null = null;

  const Harness: React.FC = () => {
    const ctx = useAnalysis();
    React.useEffect(() => {
      latestCtx = ctx;
    }, [ctx]);
    return null;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    latestCtx = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks through S1, S2, S3, and S4 to expected final states", async () => {
    render(
      <AnalysisProvider>
        <Harness />
      </AnalysisProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    // S1: Genuine -> caller hangs up
    await act(async () => {
      latestCtx!.playScenario("S1");
    });
    expect(latestCtx!.phoneState.callState).toBe("incoming_ringing");

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }
    expect(latestCtx!.phoneState.callState).toBe("ended");
    expect(latestCtx!.phoneState.endReason).toBe("caller_hung_up");
    expect(latestCtx!.directorStatus).toBe("idle");

    // S2: Voice Clone -> END_CALL (security_end)
    await act(async () => {
      latestCtx!.playScenario("S2");
    });
    for (let i = 0; i < 14; i++) {
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }
    expect(latestCtx!.phoneState.callState).toBe("ended");
    expect(latestCtx!.phoneState.endReason).toBe("security_end");
    expect(latestCtx!.phoneState.decision).toBe("END_CALL");

    // S3: Replay + Challenge failed -> END_CALL
    await act(async () => {
      latestCtx!.playScenario("S3");
    });
    for (let i = 0; i < 22; i++) {
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }
    expect(latestCtx!.phoneState.callState).toBe("ended");
    expect(latestCtx!.phoneState.endReason).toBe("security_end");
    expect(latestCtx!.phoneState.challengeOutcome).toBe("failed");

    // S4: Social engineering -> with_agent with coercive bubble
    await act(async () => {
      latestCtx!.playScenario("S4");
    });
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }
    expect(latestCtx!.phoneState.callState).toBe("with_agent");
    expect(latestCtx!.phoneState.transcriptBubbles.length).toBeGreaterThan(0);
  });

  it("yields mid-scenario to operator action and lets operator resume scenario", async () => {
    render(
      <AnalysisProvider>
        <Harness />
      </AnalysisProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      latestCtx!.playScenario("S4");
    });
    expect(latestCtx!.directorStatus).toBe("playing");

    for (let i = 0; i < 9; i++) {
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }
    expect(latestCtx!.phoneState.callState).toBe("connected_restricted");

    // Operator intervenes mid-S4
    await act(async () => {
      await latestCtx!.executeCallAction("TERMINATE_CALL", "Blocked manually mid-scenario");
    });
    expect(latestCtx!.directorStatus).toBe("yielded");
    expect(latestCtx!.phoneState.callState).toBe("ended");
    expect(latestCtx!.phoneState.endReason).toBe("operator_ended");

    // Advance time — yielded director must NOT override operator action
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(latestCtx!.phoneState.callState).toBe("ended");

    // Resume scenario works cleanly
    await act(async () => {
      latestCtx!.resumeScenario();
    });
    expect(latestCtx!.directorStatus).toBe("playing");
  });

  it("marks unanswered incoming call as missed after 25s ring timeout", async () => {
    render(
      <AnalysisProvider>
        <Harness />
      </AnalysisProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      latestCtx!.simulateIncomingPhoneCall();
    });
    expect(latestCtx!.phoneState.callState).toBe("incoming_ringing");

    for (let i = 0; i < 25; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(latestCtx!.phoneState.callState).toBe("ended");
    expect(latestCtx!.phoneState.endReason).toBe("missed");
  });
});
