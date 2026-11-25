import { useState, useCallback, useEffect, useRef } from "react";
import type { AnalyzeResponse, CallEventType, GuardState } from "../../types";
import { copy } from "../../copy";

export function useBotGuard(
  currentAnalysis: AnalyzeResponse | null,
  onLogEvent: (type: CallEventType, message: string) => void
) {
  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  const [guardState, setGuardState] = useState<GuardState>("IDLE");
  const [guardEnabled, setGuardEnabled] = useState<boolean>(true);
  const [threshold, setThreshold] = useState<number>(40);
  const [guardReason, setGuardReason] = useState<string>(copy.botGuard.reasonNone);

  const stateRef = useRef<GuardState>(guardState);
  stateRef.current = guardState;

  const cancelSpeech = useCallback(() => {
    if (speechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech errors
      }
    }
  }, [speechSupported]);

  const pauseBot = useCallback(
    (reason: string) => {
      cancelSpeech();
      setGuardState("PAUSED_BY_GUARD");
      setGuardReason(reason);
      onLogEvent("guard", reason);
    },
    [cancelSpeech, onLogEvent]
  );

  const transferToHuman = useCallback(() => {
    cancelSpeech();
    setGuardState("TRANSFERRED_TO_HUMAN");
    setGuardReason(copy.botGuard.reasonTransferred);
    onLogEvent("guard", copy.botGuard.reasonTransferred);
  }, [cancelSpeech, onLogEvent]);

  const resumeByOperator = useCallback(() => {
    // Works ONLY from PAUSED_BY_GUARD and ONLY by explicit click
    if (stateRef.current !== "PAUSED_BY_GUARD") return;
    setGuardState("IDLE");
    setGuardReason(copy.botGuard.reasonNone);
    onLogEvent("guard", "Operator explicitly resumed Bot Guard");
  }, [onLogEvent]);

  const resetGuard = useCallback(() => {
    cancelSpeech();
    setGuardState("IDLE");
    setGuardReason(copy.botGuard.reasonNone);
  }, [cancelSpeech]);

  const startBot = useCallback(() => {
    if (!speechSupported) return;
    if (stateRef.current === "PAUSED_BY_GUARD" || stateRef.current === "TRANSFERRED_TO_HUMAN") {
      return;
    }

    cancelSpeech();
    const utterance = new SpeechSynthesisUtterance(copy.botGuard.greeting);
    utterance.rate = 1.0;
    utterance.onend = () => {
      if (stateRef.current === "SPEAKING") {
        setGuardState("IDLE");
      }
    };
    utterance.onerror = () => {
      if (stateRef.current === "SPEAKING") {
        setGuardState("IDLE");
      }
    };

    setGuardState("SPEAKING");
    setGuardReason("Automated bank-support greeting active");
    onLogEvent("guard", "Bot Guard started bank-support greeting");
    window.speechSynthesis.speak(utterance);
  }, [speechSupported, cancelSpeech, onLogEvent]);

  // Automatic pause check whenever analysis, guardEnabled, or threshold changes
  useEffect(() => {
    if (!guardEnabled || !currentAnalysis) return;
    if (guardState === "PAUSED_BY_GUARD" || guardState === "TRANSFERRED_TO_HUMAN") return;

    if (currentAnalysis.liveness.status === "failed") {
      pauseBot(copy.botGuard.reasonLivenessFailed);
    } else if (currentAnalysis.decision === "END_CALL") {
      pauseBot(copy.botGuard.reasonEndCall);
    } else if (currentAnalysis.trust_score.value < threshold) {
      pauseBot(
        `${copy.botGuard.reasonBelowThreshold} (${currentAnalysis.trust_score.value} < ${threshold})`
      );
    }
  }, [guardEnabled, threshold, currentAnalysis, guardState, pauseBot]);

  useEffect(() => {
    return () => cancelSpeech();
  }, [cancelSpeech]);

  return {
    guardState,
    guardEnabled,
    threshold,
    guardReason,
    speechSupported,
    setGuardEnabled,
    setThreshold,
    startBot,
    pauseBot,
    transferToHuman,
    resumeByOperator,
    resetGuard,
  };
}
