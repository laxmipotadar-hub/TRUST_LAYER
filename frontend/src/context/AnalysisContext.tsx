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
  asr: LayerRunStatus;
  aletheia: LayerRunStatus;
  eidos: LayerRunStatus;
  script: LayerRunStatus;
  manipulation: LayerRunStatus;
}

export interface ToastNotification {
  id: number;
  variant: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
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
  executeCallAction: (action: string, note?: string, callIdOverride?: string) => Promise<CallSession | null>;
  toast: ToastNotification | null;
  showToast: (t: Omit<ToastNotification, "id">) => void;
  dismissToast: () => void;
  retryLastAnalysis: () => Promise<void>;
  clearCurrentCall: () => void;
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
    return {
      asr: "running",
      aletheia: "running",
      eidos: "queued",
      script: "running",
      manipulation: "running",
    };
  }
  if (!call) {
    return {
      asr: "queued",
      aletheia: "queued",
      eidos: "queued",
      script: "queued",
      manipulation: "queued",
    };
  }
  const mapSt = (st: string): LayerRunStatus => {
    if (st === "UNAVAILABLE") return "unavailable";
    if (
      st === "ERROR" ||
      st === "AUTH_ERROR" ||
      st === "INSUFFICIENT_CREDITS" ||
      st === "RATE_LIMITED" ||
      st === "TIMEOUT" ||
      st === "NOT_FOUND" ||
      st === "PROVIDER_ERROR" ||
      st === "INVALID_RESPONSE"
    ) {
      return "error";
    }
    if (st === "SKIPPED" || st === "skipped") return "skipped";
    return "done";
  };
  const eidosStatusRaw = String(call.speaker_identity.status || "");
  const eidosSt: LayerRunStatus =
    eidosStatusRaw.toLowerCase() === "skipped" || call.model_status?.eidos === "SKIPPED"
      ? "skipped"
      : eidosStatusRaw === "UNAVAILABLE" || eidosStatusRaw === "error"
      ? "error"
      : mapSt(call.model_status?.eidos || "OK");
  const scriptUnavailable =
    call.scam_analysis.status === "UNAVAILABLE" ||
    call.scam_analysis.risk_score === null ||
    call.model_status?.scam_analysis === "UNAVAILABLE";
  const manipUnavailable =
    call.manipulation_analysis.status === "UNAVAILABLE" ||
    call.manipulation_analysis.score === null ||
    call.model_status?.manipulation === "UNAVAILABLE";
  const hasRealTranscript = call.transcript.some(
    (seg) => seg.text.trim() && !seg.text.trim().startsWith("[Audio sample:")
  );
  const asrUnavailable =
    call.model_status?.asr === "UNAVAILABLE" || (!hasRealTranscript && scriptUnavailable);

  return {
    asr: asrUnavailable ? "unavailable" : "done",
    aletheia: call.voice_authenticity.status === "UNAVAILABLE" ? "error" : "done",
    eidos: eidosSt,
    script: scriptUnavailable ? "unavailable" : mapSt(call.model_status?.scam_analysis || "OK"),
    manipulation: manipUnavailable ? "unavailable" : "done",
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
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);
  const showToast = useCallback((t: Omit<ToastNotification, "id">) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = Date.now();
    setToast({ id, ...t });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  }, []);
  const lastAudioParamsRef = React.useRef<{
    file?: Blob;
    filename?: string;
    transcript_text: string;
    claimed_customer_id: string;
    caller_label?: string;
    duration_hint_sec?: number;
  } | null>(null);

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
      lastAudioParamsRef.current = params;
      botGuard.resetGuard();
      try {
        const res = await aegisApi.analyzeCall({
          ...params,
          execution_mode: executionMode,
          previous_score: null,
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
    async (action: string, note = "", callIdOverride?: string): Promise<CallSession | null> => {
      const targetCallId = callIdOverride || currentCall?.call_id;
      if (!targetCallId) {
        showToast({
          variant: "warning",
          title: "No Active Call",
          message: "Start or analyze a call before running operator actions.",
        });
        return null;
      }
      if (action === "CHALLENGE" || action === "STEP_UP_CHALLENGE") {
        setLivenessModalOpen(true);
      } else if (action === "PAUSE_BOT") {
        botGuard.pauseBot(note || "Operator paused automated greeting.");
      } else if (action === "TRANSFER_TO_HUMAN") {
        botGuard.transferToHuman();
      }
      try {
        await aegisApi.postCallAction(targetCallId, action, note);
        const refreshed = await aegisApi.getCall(targetCallId);
        if (!callIdOverride || currentCall?.call_id === targetCallId) {
          setCurrentCall(refreshed);
        }
        await aegisApi.getCallReport(targetCallId).catch(() => null);
        await Promise.all([refreshCalls(), refreshReports()]);
        showToast({
          variant: action === "TERMINATE_CALL" || action === "BLOCK_CALL" ? "error" : action === "ALLOW" ? "success" : "info",
          title: `Action Executed: ${action}`,
          message: note || `Updated call ${targetCallId} and recorded audit entry.`,
        });
        return refreshed;
      } catch (err) {
        const apiErr = err as ExtendedApiError;
        setError(apiErr);
        showToast({
          variant: "error",
          title: `Action Failed: ${action}`,
          message: apiErr?.message || "Backend call action failed.",
        });
        return null;
      }
    },
    [currentCall, botGuard, refreshCalls, refreshReports, showToast]
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

  const clearCurrentCall = useCallback(() => {
    setCurrentCall(null);
    setError(null);
    setActiveScenarioId(null);
  }, []);

  const retryLastAnalysis = useCallback(async () => {
    if (lastAudioParamsRef.current) {
      await analyzeLiveAudio(lastAudioParamsRef.current);
      return;
    }
    if (activeScenarioId === "S1" || activeScenarioId === "S2" || activeScenarioId === "S3" || activeScenarioId === "S4") {
      await runScenario(activeScenarioId);
    }
  }, [analyzeLiveAudio, activeScenarioId, runScenario]);

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
        toast,
        showToast,
        dismissToast,
        retryLastAnalysis,
        clearCurrentCall,
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
