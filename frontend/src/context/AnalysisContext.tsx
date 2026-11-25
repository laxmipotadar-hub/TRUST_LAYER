import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type {
  CallReportResponse,
  CallSession,
  CreditsResponse,
  ExecutionMode,
  GuardState,
  HealthResponse,
  LayerRunStatus,
  ScenarioDefinition,
  SecretsStatusResponse,
  SettingsResponse,
  VoiceprintRecord,
} from "../types";
import { aegisApi, type ExtendedApiError } from "../lib/api";
import { useBotGuard } from "../features/botguard/useBotGuard";

export interface LayerStatuses {
  aletheia: LayerRunStatus;
  eidos: LayerRunStatus;
  script: LayerRunStatus;
  manipulation: LayerRunStatus;
}

interface AnalysisContextType {
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => Promise<void>;
  health: HealthResponse | null;
  settings: SettingsResponse | null;
  secretsStatus: SecretsStatusResponse | null;
  credits: CreditsResponse | null;
  scenarios: ScenarioDefinition[];
  currentCall: CallSession | null;
  callHistory: CallSession[];
  reports: CallReportResponse[];
  voiceprints: VoiceprintRecord[];
  activeScenarioId: string | null;
  layerStatuses: LayerStatuses;
  isLoading: boolean;
  error: ExtendedApiError | null;
  backendOffline: boolean;
  isLivenessModalOpen: boolean;
  isTechnicalDrawerOpen: boolean;
  setLivenessModalOpen: (open: boolean) => void;
  setTechnicalDrawerOpen: (open: boolean) => void;
  guardState: GuardState;
  guardEnabled: boolean;
  guardThreshold: number;
  guardReason: string;
  speechSupported: boolean;
  setGuardEnabled: (enabled: boolean) => Promise<void>;
  setGuardThreshold: (val: number) => Promise<void>;
  startBotAction: () => void;
  resumeBotAction: () => void;
  runScenario: (scenarioId: "S1" | "S2" | "S3" | "S4") => Promise<void>;
  analyzeLiveAudio: (params: {
    file?: Blob;
    filename?: string;
    transcript_text: string;
    claimed_customer_id: string;
    caller_label?: string;
    duration_hint_sec?: number;
  }) => Promise<CallSession | null>;
  executeCallAction: (action: string, note?: string) => Promise<void>;
  submitFeedback: (
    callId: string,
    payload: { is_scam: boolean | null; label: "SCAM" | "LEGITIMATE" | "UNCERTAIN"; notes: string }
  ) => Promise<void>;
  applyUpdatedCall: (call: CallSession) => void;
  refreshSystem: () => Promise<void>;
  refreshVoiceprints: () => Promise<void>;
  refreshReports: () => Promise<void>;
  refreshCalls: () => Promise<void>;
  resetError: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

function deriveLayerStatuses(call: CallSession | null, isLoading: boolean): LayerStatuses {
  if (isLoading) {
    return { aletheia: "running", eidos: "queued", script: "running", manipulation: "running" };
  }
  if (!call) {
    return { aletheia: "queued", eidos: "queued", script: "queued", manipulation: "queued" };
  }
  const mapSt = (st: string): LayerRunStatus => {
    if (st === "UNAVAILABLE" || st === "ERROR" || st === "AUTH_ERROR" || st === "INSUFFICIENT_CREDITS") {
      return "error";
    }
    if (st === "SKIPPED") return "skipped";
    return "done";
  };
  return {
    aletheia: call.voice_authenticity.status === "UNAVAILABLE" ? "error" : "done",
    eidos:
      call.model_status?.eidos === "SKIPPED"
        ? "skipped"
        : call.speaker_identity.status === "UNAVAILABLE"
        ? "error"
        : "done",
    script: mapSt(call.model_status?.scam_analysis || "OK"),
    manipulation: "done",
  };
}

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to LIVE execution mode per Step 1 requirement
  const [executionMode, setExecutionModeState] = useState<ExecutionMode>("LIVE");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [secretsStatus, setSecretsStatus] = useState<SecretsStatusResponse | null>(null);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [reports, setReports] = useState<CallReportResponse[]>([]);
  const [voiceprints, setVoiceprints] = useState<VoiceprintRecord[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ExtendedApiError | null>(null);
  const [backendOffline, setBackendOffline] = useState<boolean>(false);
  const [isLivenessModalOpen, setLivenessModalOpen] = useState<boolean>(false);
  const [isTechnicalDrawerOpen, setTechnicalDrawerOpen] = useState<boolean>(false);

  const botGuard = useBotGuard(currentCall, () => {});

  const refreshVoiceprints = useCallback(async () => {
    try {
      const list = await aegisApi.getVoiceprints();
      setVoiceprints(list);
    } catch {
      // handled at caller view
    }
  }, []);

  const refreshCalls = useCallback(async () => {
    try {
      const list = await aegisApi.listCalls(40);
      setCallHistory(list);
    } catch {
      // handled gracefully
    }
  }, []);

  const refreshReports = useCallback(async () => {
    try {
      const list = await aegisApi.listReports(40);
      setReports(list);
    } catch {
      // handled gracefully
    }
  }, []);

  const refreshSystem = useCallback(async () => {
    try {
      const [h, st, sec, cr, sc] = await Promise.all([
        aegisApi.getHealth(),
        aegisApi.getSettings(),
        aegisApi.getSecretsStatus(),
        aegisApi.getCredits(),
        aegisApi.getScenarios(),
      ]);
      setHealth(h);
      setSettings(st);
      setSecretsStatus(sec);
      setCredits(cr);
      setScenarios(sc);
      setBackendOffline(false);
      botGuard.setGuardEnabled(st.bot_guard_enabled);
      botGuard.setThreshold(st.bot_guard_threshold);
    } catch {
      setBackendOffline(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshSystem();
    void refreshVoiceprints();
    void refreshCalls();
    void refreshReports();
  }, [refreshSystem, refreshVoiceprints, refreshCalls, refreshReports]);

  const setExecutionMode = useCallback(
    async (nextMode: ExecutionMode) => {
      setExecutionModeState(nextMode);
      setError(null);
      if (nextMode === "LIVE") {
        setActiveScenarioId(null);
        // Never keep DEMO fixture call active when entering LIVE mode
        if (currentCall?.execution_mode === "DEMO" || currentCall?.scenario_id) {
          setCurrentCall(null);
        }
      }
      try {
        const updated = await aegisApi.updateSettings({
          app_mode: nextMode === "DEMO" ? "DEMO" : "REAL",
          cache_enabled: nextMode === "CACHED",
        });
        setSettings(updated);
        await refreshSystem();
      } catch {
        // surfaced cleanly in UI
      }
    },
    [currentCall, refreshSystem]
  );

  const setGuardEnabled = useCallback(
    async (enabled: boolean) => {
      botGuard.setGuardEnabled(enabled);
      try {
        const updated = await aegisApi.updateSettings({ bot_guard_enabled: enabled });
        setSettings(updated);
      } catch {
        // ignore
      }
    },
    [botGuard]
  );

  const setGuardThreshold = useCallback(
    async (val: number) => {
      botGuard.setThreshold(val);
      try {
        const updated = await aegisApi.updateSettings({ bot_guard_threshold: val });
        setSettings(updated);
      } catch {
        // ignore
      }
    },
    [botGuard]
  );

  const runScenario = useCallback(
    async (scenarioId: "S1" | "S2" | "S3" | "S4") => {
      if (executionMode === "LIVE") {
        setError({
          code: "live_blocks_demo",
          message: "Demo fixtures (S1-S4) are disabled in LIVE mode. Switch to DEMO mode or record live audio.",
        });
        return;
      }
      setIsLoading(true);
      setError(null);
      setActiveScenarioId(scenarioId);
      botGuard.resetGuard();
      try {
        const session = await aegisApi.runScenario(scenarioId);
        setCurrentCall(session);
        await aegisApi.getCallReport(session.call_id).catch(() => null);
        await Promise.all([refreshCalls(), refreshReports()]);
        if (scenarioId === "S3") {
          window.setTimeout(() => setLivenessModalOpen(true), 250);
        }
      } catch (err) {
        setError(err as ExtendedApiError);
      } finally {
        setIsLoading(false);
      }
    },
    [executionMode, botGuard, refreshCalls, refreshReports]
  );

  const analyzeLiveAudio = useCallback(
    async (params: {
      file?: Blob;
      filename?: string;
      transcript_text: string;
      claimed_customer_id: string;
      caller_label?: string;
      duration_hint_sec?: number;
    }): Promise<CallSession | null> => {
      setIsLoading(true);
      setError(null);
      setActiveScenarioId(null);
      botGuard.resetGuard();
      try {
        const res = await aegisApi.analyzeCall({
          ...params,
          execution_mode: executionMode,
          previous_score: currentCall?.trust_score ?? null,
        });
        setCurrentCall(res.session);
        await aegisApi.getCallReport(res.call_id).catch(() => null);
        await Promise.all([refreshSystem(), refreshCalls(), refreshReports(), refreshVoiceprints()]);
        return res.session;
      } catch (err) {
        setError(err as ExtendedApiError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [executionMode, currentCall, botGuard, refreshSystem, refreshCalls, refreshReports, refreshVoiceprints]
  );

  const executeCallAction = useCallback(
    async (action: string, note = "") => {
      if (!currentCall) return;
      if (action === "CHALLENGE" || action === "STEP_UP_CHALLENGE") {
        setLivenessModalOpen(true);
      } else if (action === "PAUSE_BOT") {
        botGuard.pauseBot(note || "Operator paused automated greeting.");
      } else if (action === "TRANSFER_TO_HUMAN") {
        botGuard.transferToHuman();
      }
      try {
        await aegisApi.postCallAction(currentCall.call_id, action, note);
        const refreshed = await aegisApi.getCall(currentCall.call_id);
        setCurrentCall(refreshed);
        await aegisApi.getCallReport(currentCall.call_id).catch(() => null);
        await Promise.all([refreshCalls(), refreshReports()]);
      } catch (err) {
        setError(err as ExtendedApiError);
      }
    },
    [currentCall, botGuard, refreshCalls, refreshReports]
  );

  const submitFeedback = useCallback(
    async (
      callId: string,
      payload: { is_scam: boolean | null; label: "SCAM" | "LEGITIMATE" | "UNCERTAIN"; notes: string }
    ) => {
      const updated = await aegisApi.postCallFeedback(callId, payload);
      if (currentCall?.call_id === callId) setCurrentCall(updated);
      await Promise.all([refreshCalls(), refreshReports()]);
    },
    [currentCall, refreshCalls, refreshReports]
  );

  const applyUpdatedCall = useCallback(
    (call: CallSession) => {
      setCurrentCall(call);
      void refreshCalls();
      void refreshReports();
    },
    [refreshCalls, refreshReports]
  );

  return (
    <AnalysisContext.Provider
      value={{
        executionMode,
        setExecutionMode,
        health,
        settings,
        secretsStatus,
        credits,
        scenarios,
        currentCall,
        callHistory,
        reports,
        voiceprints,
        activeScenarioId,
        layerStatuses: deriveLayerStatuses(currentCall, isLoading),
        isLoading,
        error,
        backendOffline,
        isLivenessModalOpen,
        isTechnicalDrawerOpen,
        setLivenessModalOpen,
        setTechnicalDrawerOpen,
        guardState: botGuard.guardState,
        guardEnabled: botGuard.guardEnabled,
        guardThreshold: botGuard.threshold,
        guardReason: botGuard.guardReason,
        speechSupported: botGuard.speechSupported,
        setGuardEnabled,
        setGuardThreshold,
        startBotAction: botGuard.startBot,
        resumeBotAction: botGuard.resumeByOperator,
        runScenario,
        analyzeLiveAudio,
        executeCallAction,
        submitFeedback,
        applyUpdatedCall,
        refreshSystem,
        refreshVoiceprints,
        refreshReports,
        refreshCalls,
        resetError: () => setError(null),
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export function useAnalysis(): AnalysisContextType {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within an AnalysisProvider");
  return ctx;
}
