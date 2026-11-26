import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  CallReportResponse,
  CallSession,
  CreditsResponse,
  ExecutionMode,
  GuardState,
  HealthResponse,
  LayerRunStatus,
  ScenarioDefinition,
  ScenarioId,
  SecretsStatusResponse,
  SettingsResponse,
  VoiceprintRecord,
} from "../types";
import { aegisApi, type ExtendedApiError } from "../lib/api";
import { useBotGuard } from "../features/botguard/useBotGuard";
import {
  derivePipelineStagesFromPhone,
  INITIAL_PHONE_STATE,
  phoneReducer,
  selectPhoneViewModel,
  type AgentPhoneViewModel,
  type CallerPhoneViewModel,
  type PhoneAction,
  type PhoneMachineState,
  type PipelinePhoneStageStatuses,
} from "../features/phone/phoneStateMachine";
import { ringtonePlayer, type RingtoneStatus } from "../features/phone/ringtone";
import { SCENARIO_SCRIPTS } from "../features/phone/simulationDirector";

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
  selectedCustomerId: string;
  setSelectedCustomerId: (customerId: string) => void;
  activeScenarioId: string | null;
  layerStatuses: LayerStatuses;
  pipelinePhoneStages: PipelinePhoneStageStatuses;
  phoneState: PhoneMachineState;
  phoneDispatch: React.Dispatch<PhoneAction>;
  showPhone: boolean;
  setShowPhone: (show: boolean) => void;
  directorStatus: "idle" | "playing" | "paused" | "yielded";
  directorScenarioId: ScenarioId | null;
  directorSpeed: 1 | 2;
  directorStepIndex: number;
  playScenario: (scenarioId: ScenarioId) => void;
  pauseDirector: () => void;
  resumeScenario: () => void;
  stepDirectorNext: (scenarioId?: ScenarioId) => void;
  resetDirector: () => void;
  setDirectorSpeed: (speed: 1 | 2) => void;
  ringtoneStatus: RingtoneStatus;
  toggleRingtoneMute: () => void;
  unlockRingtoneAudio: () => Promise<void>;
  setPhoneAudioLevel: (level: number) => void;
  acceptIncomingPhoneCall: () => void;
  declineIncomingPhoneCall: () => void;
  callerHangUpPhoneCall: () => void;
  simulateIncomingPhoneCall: () => void;
  triggerCallerMissedTimeout: () => void;
  operatorActionStatus: "idle" | "running" | "done" | "error" | "timeout";
  operatorActionReason: string | null;
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("CUST-4821-MARCUS");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ExtendedApiError | null>(null);
  const [backendOffline, setBackendOffline] = useState<boolean>(false);
  const [isLivenessModalOpen, setLivenessModalOpen] = useState<boolean>(false);
  const [isTechnicalDrawerOpen, setTechnicalDrawerOpen] = useState<boolean>(false);
  const [showPhone, setShowPhone] = useState<boolean>(true);
  const [operatorActionStatus, setOperatorActionStatus] = useState<
    "idle" | "running" | "done" | "error" | "timeout"
  >("idle");
  const [operatorActionReason, setOperatorActionReason] = useState<string | null>(null);
  const [phoneState, rawPhoneDispatch] = useReducer(phoneReducer, INITIAL_PHONE_STATE);
  const [directorStatus, setDirectorStatus] = useState<"idle" | "playing" | "paused" | "yielded">("idle");
  const [directorScenarioId, setDirectorScenarioId] = useState<ScenarioId | null>(null);
  const [directorSpeed, setDirectorSpeed] = useState<1 | 2>(1);
  const [directorStepIndex, setDirectorStepIndex] = useState<number>(0);
  const [ringtoneStatus, setRingtoneStatus] = useState<RingtoneStatus>(() => ringtonePlayer.getStatus());
  const directorRunTokenRef = useRef<number>(0);
  const phoneCallStateRef = useRef(phoneState.callState);
  useEffect(() => {
    phoneCallStateRef.current = phoneState.callState;
  }, [phoneState.callState]);
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

  const resolveCustomerName = useCallback(
    (customerId: string, fallback = "Marcus Vance") => {
      const vp = voiceprints.find((v) => v.customer_id === customerId);
      return vp?.customer_name || fallback;
    },
    [voiceprints]
  );

  // Sync ringtone lifecycle with incoming_ringing state cleanly under StrictMode
  useEffect(() => {
    const unsub = ringtonePlayer.subscribe(setRingtoneStatus);
    return () => {
      unsub();
      ringtonePlayer.stop();
    };
  }, []);

  useEffect(() => {
    if (phoneState.callState === "incoming_ringing") {
      void ringtonePlayer.start();
    } else {
      ringtonePlayer.stop();
    }
  }, [phoneState.callState]);

  // 1s timer interval for call duration, ring timer, and challenge countdown
  const phoneActiveForTimer =
    phoneState.callState !== "idle" && phoneState.callState !== "ended";
  useEffect(() => {
    if (!phoneActiveForTimer) return;
    const id = window.setInterval(() => {
      rawPhoneDispatch({ type: "TICK_CALL_TIMER" });
      rawPhoneDispatch({ type: "CHALLENGE_TICK" });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phoneActiveForTimer]);

  // Auto-miss after 25 seconds of unanswered incoming ringing
  useEffect(() => {
    if (phoneState.callState === "incoming_ringing" && phoneState.ringElapsedSeconds >= 25) {
      rawPhoneDispatch({ type: "RING_TIMEOUT_MISSED", actor: "system" });
    }
  }, [phoneState.callState, phoneState.ringElapsedSeconds]);

  // Complete manual incoming call connecting transition when Director isn't driving
  useEffect(() => {
    if (
      phoneState.callState === "connecting" &&
      directorStatus === "idle" &&
      !phoneState.scenarioId
    ) {
      const id = window.setTimeout(() => {
        rawPhoneDispatch({
          type: "ANALYSIS_COMPLETE",
          actor: "system",
          decision: "ALLOW",
          recommendedAction: "Call connected — ready for servicing or verification.",
          isDemo: true,
        });
      }, 900);
      return () => window.clearTimeout(id);
    }
  }, [phoneState.callState, phoneState.scenarioId, directorStatus]);

  // Complete manual transfer-to-human transition when Director isn't driving
  useEffect(() => {
    if (phoneState.callState === "transferring" && directorStatus === "idle") {
      const id = window.setTimeout(() => {
        rawPhoneDispatch({ type: "AGENT_CONNECTED", actor: "system" });
      }, 1600);
      return () => window.clearTimeout(id);
    }
  }, [phoneState.callState, directorStatus]);

  const yieldDirectorIfPlaying = useCallback(() => {
    setDirectorStatus((prev) => (prev === "playing" ? "yielded" : prev));
  }, []);

  // Sequential Simulation Director scheduler (DEMO fixtures only — 0 paid API calls)
  useEffect(() => {
    if (directorStatus !== "playing" || !directorScenarioId) return;
    const script = SCENARIO_SCRIPTS[directorScenarioId];
    if (!script || directorStepIndex >= script.steps.length) {
      setDirectorStatus("idle");
      return;
    }

    const nextStep = script.steps[directorStepIndex];
    const prevOffsetMs =
      directorStepIndex > 0 ? script.steps[directorStepIndex - 1].offsetMs : 0;
    const delayMs = Math.max(50, Math.round((nextStep.offsetMs - prevOffsetMs) / directorSpeed));
    const runToken = directorRunTokenRef.current;

    const timerId = window.setTimeout(() => {
      if (directorRunTokenRef.current !== runToken) return;
      rawPhoneDispatch(nextStep.action);
      if (nextStep.action.type === "ANALYSIS_COMPLETE") {
        setActiveScenarioId(directorScenarioId);
        void aegisApi
          .runScenario(directorScenarioId)
          .then((sess) => {
            if (directorRunTokenRef.current !== runToken) return;
            setCurrentCall(sess);
          })
          .catch(() => null);
      }
      const nextIdx = directorStepIndex + 1;
      setDirectorStepIndex(nextIdx);
      if (nextIdx >= script.steps.length) {
        setDirectorStatus("idle");
      }
    }, delayMs);

    return () => window.clearTimeout(timerId);
  }, [directorStatus, directorScenarioId, directorStepIndex, directorSpeed]);

  const playScenario = useCallback((scenarioId: ScenarioId) => {
    const script = SCENARIO_SCRIPTS[scenarioId];
    if (!script || script.steps.length === 0) return;
    directorRunTokenRef.current += 1;
    setExecutionModeState("DEMO");
    setError(null);
    setActiveScenarioId(scenarioId);
    rawPhoneDispatch({ type: "RESET_PHONE", actor: "system" });
    rawPhoneDispatch(script.steps[0].action);
    setDirectorScenarioId(scenarioId);
    setDirectorStepIndex(1);
    setDirectorStatus(script.steps.length > 1 ? "playing" : "idle");
  }, []);

  const pauseDirector = useCallback(() => {
    setDirectorStatus((prev) => (prev === "playing" ? "paused" : prev));
  }, []);

  const resumeScenario = useCallback(() => {
    if (!directorScenarioId) return;
    const script = SCENARIO_SCRIPTS[directorScenarioId];
    if (!script || directorStepIndex >= script.steps.length) {
      setDirectorStatus("idle");
      return;
    }
    setDirectorStatus("playing");
  }, [directorScenarioId, directorStepIndex]);

  const stepDirectorNext = useCallback(
    (scenarioId?: ScenarioId) => {
      const targetId = scenarioId || directorScenarioId || "S1";
      const script = SCENARIO_SCRIPTS[targetId];
      if (!script || script.steps.length === 0) return;

      let stepIdx = directorStepIndex;
      if (directorScenarioId !== targetId || stepIdx >= script.steps.length) {
        directorRunTokenRef.current += 1;
        setExecutionModeState("DEMO");
        setDirectorScenarioId(targetId);
        rawPhoneDispatch({ type: "RESET_PHONE", actor: "system" });
        stepIdx = 0;
      }

      const step = script.steps[stepIdx];
      rawPhoneDispatch(step.action);
      if (step.action.type === "ANALYSIS_COMPLETE") {
        setActiveScenarioId(targetId);
        void aegisApi
          .runScenario(targetId)
          .then((sess) => {
            setCurrentCall(sess);
          })
          .catch(() => null);
      }
      const nextIdx = stepIdx + 1;
      setDirectorStepIndex(nextIdx);
      setDirectorStatus(nextIdx >= script.steps.length ? "idle" : "paused");
    },
    [directorScenarioId, directorStepIndex]
  );

  const resetDirector = useCallback(() => {
    directorRunTokenRef.current += 1;
    setDirectorStatus("idle");
    setDirectorStepIndex(0);
    setActiveScenarioId(null);
    setCurrentCall(null);
    rawPhoneDispatch({ type: "RESET_PHONE", actor: "system" });
  }, []);

  const toggleRingtoneMute = useCallback(() => {
    ringtonePlayer.setMuted(!ringtonePlayer.getStatus().muted);
  }, []);

  const unlockRingtoneAudio = useCallback(async () => {
    await ringtonePlayer.unlockAndStart();
  }, []);

  const setPhoneAudioLevel = useCallback((level: number) => {
    rawPhoneDispatch({ type: "SET_AUDIO_LEVEL", level });
  }, []);

  const acceptIncomingPhoneCall = useCallback(() => {
    yieldDirectorIfPlaying();
    rawPhoneDispatch({ type: "AGENT_ACCEPT_CALL", actor: "operator" });
  }, [yieldDirectorIfPlaying]);

  const declineIncomingPhoneCall = useCallback(() => {
    yieldDirectorIfPlaying();
    rawPhoneDispatch({ type: "AGENT_DECLINE_CALL", actor: "operator" });
  }, [yieldDirectorIfPlaying]);

  const callerHangUpPhoneCall = useCallback(() => {
    yieldDirectorIfPlaying();
    rawPhoneDispatch({ type: "CALLER_HANG_UP", actor: "caller" });
  }, [yieldDirectorIfPlaying]);

  const simulateIncomingPhoneCall = useCallback(() => {
    directorRunTokenRef.current += 1;
    setDirectorStatus("idle");
    setDirectorStepIndex(0);
    if (phoneCallStateRef.current !== "idle" && phoneCallStateRef.current !== "ended") {
      rawPhoneDispatch({ type: "RESET_PHONE", actor: "system" });
    }
    rawPhoneDispatch({
      type: "SIMULATE_INCOMING_CALL",
      actor: "caller",
      claimedCustomerId: selectedCustomerId,
      claimedIdentity: resolveCustomerName(selectedCustomerId),
      scenarioId: null,
      isDemo: true,
    });
  }, [selectedCustomerId, resolveCustomerName]);

  const triggerCallerMissedTimeout = useCallback(() => {
    directorRunTokenRef.current += 1;
    setDirectorStatus("idle");
    setDirectorStepIndex(0);
    if (phoneCallStateRef.current !== "incoming_ringing") {
      if (phoneCallStateRef.current !== "idle" && phoneCallStateRef.current !== "ended") {
        rawPhoneDispatch({ type: "RESET_PHONE", actor: "system" });
      }
      rawPhoneDispatch({
        type: "SIMULATE_INCOMING_CALL",
        actor: "caller",
        claimedCustomerId: selectedCustomerId,
        claimedIdentity: resolveCustomerName(selectedCustomerId),
        scenarioId: null,
        isDemo: true,
      });
    }
    rawPhoneDispatch({ type: "RING_TIMEOUT_MISSED", actor: "system" });
  }, [selectedCustomerId, resolveCustomerName]);

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
      const script = SCENARIO_SCRIPTS[scenarioId];
      rawPhoneDispatch({
        type: "START_ANALYZING",
        actor: "system",
        claimedCustomerId: script?.claimedCustomerId || selectedCustomerId,
        claimedIdentity: script?.claimedIdentity || resolveCustomerName(selectedCustomerId),
        isDemo: true,
      });
      try {
        const session = await aegisApi.runScenario(scenarioId);
        setCurrentCall(session);
        rawPhoneDispatch({
          type: "ANALYSIS_COMPLETE",
          actor: "system",
          session,
          isDemo: true,
        });
        await aegisApi.getCallReport(session.call_id).catch(() => null);
        await Promise.all([refreshCalls(), refreshReports()]);
        if (scenarioId === "S3") {
          window.setTimeout(() => {
            setLivenessModalOpen(true);
            rawPhoneDispatch({
              type: "START_CHALLENGE",
              actor: "system",
              phrase: "cobalt mango seven",
              expiresInSeconds: 20,
            });
          }, 250);
        }
      } catch (err) {
        rawPhoneDispatch({
          type: "ANALYSIS_FAILED",
          actor: "system",
          message: (err as ExtendedApiError)?.message || "Scenario analysis failed",
        });
        setError(err as ExtendedApiError);
      } finally {
        setIsLoading(false);
      }
    },
    [executionMode, botGuard, refreshCalls, refreshReports, selectedCustomerId, resolveCustomerName]
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
      rawPhoneDispatch({
        type: "START_ANALYZING",
        actor: "system",
        claimedCustomerId: params.claimed_customer_id,
        claimedIdentity:
          params.caller_label || resolveCustomerName(params.claimed_customer_id),
        isDemo: executionMode === "DEMO",
      });
      try {
        const res = await aegisApi.analyzeCall({
          ...params,
          execution_mode: executionMode,
          previous_score: null,
        });
        setCurrentCall(res.session);
        rawPhoneDispatch({
          type: "ANALYSIS_COMPLETE",
          actor: "system",
          session: res.session,
          isDemo: executionMode === "DEMO",
        });
        await aegisApi.getCallReport(res.call_id).catch(() => null);
        await Promise.all([refreshSystem(), refreshCalls(), refreshReports(), refreshVoiceprints()]);
        return res.session;
      } catch (err) {
        const apiErr = err as ExtendedApiError;
        rawPhoneDispatch({
          type: "ANALYSIS_FAILED",
          actor: "system",
          message: apiErr?.message || "Analysis incomplete",
        });
        setError(apiErr);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [executionMode, botGuard, resolveCustomerName, refreshSystem, refreshCalls, refreshReports, refreshVoiceprints]
  );

  const executeCallAction = useCallback(
    async (action: string, note = "", callIdOverride?: string): Promise<CallSession | null> => {
      yieldDirectorIfPlaying();

      // Immediately update phone state (<100ms sync) even before backend completes
      if (action === "ALLOW") {
        rawPhoneDispatch({ type: "OPERATOR_CONTINUE", actor: "operator", note });
      } else if (action === "CHALLENGE" || action === "STEP_UP_CHALLENGE") {
        setLivenessModalOpen(true);
        rawPhoneDispatch({
          type: "START_CHALLENGE",
          actor: "operator",
          phrase: "cobalt mango seven",
          expiresInSeconds: 20,
        });
      } else if (action === "PAUSE_BOT") {
        botGuard.pauseBot(note || "Operator paused automated greeting.");
        rawPhoneDispatch({ type: "OPERATOR_PAUSE_BOT", actor: "operator", note });
      } else if (action === "TRANSFER_TO_HUMAN") {
        botGuard.transferToHuman();
        rawPhoneDispatch({ type: "OPERATOR_TRANSFER_HUMAN", actor: "operator", note });
      } else if (action === "TERMINATE_CALL" || action === "BLOCK_CALL") {
        rawPhoneDispatch({
          type: "OPERATOR_END_CALL",
          actor: "operator",
          securityEnd: action === "BLOCK_CALL",
          note: note || "Operator ended call",
        });
      }

      const targetCallId = callIdOverride || currentCall?.call_id;
      if (!targetCallId) {
        if (phoneCallStateRef.current === "idle") {
          setOperatorActionStatus("error");
          setOperatorActionReason("No active call — start or analyze a call first.");
          showToast({
            variant: "warning",
            title: "No Active Call",
            message: "Start or analyze a call before running operator actions.",
          });
        } else {
          setOperatorActionStatus("done");
          setOperatorActionReason(null);
        }
        return null;
      }

      setOperatorActionStatus("running");
      setOperatorActionReason(null);
      const controller = new AbortController();
      let timeoutId: number | null = null;
      try {
        await Promise.race([
          aegisApi.postCallAction(targetCallId, action, note, controller.signal),
          new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              controller.abort();
              reject({ code: "timeout", message: "Operator action timed out after 30 s — retry or check backend." });
            }, 30000);
          }),
        ]);
        const refreshed = await aegisApi.getCall(targetCallId);
        if (!callIdOverride || currentCall?.call_id === targetCallId) {
          setCurrentCall(refreshed);
        }
        await aegisApi.getCallReport(targetCallId).catch(() => null);
        await Promise.all([refreshCalls(), refreshReports()]);
        setOperatorActionStatus("done");
        setOperatorActionReason(null);
        showToast({
          variant: action === "TERMINATE_CALL" || action === "BLOCK_CALL" ? "error" : action === "ALLOW" ? "success" : "info",
          title: `Action Executed: ${action}`,
          message: note || `Updated call ${targetCallId} and recorded audit entry.`,
        });
        return refreshed;
      } catch (err) {
        const apiErr = err as ExtendedApiError;
        const timedOut = apiErr?.code === "timeout";
        const reasonText =
          apiErr?.message ||
          (timedOut
            ? "Operator action timed out after 30 s — backend did not respond."
            : "Backend call action failed.");
        setOperatorActionStatus(timedOut ? "timeout" : "error");
        setOperatorActionReason(reasonText);
        setError(apiErr);
        showToast({
          variant: "error",
          title: timedOut ? `Action Timed Out: ${action}` : `Action Failed: ${action}`,
          message: reasonText,
        });
        return null;
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
      }
    },
    [currentCall, botGuard, refreshCalls, refreshReports, showToast, yieldDirectorIfPlaying]
  );

  const startBotAction = useCallback(() => {
    yieldDirectorIfPlaying();
    botGuard.startBot();
    rawPhoneDispatch({ type: "OPERATOR_START_BOT", actor: "bot" });
  }, [yieldDirectorIfPlaying, botGuard]);

  const resumeBotAction = useCallback(() => {
    yieldDirectorIfPlaying();
    botGuard.resumeByOperator();
    rawPhoneDispatch({ type: "OPERATOR_RESUME_BOT", actor: "operator" });
  }, [yieldDirectorIfPlaying, botGuard]);

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
    setOperatorActionStatus("idle");
    setOperatorActionReason(null);
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
      rawPhoneDispatch({
        type: "ANALYSIS_COMPLETE",
        actor: "system",
        session: call,
        isDemo: call.execution_mode === "DEMO",
      });
      void refreshCalls();
      void refreshReports();
    },
    [refreshCalls, refreshReports]
  );

  const pipelinePhoneStages = useMemo(
    () => derivePipelineStagesFromPhone(phoneState),
    [phoneState]
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
        selectedCustomerId,
        setSelectedCustomerId,
        activeScenarioId,
        layerStatuses: deriveLayerStatuses(currentCall, isLoading),
        pipelinePhoneStages,
        phoneState,
        phoneDispatch: rawPhoneDispatch,
        showPhone,
        setShowPhone,
        directorStatus,
        directorScenarioId,
        directorSpeed,
        directorStepIndex,
        playScenario,
        pauseDirector,
        resumeScenario,
        stepDirectorNext,
        resetDirector,
        setDirectorSpeed,
        ringtoneStatus,
        toggleRingtoneMute,
        unlockRingtoneAudio,
        setPhoneAudioLevel,
        acceptIncomingPhoneCall,
        declineIncomingPhoneCall,
        callerHangUpPhoneCall,
        simulateIncomingPhoneCall,
        triggerCallerMissedTimeout,
        operatorActionStatus,
        operatorActionReason,
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
        startBotAction,
        resumeBotAction,
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

export function usePhoneViewModel(role: "caller"): CallerPhoneViewModel;
export function usePhoneViewModel(role: "agent"): AgentPhoneViewModel;
export function usePhoneViewModel(role: "caller" | "agent"): CallerPhoneViewModel | AgentPhoneViewModel {
  const { phoneState } = useAnalysis();
  return useMemo(() => {
    return role === "caller"
      ? selectPhoneViewModel(phoneState, "caller")
      : selectPhoneViewModel(phoneState, "agent");
  }, [phoneState, role]);
}
