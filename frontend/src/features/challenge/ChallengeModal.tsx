import React, { useState, useEffect, useRef } from "react";
import { Mic, StopCircle, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Banner";
import { copy } from "../../copy";
import { aegisApi } from "../../lib/api";
import { useRecorder } from "../../lib/audio";
import type { ChallengeStartResponse } from "../../types";

export interface ChallengeModalProps {
  isOpen: boolean;
  scenarioId: string | null;
  onClose: () => void;
  onOutcome: (status: "passed" | "failed" | "incomplete", detail?: string) => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  scenarioId,
  onClose,
  onOutcome,
}) => {
  const [challengeData, setChallengeData] = useState<ChallengeStartResponse | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [incompleteReason, setIncompleteReason] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const recorder = useRecorder();
  const outcomeFiredRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      recorder.cancelRecording();
      setIncompleteReason(null);
      setIsVerifying(false);
      return;
    }

    outcomeFiredRef.current = false;
    setIncompleteReason(null);
    setTimeLeft(10);

    aegisApi
      .startChallenge()
      .then((data) => {
        setChallengeData(data);
        setTimeLeft(data.expires_in_seconds || 10);
      })
      .catch(() => {
        setIncompleteReason(copy.liveness.incompleteDetail);
        onOutcome("incomplete", "Challenge start API error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 10s countdown timer; timeout -> Incomplete (never pass)
  useEffect(() => {
    if (!isOpen || incompleteReason || isVerifying) return;
    if (timeLeft <= 0) {
      if (!outcomeFiredRef.current) {
        outcomeFiredRef.current = true;
        recorder.cancelRecording();
        setIncompleteReason("10s challenge window timed out.");
        onOutcome("incomplete", "Timeout after 10s");
      }
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, timeLeft, incompleteReason, isVerifying]);

  // Watch recorder errors (denied permission, unsupported browser, cut-off) -> Incomplete
  useEffect(() => {
    if (recorder.status === "error" && recorder.errorReason && !outcomeFiredRef.current) {
      outcomeFiredRef.current = true;
      const reason = `Microphone ${recorder.errorReason.toLowerCase().replace("_", " ")}`;
      setIncompleteReason(reason);
      onOutcome("incomplete", reason);
    }
  }, [recorder.status, recorder.errorReason, onOutcome]);

  const submitVerification = async (params: { audio?: Blob; forcedPass?: boolean }) => {
    if (!challengeData || outcomeFiredRef.current) return;
    setIsVerifying(true);
    recorder.setStatus("uploading");

    try {
      const res = await aegisApi.verifyChallenge({
        challenge_id: challengeData.challenge_id,
        nonce: challengeData.nonce,
        audio: params.audio,
        scenario_id: scenarioId,
        passed: params.forcedPass,
      });
      outcomeFiredRef.current = true;
      setIsVerifying(false);
      onOutcome(res.status, res.detail);
    } catch {
      outcomeFiredRef.current = true;
      setIsVerifying(false);
      recorder.setStatus("idle");
      setIncompleteReason("API verification error");
      onOutcome("incomplete", "API verification error");
    }
  };

  const handleStopAndVerify = async () => {
    const result = await recorder.stopRecording();
    if (!result || result.blob.size === 0) {
      if (!outcomeFiredRef.current) {
        outcomeFiredRef.current = true;
        setIncompleteReason("Recording cut off with no audio");
        onOutcome("incomplete", "Cut-off recording");
      }
      return;
    }
    await submitVerification({ audio: result.blob });
  };

  const statusText =
    recorder.status === "requesting_permission"
      ? copy.liveness.requestingPermission
      : recorder.status === "recording"
      ? copy.liveness.recordingState
      : recorder.status === "uploading" || isVerifying
      ? copy.liveness.uploadingState
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.liveness.title}
      subtitle={copy.liveness.subtitle}
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {copy.voiceprints.cancel}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={isVerifying || !!incompleteReason}
              onClick={() => submitVerification({ forcedPass: false })}
              icon={<XCircle className="w-4 h-4" />}
            >
              {copy.liveness.simulateFail}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isVerifying || !!incompleteReason}
              onClick={() => submitVerification({ forcedPass: true })}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {copy.liveness.simulatePass}
            </Button>
            {recorder.status === "recording" ? (
              <Button
                variant="primary"
                size="sm"
                loading={isVerifying}
                onClick={handleStopAndVerify}
                icon={<StopCircle className="w-4 h-4" />}
              >
                {copy.liveness.stopAndVerify}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={isVerifying || !!incompleteReason}
                onClick={() => recorder.startRecording()}
                icon={<Mic className="w-4 h-4" />}
              >
                {copy.liveness.recordAndVerify}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[14px] text-[var(--text-secondary)]">
          {copy.liveness.promptInstruction}
        </p>

        {/* Huge Nonce Phrase */}
        <div className="p-5 bg-[var(--fill-subtle)] border-2 border-[var(--brand-steel)] rounded-[12px] text-center space-y-1">
          <p className="text-[32px] sm:text-[36px] font-black text-[var(--text-primary)] tracking-tight leading-tight">
            "{challengeData?.phrase || "cobalt mango seven"}"
          </p>
        </div>

        {/* 10s Countdown */}
        <div className="flex items-center justify-between p-3 bg-[var(--fill-subtle)] rounded-lg text-[14px] border border-[var(--border)]">
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
            <Clock className="w-4 h-4 text-[var(--brand-steel)]" />
            {copy.liveness.timerLabel}
          </span>
          <span
            className={`font-mono font-bold text-[16px] ${
              timeLeft <= 3 ? "text-[var(--decision-endcall-solid)]" : "text-[var(--text-primary)]"
            }`}
          >
            {timeLeft}s
          </span>
        </div>

        {/* Level Meter & Recorder State */}
        {statusText && (
          <div className="space-y-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-[14px] font-semibold text-[var(--brand-steel)]">{statusText}</p>
            <div className="w-full h-2.5 bg-[var(--fill-subtle)] rounded-full overflow-hidden border border-[var(--border)]">
              <div
                className="h-full bg-[var(--brand-steel)] transition-all duration-75"
                style={{ width: `${recorder.level}%` }}
              />
            </div>
          </div>
        )}

        {/* Incomplete State Banner */}
        {incompleteReason && (
          <Banner variant="warn" title={copy.liveness.incomplete}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{incompleteReason} — {copy.liveness.incompleteDetail}</span>
            </div>
          </Banner>
        )}

        <p className="caption-text italic text-[var(--text-muted)]">
          {copy.liveness.caption}
        </p>
      </div>
    </Modal>
  );
};
