import React, { useState, useEffect, useRef } from "react";
import { Mic, StopCircle, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Banner";
import { copy } from "../../copy";
import { aegisApi } from "../../lib/api";
import { useRecorder } from "../../lib/audio";
import type { CallSession, ChallengeSession, ChallengeVerifyResponse, ExecutionMode } from "../../types";

interface SpeechRecognitionAlt {
  transcript: string;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { 0: SpeechRecognitionAlt };
}
interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechCtor = new () => BrowserSpeechRecognition;

export interface ChallengeModalProps {
  isOpen: boolean;
  callId?: string;
  customerId?: string;
  executionMode: ExecutionMode;
  onClose: () => void;
  onComplete: (resp: ChallengeVerifyResponse, updatedCall?: CallSession | null) => void;
}

const MIN_CHALLENGE_SEC = 4.5;

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  callId,
  customerId = "CUST-4821-MARCUS",
  executionMode,
  onClose,
  onComplete,
}) => {
  const [challengeData, setChallengeData] = useState<ChallengeSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [spokenTranscript, setSpokenTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyOutcome, setVerifyOutcome] = useState<ChallengeVerifyResponse | null>(null);

  const recorder = useRecorder();
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isOpen) {
      recorder.cancelRecording();
      speechRef.current?.stop();
      setErrorMsg(null);
      setVerifyOutcome(null);
      setSpokenTranscript("");
      return;
    }

    setErrorMsg(null);
    setVerifyOutcome(null);
    setSpokenTranscript("");

    aegisApi
      .startChallenge(callId, customerId)
      .then((res) => {
        setChallengeData(res);
        setTimeLeft(res.window_seconds || 20);
        startedAtRef.current = Date.now();
      })
      .catch((err) => {
        setErrorMsg(err?.message || "Failed to start backend liveness challenge.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, callId, customerId]);

  useEffect(() => {
    if (!isOpen || verifyOutcome || isVerifying || timeLeft <= 0) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, verifyOutcome, isVerifying, timeLeft]);

  const handleStartMic = async () => {
    setErrorMsg(null);
    const win = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (Ctor) {
      try {
        const rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.onresult = (evt) => {
          const words: string[] = [];
          for (let i = 0; i < evt.results.length; i += 1) {
            const t = evt.results[i]?.[0]?.transcript;
            if (t) words.push(t);
          }
          setSpokenTranscript(words.join(" ").trim());
        };
        rec.start();
        speechRef.current = rec;
      } catch {
        // fallback to audio upload alone
      }
    }
    await recorder.startRecording();
  };

  const submitChallenge = async (captureMode: string, customSpeech?: string, file?: Blob) => {
    if (!challengeData || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg(null);
    const latencyMs = Math.max(200, Date.now() - startedAtRef.current);

    try {
      const resp = await aegisApi.verifyChallengeAudio({
        challenge_id: challengeData.challenge_id,
        spoken_response: customSpeech !== undefined ? customSpeech : spokenTranscript,
        response_latency_ms: latencyMs,
        capture_mode: captureMode,
        file,
      });
      setVerifyOutcome(resp);
      onComplete(resp, resp.updated_call);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Challenge verification failed.";
      setErrorMsg(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStopAndVerify = async () => {
    speechRef.current?.stop();
    const res = await recorder.stopRecording();
    if (!res) {
      setErrorMsg("No audio was recorded.");
      return;
    }
    await submitChallenge("LIVE_SPEECH_AUDIO", spokenTranscript || challengeData?.phrase || "", res.blob);
  };

  const handleRetryChallenge = () => {
    setErrorMsg(null);
    setVerifyOutcome(null);
    setSpokenTranscript("");
    aegisApi
      .startChallenge(callId, customerId)
      .then((res) => {
        setChallengeData(res);
        setTimeLeft(res.window_seconds || 20);
        startedAtRef.current = Date.now();
      })
      .catch((err) => {
        setErrorMsg(err?.message || "Failed to restart backend liveness challenge.");
      });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.liveness.title}
      subtitle="Fresh backend nonce + live 16 kHz microphone audio verification"
    >
      <div className="space-y-4">
        {errorMsg && (
          <Banner variant="warn" title="Challenge Technical Error (Retryable — No END_CALL)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{errorMsg}</span>
              <Button type="button" size="sm" variant="secondary" onClick={handleRetryChallenge}>
                Retry Challenge
              </Button>
            </div>
          </Banner>
        )}

        <div className="p-5 rounded-xl bg-[var(--fill-subtle)] border border-[var(--border)] text-center space-y-2">
          <p className="text-[14px] font-medium text-[var(--text-secondary)]">
            {copy.liveness.promptInstruction}
          </p>
          <p className="text-[28px] font-extrabold text-[var(--brand-navy)] tracking-tight">
            {challengeData?.phrase || "Loading phrase..."}
          </p>
          <p className="text-[13px] text-[var(--text-muted)]">
            Speak naturally for 5–10 seconds (minimum {MIN_CHALLENGE_SEC.toFixed(1)}s required for Aletheia deepfake check).
          </p>
        </div>

        <div className="flex items-center justify-between text-[14px] px-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
            <Clock className="w-4 h-4 text-[var(--brand-steel)]" />
            {timeLeft}s remaining
          </span>
          <span className="font-mono text-[var(--text-muted)]">
            {challengeData?.challenge_id || "—"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {recorder.status !== "recording" ? (
            <Button
              variant="primary"
              disabled={isVerifying || !challengeData || timeLeft <= 0}
              onClick={handleStartMic}
              icon={<Mic className="w-4 h-4" />}
            >
              Start Microphone Reply (5–10s)
            </Button>
          ) : (
            <Button
              variant="danger"
              disabled={isVerifying || recorder.elapsedSeconds < MIN_CHALLENGE_SEC}
              onClick={handleStopAndVerify}
              icon={<StopCircle className="w-4 h-4" />}
            >
              {recorder.elapsedSeconds < MIN_CHALLENGE_SEC
                ? `Keep speaking… ${(MIN_CHALLENGE_SEC - recorder.elapsedSeconds).toFixed(1)}s left (${recorder.level}%)`
                : `Stop & Verify Audio (${recorder.elapsedSeconds.toFixed(1)}s · ${recorder.level}%)`}
            </Button>
          )}
        </div>

        {spokenTranscript && (
          <div className="p-3 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] text-[14px]">
            <span className="font-semibold text-[var(--text-secondary)]">Heard ASR: </span>
            <span className="text-[var(--text-primary)]">{spokenTranscript}</span>
          </div>
        )}

        {executionMode === "DEMO" && challengeData && !verifyOutcome && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            <Button
              variant="secondary"
              size="sm"
              disabled={isVerifying}
              onClick={() => submitChallenge("SIMULATED_LIVE_PASS", challengeData.phrase)}
            >
              Simulate Live Pass (DEMO)
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isVerifying}
              onClick={() => submitChallenge("SIMULATED_REPLAY_FAIL", "recorded playback mismatch")}
            >
              Simulate Replay Attack (DEMO)
            </Button>
          </div>
        )}

        {verifyOutcome && (
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 text-[14px] ${
                verifyOutcome.passed
                  ? "bg-[var(--decision-continue-tint)] border-[var(--decision-continue-border)] text-[var(--decision-continue-text)]"
                  : verifyOutcome.status === "incomplete" || verifyOutcome.liveness_status === "INCOMPLETE"
                  ? "bg-[var(--decision-stepup-tint)] border-[var(--decision-stepup-border)] text-[var(--decision-stepup-text)]"
                  : "bg-[var(--decision-endcall-tint)] border-[var(--decision-endcall-border)] text-[var(--decision-endcall-text)]"
              }`}
            >
              {verifyOutcome.passed ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : verifyOutcome.status === "incomplete" || verifyOutcome.liveness_status === "INCOMPLETE" ? (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {verifyOutcome.passed
                    ? "Challenge Passed"
                    : verifyOutcome.status === "incomplete" || verifyOutcome.liveness_status === "INCOMPLETE"
                    ? "Challenge Technical Error (Retryable — No END_CALL)"
                    : "Challenge Failed — END_CALL Override"}
                  {verifyOutcome.reason ? ` (${verifyOutcome.reason})` : ""}
                </p>
                <p>{verifyOutcome.explanation}</p>
              </div>
            </div>

            <ul className="space-y-1 text-[14px]">
              {verifyOutcome.checks.map((chk) => (
                <li key={chk.key} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--decision-continue-solid)]" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[var(--decision-endcall-solid)]" />
                    )}
                    {chk.label}
                  </span>
                  <span className="text-[var(--text-muted)] truncate max-w-[210px]">{chk.detail}</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-2">
              {(verifyOutcome.status === "incomplete" || verifyOutcome.liveness_status === "INCOMPLETE") && (
                <Button variant="secondary" size="sm" onClick={handleRetryChallenge}>
                  Retry Challenge
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
