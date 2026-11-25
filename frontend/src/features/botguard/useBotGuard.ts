import { useState, useCallback, useEffect, useRef } from "react";
import type { CallSession, GuardState } from "../../types";
import { copy } from "../../copy";

export function useBotGuard(
  currentCall: CallSession | null,
  onGuardEvent: (message: string) => void
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
      onGuardEvent(reason);
    },
    [cancelSpeech, onGuardEvent]
  );

  const transferToHuman = useCallback(() => {
    cancelSpeech();
    setGuardState("TRANSFERRED_TO_HUMAN");
    setGuardReason(copy.botGuard.reasonTransferred);
    onGuardEvent(copy.botGuard.reasonTransferred);
  }, [cancelSpeech, onGuardEvent]);

  const resumeByOperator = useCallback(() => {
    if (stateRef.current !== "PAUSED_BY_GUARD") return;
    setGuardState("IDLE");
    setGuardReason(copy.botGuard.reasonNone);
    onGuardEvent("Operator explicitly resumed Bot Guard");
  }, [onGuardEvent]);

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
      if (stateRef.current === "SPEAKING") setGuardState("IDLE");
    };
    utterance.onerror = () => {
      if (stateRef.current === "SPEAKING") setGuardState("IDLE");
    };

    setGuardState("SPEAKING");
    setGuardReason("Automated bank-support greeting active");
    onGuardEvent("Bot Guard started bank-support greeting");
    window.speechSynthesis.speak(utterance);
  }, [speechSupported, cancelSpeech, onGuardEvent]);

  useEffect(() => {
    if (!guardEnabled || !currentCall) return;
    if (guardState === "PAUSED_BY_GUARD" || guardState === "TRANSFERRED_TO_HUMAN") return;

    const score = currentCall.trust_score;
    const livFailed = !currentCall.liveness.passed && currentCall.liveness.status !== "UNAVAILABLE";
    const isBlock = currentCall.decision === "BLOCK" || currentCall.verdict === "THREAT";

    if (livFailed && currentCall.liveness.replay_detected) {
      pauseBot(copy.botGuard.reasonLivenessFailed);
    } else if (isBlock) {
      pauseBot(copy.botGuard.reasonEndCall);
    } else if (score !== null && score !== undefined && score < threshold) {
      pauseBot(`${copy.botGuard.reasonBelowThreshold} (${score.toFixed(1)} < ${threshold})`);
    }
  }, [guardEnabled, threshold, currentCall, guardState, pauseBot]);

  useEffect(() => () => cancelSpeech(), [cancelSpeech]);

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
