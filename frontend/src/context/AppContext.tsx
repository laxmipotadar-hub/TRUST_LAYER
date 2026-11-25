import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { aegisApi } from '../services/api';
import type {
  AppMode,
  BotStatus,
  CallActionType,
  CallSession,
  CallStateStage,
  ChallengeCaptureMode,
  ChallengeSession,
  ChallengeVerifyResponse,
  HealthResponse,
  ScenarioDefinition,
  SettingsResponse,
} from '../types/aegis';
import { callAudioController } from '../utils/audioEngine';

export const BOT_SAMPLE_GREETING =
  'Welcome to customer support. How may I help you today? I am checking your account verification status now; please hold on the line.';

export interface AppContextValue {
  health: HealthResponse | null;
  settings: SettingsResponse | null;
  scenarios: ScenarioDefinition[];
  currentCall: CallSession | null;
  callsHistory: CallSession[];
  callStateStage: CallStateStage;
  activeChallenge: ChallengeSession | null;
  challengeResult: ChallengeVerifyResponse | null;
  challengeModalOpen: boolean;
  botStatus: BotStatus;
  botGuardReason: string | null;
  botPausedLocked: boolean;
  liveCallModalOpen: boolean;
  loading: boolean;
  runningScenarioId: string | null;
  error: string | null;
  clearError: () => void;
  refreshAll: () => Promise<void>;
  setAppMode: (mode: AppMode) => Promise<void>;
  updateBotGuard: (payload: { bot_guard_enabled?: boolean; bot_guard_threshold?: number }) => Promise<void>;
  runScenario: (scenarioId: string) => Promise<void>;
  selectCall: (call: CallSession) => void;
  applyAnalyzedCall: (call: CallSession) => Promise<void>;
  openLiveCallModal: () => void;
  closeLiveCallModal: () => void;
  setCallStateStage: (stage: CallStateStage) => void;
  executeCallAction: (callId: string, action: CallActionType, note?: string) => Promise<void>;
  openChallengeForCurrentCall: () => Promise<void>;
  closeChallengeModal: () => void;
  verifyActiveChallenge: (params: {
    spokenResponse: string;
    latencyMs: number;
    captureMode: ChallengeCaptureMode;
    audioBlob?: Blob;
  }) => Promise<void>;
  playBotGreeting: () => void;
  pauseBotByOperator: () => void;
  resumeBotByOperator: () => void;
  demoBotThreatInterrupt: (scenarioId: 'S2' | 'S3') => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [callsHistory, setCallsHistory] = useState<CallSession[]>([]);
  const [callStateStage, setCallStateStage] = useState<CallStateStage>('VERDICT');
  const [activeChallenge, setActiveChallenge] = useState<ChallengeSession | null>(null);
  const [challengeResult, setChallengeResult] = useState<ChallengeVerifyResponse | null>(null);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);

  const [botStatus, setBotStatus] = useState<BotStatus>('IDLE');
  const [botGuardReason, setBotGuardReason] = useState<string | null>(null);
  const [botPausedLocked, setBotPausedLocked] = useState(false);
  const [liveCallModalOpen, setLiveCallModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const botFallbackTimerRef = useRef<number | null>(null);

  const clearBotFallbackTimer = useCallback(() => {
    if (botFallbackTimerRef.current !== null) {
      window.clearTimeout(botFallbackTimerRef.current);
      botFallbackTimerRef.current = null;
    }
  }, []);

  const evaluateGuardTrigger = useCallback(
    (call: CallSession | null, cfg: SettingsResponse | null): string | null => {
      if (!call || !(cfg?.bot_guard_enabled ?? true)) return null;
      const threshold = cfg?.bot_guard_threshold ?? 40;
      const score = call.trust_breakdown.composite_score;
      const livenessFailed =
        call.trust_breakdown.liveness_status === 'FAILED' || !call.liveness.passed;

      if (livenessFailed) {
        return 'Challenge Liveness FAILED — potential replay attack detected.';
      }
      if (score !== null && score < threshold) {
        return `Trust Score ${score.toFixed(2)} dropped below configured threshold (${threshold}).`;
      }
      return null;
    },
    [],
  );

  // Enforce automatic sub-second Bot Guard interruption whenever call state crosses threshold or liveness fails
  useEffect(() => {
    const reason = evaluateGuardTrigger(currentCall, settings);
    if (!reason) return;

    if (botStatus === 'SPEAKING') {
      clearBotFallbackTimer();
      callAudioController.interruptBotImmediately();
      setBotStatus('PAUSED BY GUARD');
      setBotPausedLocked(true);
      setBotGuardReason(reason);
    } else if (botStatus === 'IDLE' && !botPausedLocked) {
      setBotStatus('PAUSED BY GUARD');
      setBotPausedLocked(true);
      setBotGuardReason(reason);
    }
  }, [currentCall, settings, botStatus, botPausedLocked, evaluateGuardTrigger, clearBotFallbackTimer]);

  useEffect(() => {
    return () => {
      clearBotFallbackTimer();
      callAudioController.interruptBotImmediately();
    };
  }, [clearBotFallbackTimer]);

  const refreshAll = useCallback(async () => {
    try {
      setError(null);
      const [h, s, scList, calls] = await Promise.all([
        aegisApi.getHealth(),
        aegisApi.getSettings(),
        aegisApi.getScenarios(),
        aegisApi.listCalls(20),
      ]);
      setHealth(h);
      setSettings(s);
      setScenarios(scList);
      setCallsHistory(calls);

      if (calls.length > 0) {
        setCurrentCall(calls[0]);
        setCallStateStage(calls[0].call_state ?? 'VERDICT');
      } else if (scList.length > 0) {
        const first = await aegisApi.runScenario(scList[0].id);
        setCurrentCall(first);
        setCallsHistory([first]);
        setCallStateStage(first.call_state ?? 'VERDICT');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to AEGIS backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const setAppMode = useCallback(async (mode: AppMode) => {
    try {
      setError(null);
      const updatedSettings = await aegisApi.updateSettings({ app_mode: mode });
      setSettings(updatedSettings);
      const h = await aegisApi.getHealth();
      setHealth(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch mode.');
    }
  }, []);

  const updateBotGuard = useCallback(
    async (payload: { bot_guard_enabled?: boolean; bot_guard_threshold?: number }) => {
      try {
        setError(null);
        const updated = await aegisApi.updateSettings(payload);
        setSettings(updated);
        if (payload.bot_guard_enabled === false && botStatus === 'PAUSED BY GUARD') {
          setBotGuardReason('Bot Guard disabled by operator; explicit Resume required before speaking.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update Bot Guard configuration.');
      }
    },
    [botStatus],
  );

  const openChallengeForCall = useCallback(async (call: CallSession) => {
    setCallStateStage('CHALLENGE');
    const ch = await aegisApi.startChallenge({
      call_id: call.call_id,
      customer_id: call.claimed_customer_id,
      window_seconds: 12,
    });
    setActiveChallenge(ch);
    setChallengeResult(null);
    setChallengeModalOpen(true);
  }, []);

  const openChallengeForCurrentCall = useCallback(async () => {
    if (!currentCall) return;
    try {
      setError(null);
      await openChallengeForCall(currentCall);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch live identity challenge.');
    }
  }, [currentCall, openChallengeForCall]);

  const runScenario = useCallback(
      async (scenarioId: string, preserveSpeaking = false) => {
        try {
          setRunningScenarioId(scenarioId);
          setError(null);
          // Reset scenario-transient state cleanly before evaluating the newly selected scenario
          setActiveChallenge(null);
          setChallengeResult(null);
          setChallengeModalOpen(false);
          setCallStateStage('IDENTITY_CHECK');
            if (!preserveSpeaking) {
              clearBotFallbackTimer();
              callAudioController.interruptBotImmediately();
              setBotStatus('IDLE');
              setBotPausedLocked(false);
              setBotGuardReason(null);
            }

            const call = await aegisApi.runScenario(scenarioId);
            setCurrentCall(call);

            const guardReason = evaluateGuardTrigger(call, settings);
            if (guardReason) {
              clearBotFallbackTimer();
              callAudioController.interruptBotImmediately();
              setBotStatus('PAUSED BY GUARD');
              setBotPausedLocked(true);
              setBotGuardReason(guardReason);
            }

            const [h, calls] = await Promise.all([aegisApi.getHealth(), aegisApi.listCalls(20)]);
            setHealth(h);
            setCallsHistory(calls);

            if (scenarioId === 'S3') {
              await openChallengeForCall(call);
            } else {
              setCallStateStage('VERDICT');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run scenario.');
          } finally {
            setRunningScenarioId(null);
          }
        },
        [clearBotFallbackTimer, evaluateGuardTrigger, openChallengeForCall, settings],
  );

  const executeCallAction = useCallback(
    async (callId: string, action: CallActionType, note = '') => {
      try {
        setError(null);

        if (action === 'TRANSFER_TO_HUMAN') {
          clearBotFallbackTimer();
          callAudioController.interruptBotImmediately();
          setBotStatus('TRANSFERRED TO HUMAN');
          setBotPausedLocked(true);
          setBotGuardReason('Call transferred to human banking specialist.');
        } else if (action === 'PAUSE_BOT' || action === 'BLOCK_CALL') {
          clearBotFallbackTimer();
          callAudioController.interruptBotImmediately();
          setBotStatus('PAUSED BY GUARD');
          setBotPausedLocked(true);
          setBotGuardReason(
            action === 'BLOCK_CALL'
              ? 'Call blocked by SOC operator.'
              : 'Automated bot paused by SOC operator.',
          );
        } else if (action === 'ALLOW') {
          setBotPausedLocked(false);
          setBotStatus('IDLE');
          setBotGuardReason(null);
        }

        await aegisApi.recordCallAction(callId, {
          action,
          operator_note: note || `Operator executed ${action}`,
        });

        if (action === 'CHALLENGE' && currentCall) {
          await openChallengeForCall(currentCall);
        } else {
          setCallStateStage('VERDICT');
        }

        const [updated, calls] = await Promise.all([
          aegisApi.getCall(callId),
          aegisApi.listCalls(20),
        ]);
        setCurrentCall(updated);
        setCallsHistory(calls);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to execute call action.');
      }
    },
    [clearBotFallbackTimer, currentCall, openChallengeForCall],
  );

  const verifyActiveChallenge = useCallback(
    async (params: {
      spokenResponse: string;
      latencyMs: number;
      captureMode: ChallengeCaptureMode;
      audioBlob?: Blob;
    }) => {
      if (!activeChallenge) return;
      try {
        setError(null);
        const result = params.audioBlob
          ? await aegisApi.verifyChallengeAudio({
            challenge_id: activeChallenge.challenge_id,
            spoken_response: params.spokenResponse,
            response_latency_ms: params.latencyMs,
            capture_mode: params.captureMode,
            file: params.audioBlob,
          })
          : await aegisApi.verifyChallenge({
            challenge_id: activeChallenge.challenge_id,
            spoken_response: params.spokenResponse,
            response_latency_ms: params.latencyMs,
            capture_mode: params.captureMode,
            audio_captured: false,
          });

        setChallengeResult(result);
        setCallStateStage('VERDICT');
        if (result.updated_call) {
          setCurrentCall(result.updated_call);
          const calls = await aegisApi.listCalls(20);
          setCallsHistory(calls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Challenge verification failed.');
      }
    },
    [activeChallenge],
  );

  const playBotGreeting = useCallback(() => {
    // Require explicit Resume action if bot is paused or transferred
    if (botPausedLocked) return;

    const guardReason = evaluateGuardTrigger(currentCall, settings);
    if (guardReason) {
      callAudioController.interruptBotImmediately();
      setBotStatus('PAUSED BY GUARD');
      setBotPausedLocked(true);
      setBotGuardReason(guardReason);
      return;
    }

    clearBotFallbackTimer();
    const speechStarted = callAudioController.speakBotPrompt(
      BOT_SAMPLE_GREETING,
      () => setBotStatus('SPEAKING'),
      () => setBotStatus((prev) => (prev === 'SPEAKING' ? 'IDLE' : prev)),
    );
    if (!speechStarted) {
      botFallbackTimerRef.current = window.setTimeout(() => {
        setBotStatus((prev) => (prev === 'SPEAKING' ? 'IDLE' : prev));
      }, 6000);
    }
  }, [botPausedLocked, clearBotFallbackTimer, currentCall, evaluateGuardTrigger, settings]);

  const pauseBotByOperator = useCallback(() => {
    clearBotFallbackTimer();
    callAudioController.interruptBotImmediately();
    setBotStatus('PAUSED BY GUARD');
    setBotPausedLocked(true);
    setBotGuardReason('Automated response paused by operator.');
    if (currentCall) {
      void aegisApi.recordCallAction(currentCall.call_id, {
        action: 'PAUSE_BOT',
        operator_note: 'Bot paused via Bot Guard panel',
      });
    }
  }, [clearBotFallbackTimer, currentCall]);

  const resumeBotByOperator = useCallback(() => {
    clearBotFallbackTimer();
    setBotPausedLocked(false);
    setBotStatus('IDLE');
    setBotGuardReason(null);
  }, [clearBotFallbackTimer]);

  const demoBotThreatInterrupt = useCallback(
    async (scenarioId: 'S2' | 'S3') => {
      clearBotFallbackTimer();
      setBotPausedLocked(false);
      setBotGuardReason(null);

      // Start audible bot speech first, then trigger S2/S3 threat so speechSynthesis.cancel() interrupts live!
      const speechStarted = callAudioController.speakBotPrompt(
        BOT_SAMPLE_GREETING,
        () => setBotStatus('SPEAKING'),
        () => setBotStatus((prev) => (prev === 'SPEAKING' ? 'IDLE' : prev)),
      );
      if (!speechStarted) {
        botFallbackTimerRef.current = window.setTimeout(() => {
          setBotStatus((prev) => (prev === 'SPEAKING' ? 'IDLE' : prev));
        }, 6000);
      }

      window.setTimeout(() => {
        void runScenario(scenarioId, true);
      }, 1500);
    },
    [clearBotFallbackTimer, runScenario],
  );

  return (
    <AppContext.Provider
      value={{
        health,
        settings,
        scenarios,
        currentCall,
        callsHistory,
        callStateStage,
        activeChallenge,
        challengeResult,
        challengeModalOpen,
        botStatus,
        botGuardReason,
        botPausedLocked,
        liveCallModalOpen,
        loading,
        runningScenarioId,
        error,
        clearError: () => setError(null),
        refreshAll,
        setAppMode,
        updateBotGuard,
        runScenario,
        selectCall: (call) => {
          clearBotFallbackTimer();
          callAudioController.interruptBotImmediately();
          setCurrentCall(call);
          setCallStateStage(call.call_state ?? 'VERDICT');
          setActiveChallenge(null);
          setChallengeResult(null);
          setChallengeModalOpen(false);
          setBotPausedLocked(false);
          setBotStatus('IDLE');
          setBotGuardReason(null);
        },
        applyAnalyzedCall: async (call) => {
          setCurrentCall(call);
          setCallStateStage('VERDICT');
          setActiveChallenge(null);
          setChallengeResult(null);
          const guardReason = evaluateGuardTrigger(call, settings);
          if (guardReason) {
            clearBotFallbackTimer();
            callAudioController.interruptBotImmediately();
            setBotStatus('PAUSED BY GUARD');
            setBotPausedLocked(true);
            setBotGuardReason(guardReason);
          } else {
            setBotPausedLocked(false);
            setBotStatus('IDLE');
            setBotGuardReason(null);
          }
          const [h, calls] = await Promise.all([aegisApi.getHealth(), aegisApi.listCalls(20)]);
          setHealth(h);
          setCallsHistory(calls);
        },
        openLiveCallModal: () => setLiveCallModalOpen(true),
        closeLiveCallModal: () => setLiveCallModalOpen(false),
        setCallStateStage,
        executeCallAction,
        openChallengeForCurrentCall,
        closeChallengeModal: () => setChallengeModalOpen(false),
        verifyActiveChallenge,
        playBotGreeting,
        pauseBotByOperator,
        resumeBotByOperator,
        demoBotThreatInterrupt,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
