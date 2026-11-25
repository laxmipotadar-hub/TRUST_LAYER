import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  AnalyzeResponse,
  CallEvent,
  CallEventType,
  GuardState,
  ReportRecord,
  Voiceprint,
} from "../types";
import { aegisApi, type ExtendedApiError } from "../lib/api";
import { S1, failLiveness, scenarioMeta } from "../mocks/fixtures";
import { copy, getError } from "../copy";
import { useBotGuard } from "../features/botguard/useBotGuard";

const STORAGE_KEY = "aegis_report_history_v1";

function loadReportsFromStorage(): ReportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReportsToStorage(reports: ReportRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Memory fallback only
  }
}

export interface CallerMetaState {
  callerLabel: string;
  claimedUserId: string;
  enrolled: boolean;
}

export interface HealthBannerState {
  backendUnavailable: boolean;
  keyNotSet: boolean;
}

interface AnalysisContextType {
  currentAnalysis: AnalyzeResponse | null;
  events: CallEvent[];
  guardState: GuardState;
  guardEnabled: boolean;
  guardThreshold: number;
  guardReason: string;
  speechSupported: boolean;
  healthBanner: HealthBannerState;
  reports: ReportRecord[];
  voiceprints: Voiceprint[];
  callerMeta: CallerMetaState;
  activeScenarioId: string | null;
  isLoading: boolean;
  error: ExtendedApiError | null;
  isLivenessModalOpen: boolean;
  isTechnicalDrawerOpen: boolean;
  selectedStep: 1 | 2 | 3;
  setLivenessModalOpen: (open: boolean) => void;
  setTechnicalDrawerOpen: (open: boolean) => void;
  setSelectedStep: (step: 1 | 2 | 3) => void;
  setGuardEnabled: (enabled: boolean) => void;
  setGuardThreshold: (val: number) => void;
  startBotAction: () => void;
  resumeBotAction: () => void;
  analyzeScenario: (scenarioId: "S1" | "S2" | "S3" | "S4") => Promise<void>;
  analyzeCustomAudio: (audio: Blob, claimedUserId: string) => Promise<void>;
  handleLivenessOutcome: (status: "passed" | "failed" | "incomplete", detail?: string) => void;
  logEvent: (type: CallEventType, message: string) => void;
  allowCall: () => void;
  runChallengeAction: () => void;
  pauseBotAction: () => void;
  transferToHumanAction: () => void;
  endCallAction: () => void;
  refreshVoiceprints: () => Promise<void>;
  resetAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

function buildInitialEvents(res: AnalyzeResponse): CallEvent[] {
  const now = new Date();
  return [
    {
      id: `evt_${Date.now()}_1`,
      ts: new Date(now.getTime() - 200).toISOString(),
      type: "analysis",
      message: `Aletheia completed (${res.aletheia.verdict}, synthetic likelihood ${res.aletheia.score.toFixed(2)})`,
    },
    {
      id: `evt_${Date.now()}_2`,
      ts: new Date(now.getTime() - 100).toISOString(),
      type: res.eidos.status === "skipped" ? "alert" : "analysis",
      message:
        res.eidos.status === "skipped"
          ? `Eidos skipped (${res.eidos.skip_reason || "aletheia_fake"})`
          : `Eidos completed (${res.eidos.decision || "unavailable"})`,
    },
    {
      id: `evt_${Date.now()}_3`,
      ts: now.toISOString(),
      type: res.decision === "CONTINUE" ? "analysis" : "alert",
      message: `Decision set to ${res.decision} (mode: ${res.mode})`,
    },
  ];
}

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>("S1");
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyzeResponse | null>(S1);
  const [callerMeta, setCallerMeta] = useState<CallerMetaState>({
    callerLabel: scenarioMeta.S1.callerLabel,
    claimedUserId: scenarioMeta.S1.claimedUserId,
    enrolled: scenarioMeta.S1.enrolled,
  });
  const [events, setEvents] = useState<CallEvent[]>(() => buildInitialEvents(S1));
  const [reports, setReports] = useState<ReportRecord[]>(() => loadReportsFromStorage());
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [healthBanner, setHealthBanner] = useState<HealthBannerState>({
    backendUnavailable: false,
    keyNotSet: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ExtendedApiError | null>(null);
  const [isLivenessModalOpen, setIsLivenessModalOpen] = useState<boolean>(false);
  const [isTechnicalDrawerOpen, setIsTechnicalDrawerOpen] = useState<boolean>(false);
  const [selectedStep, setSelectedStep] = useState<1 | 2 | 3>(3);

  const appendEvent = useCallback((type: CallEventType, message: string) => {
    const newEvt: CallEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      type,
      message,
    };
    setEvents((prev) => [...prev, newEvt]);
  }, []);

  const botGuard = useBotGuard(currentAnalysis, appendEvent);

  const refreshVoiceprints = useCallback(async () => {
    try {
      const list = await aegisApi.getVoiceprints();
      setVoiceprints(list);
    } catch {
      // Non-blocking fallback
    }
  }, []);

  useEffect(() => {
    const isLiveConfigured = (import.meta.env.VITE_API_MODE || "mock").toLowerCase() === "live";
    aegisApi.getHealth().then((h) => {
      setHealthBanner({
        backendUnavailable: isLiveConfigured && !h.backend_active,
        keyNotSet: Boolean(h.key_not_set),
      });
      refreshVoiceprints();
    });
  }, [refreshVoiceprints]);

  // Global keyboard shortcut: 'P' enters Stage Mode + Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "p" || e.key === "P") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        if (window.location.pathname === "/stage") {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          window.history.back();
        } else {
          document.documentElement.requestFullscreen?.().catch(() => {});
          window.location.assign("/stage");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const persistReport = useCallback(
    (
      res: AnalyzeResponse,
      label: string,
      evts: CallEvent[],
      challengeStatus?: "passed" | "failed" | "incomplete"
    ) => {
      const record: ReportRecord = {
        call_id: res.call_id,
        saved_at: new Date().toISOString(),
        caller_label: label,
        analysis: res,
        events: evts,
        challenge: challengeStatus ? { status: challengeStatus } : undefined,
      };
      setReports((prev) => {
        const next = [record, ...prev.filter((r) => r.call_id !== res.call_id)].slice(0, 50);
        saveReportsToStorage(next);
        return next;
      });
    },
    []
  );

  const analyzeScenario = async (scenarioId: "S1" | "S2" | "S3" | "S4") => {
    if (isLoading) return;

    const meta = scenarioMeta[scenarioId];
    setActiveScenarioId(scenarioId);
    setCurrentAnalysis(null);
    setEvents([]);
    setError(null);
    botGuard.resetGuard();
    setCallerMeta({
      callerLabel: meta.callerLabel,
      claimedUserId: meta.claimedUserId,
      enrolled: meta.enrolled,
    });
    setIsLoading(true);
    setSelectedStep(2);

    try {
      const res = await aegisApi.analyzeCall({ scenario_id: scenarioId });
      const initialEvts = buildInitialEvents(res);
      setCurrentAnalysis(res);
      setEvents(initialEvts);
      setSelectedStep(3);
      persistReport(res, meta.callerLabel, initialEvts);
    } catch (err: unknown) {
      const normalized = err as ExtendedApiError;
      const code = normalized?.code || "network_error";
      setError({
        code,
        message: getError(code, normalized?.message),
        rawPayload: normalized?.rawPayload,
      });
      setSelectedStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeCustomAudio = async (audio: Blob, claimedUserId: string) => {
    if (isLoading) return;

    const vp = voiceprints.find(
      (v) => v.claimed_user_id.toLowerCase() === claimedUserId.toLowerCase()
    );
    const label = vp ? `${vp.user_name} (Audio)` : claimedUserId || copy.clipSelector.unenrolledOption;

    setActiveScenarioId(null);
    setCurrentAnalysis(null);
    setEvents([]);
    setError(null);
    botGuard.resetGuard();
    setCallerMeta({
      callerLabel: label,
      claimedUserId: claimedUserId || copy.states.unavailable,
      enrolled: Boolean(vp),
    });
    setIsLoading(true);
    setSelectedStep(2);

    try {
      const res = await aegisApi.analyzeCall({ audio, claimed_user_id: claimedUserId });
      const initialEvts = buildInitialEvents(res);
      setCurrentAnalysis(res);
      setEvents(initialEvts);
      setSelectedStep(3);
      persistReport(res, label, initialEvts);
    } catch (err: unknown) {
      const normalized = err as ExtendedApiError;
      const code = normalized?.code || "network_error";
      setError({
        code,
        message: getError(code, normalized?.message),
        rawPayload: normalized?.rawPayload,
      });
      setSelectedStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLivenessOutcome = (
    status: "passed" | "failed" | "incomplete",
    detail?: string
  ) => {
    if (!currentAnalysis) return;

    if (status === "failed") {
      const failed = failLiveness(currentAnalysis);
      setCurrentAnalysis(failed);
      appendEvent("challenge", copy.liveness.overrideLine);
      botGuard.pauseBot(copy.botGuard.reasonLivenessFailed);
      persistReport(failed, callerMeta.callerLabel, events, "failed");
      setIsLivenessModalOpen(false);
    } else if (status === "passed") {
      const updated: AnalyzeResponse = {
        ...currentAnalysis,
        liveness: { status: "passed" },
        decision: "CONTINUE",
        action_label: copy.decisions.continue.actionLabel,
      };
      setCurrentAnalysis(updated);
      appendEvent(
        "challenge",
        `${copy.liveness.passed}. ${copy.decisions.continue.mandatoryNotice}`
      );
      persistReport(updated, callerMeta.callerLabel, events, "passed");
      setIsLivenessModalOpen(false);
    } else {
      // Incomplete never passes
      appendEvent(
        "challenge",
        `${copy.liveness.incomplete}: ${detail || copy.liveness.incompleteDetail}`
      );
      persistReport(currentAnalysis, callerMeta.callerLabel, events, "incomplete");
    }
  };

  const allowCall = () => {
    if (!currentAnalysis || currentAnalysis.decision !== "CONTINUE") return;
    appendEvent("action", `Operator allowed call (${copy.decisions.continue.mandatoryNotice})`);
  };

  const runChallengeAction = () => {
    appendEvent("challenge", "Operator initiated dynamic liveness challenge");
    setIsLivenessModalOpen(true);
  };

  const pauseBotAction = () => {
    botGuard.pauseBot(copy.botGuard.reasonOperatorPause);
  };

  const transferToHumanAction = () => {
    botGuard.transferToHuman();
  };

  const endCallAction = () => {
    if (currentAnalysis) {
      setCurrentAnalysis({
        ...currentAnalysis,
        decision: "END_CALL",
        action_label: copy.decisions.endCall.actionLabel,
      });
    }
    botGuard.pauseBot(copy.botGuard.reasonEndCall);
    appendEvent("action", "Operator terminated call immediately");
  };

  const resetAnalysis = () => {
    setCurrentAnalysis(null);
    setActiveScenarioId(null);
    setEvents([]);
    setError(null);
    botGuard.resetGuard();
    setSelectedStep(1);
  };

  return (
    <AnalysisContext.Provider
      value={{
        currentAnalysis,
        events,
        guardState: botGuard.guardState,
        guardEnabled: botGuard.guardEnabled,
        guardThreshold: botGuard.threshold,
        guardReason: botGuard.guardReason,
        speechSupported: botGuard.speechSupported,
        healthBanner,
        reports,
        voiceprints,
        callerMeta,
        activeScenarioId,
        isLoading,
        error,
        isLivenessModalOpen,
        isTechnicalDrawerOpen,
        selectedStep,
        setLivenessModalOpen: setIsLivenessModalOpen,
        setTechnicalDrawerOpen: setIsTechnicalDrawerOpen,
        setSelectedStep,
        setGuardEnabled: botGuard.setGuardEnabled,
        setGuardThreshold: botGuard.setThreshold,
        startBotAction: botGuard.startBot,
        resumeBotAction: botGuard.resumeByOperator,
        analyzeScenario,
        analyzeCustomAudio,
        handleLivenessOutcome,
        logEvent: appendEvent,
        allowCall,
        runChallengeAction,
        pauseBotAction,
        transferToHumanAction,
        endCallAction,
        refreshVoiceprints,
        resetAnalysis,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = (): AnalysisContextType => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return context;
};
