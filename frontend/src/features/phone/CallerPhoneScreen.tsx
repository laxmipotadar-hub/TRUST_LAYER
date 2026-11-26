import React, { useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  PauseCircle,
  Phone,
  PhoneOff,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAnalysis, usePhoneViewModel } from "../../context/AnalysisContext";
import { aegisApi } from "../../lib/api";
import { useRecorder } from "../../lib/audio";
import { PhoneFrame } from "./PhoneFrame";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface CallerPhoneScreenProps {
  compact?: boolean;
}

const WAVEFORM_MULTIPLIERS = [0.45, 0.72, 0.95, 1.0, 0.85, 0.62, 0.42];

export const CallerPhoneScreen: React.FC<CallerPhoneScreenProps> = ({ compact = false }) => {
  const vm = usePhoneViewModel("caller");
  const {
    phoneState,
    phoneDispatch,
    callerHangUpPhoneCall,
    applyUpdatedCall,
  } = useAnalysis();
  const recorder = useRecorder();
  const autoStopTimerRef = useRef<number | null>(null);
  const challengeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (recorder.status === "recording") {
      phoneDispatch({ type: "SET_AUDIO_LEVEL", level: recorder.level });
    }
  }, [recorder.level, recorder.status, phoneDispatch]);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current !== null) {
        window.clearTimeout(autoStopTimerRef.current);
      }
    };
  }, []);

  const handleRequestVoiceVerify = async () => {
    phoneDispatch({ type: "SET_MIC_ERROR", message: null });
    try {
      if (phoneState.callId && !phoneState.isDemo) {
        const ch = await aegisApi.startChallenge(phoneState.callId, phoneState.claimedCustomerId);
        challengeIdRef.current = ch.challenge_id;
        phoneDispatch({
          type: "START_CHALLENGE",
          actor: "caller",
          phrase: ch.phrase,
          challengeId: ch.challenge_id,
          expiresInSeconds: ch.window_seconds,
        });
        return;
      }
    } catch {
      // Fall back cleanly to local prompt phrase if backend challenge init is unavailable
    }
    phoneDispatch({
      type: "START_CHALLENGE",
      actor: "caller",
      phrase: "cobalt mango seven",
      expiresInSeconds: 20,
    });
  };

  const handleSubmitVoiceReply = async (blob: Blob | null) => {
    if (!blob) {
      phoneDispatch({
        type: "CHALLENGE_RESULT",
        actor: "system",
        passed: false,
        incomplete: true,
        note: "No audio captured",
      });
      return;
    }

    const activeChallengeId = challengeIdRef.current || phoneState.challengeId;
    if (phoneState.callId && activeChallengeId && !phoneState.isDemo) {
      try {
        const res = await aegisApi.verifyChallengeAudio({
          challenge_id: activeChallengeId,
          spoken_response: phoneState.challengePhrase || "cobalt mango seven",
          response_latency_ms: 1500,
          capture_mode: "LIVE_AUDIO",
          file: blob,
        });
        if (res.updated_call) {
          applyUpdatedCall(res.updated_call);
        }
        phoneDispatch({
          type: "CHALLENGE_RESULT",
          actor: "system",
          passed: res.passed,
          incomplete: res.liveness_status === "INCOMPLETE",
          note: res.explanation,
        });
        return;
      } catch {
        phoneDispatch({
          type: "CHALLENGE_RESULT",
          actor: "system",
          passed: false,
          incomplete: true,
          note: "Verification unavailable right now",
        });
        return;
      }
    }

    // Demo-only reply completion (0 external calls)
    phoneDispatch({
      type: "CHALLENGE_RESULT",
      actor: "system",
      passed: true,
      note: "Thanks, you're verified",
    });
  };

  const handleStartReplyRecording = async () => {
    phoneDispatch({ type: "SET_MIC_ERROR", message: null });
    phoneDispatch({ type: "CHALLENGE_START_RECORDING", actor: "caller" });
    const started = await recorder.startRecording();
    if (!started) {
      phoneDispatch({
        type: "SET_MIC_ERROR",
        message: "Microphone unavailable — use another channel or retry",
      });
      phoneDispatch({
        type: "CHALLENGE_RESULT",
        actor: "system",
        passed: false,
        incomplete: true,
        note: "Microphone permission required",
      });
      return;
    }

    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
    }
    autoStopTimerRef.current = window.setTimeout(async () => {
      const captured = await recorder.stopRecording();
      await handleSubmitVoiceReply(captured?.blob || null);
    }, 3500);
  };

  const handleFinishRecordingNow = async () => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    const captured = await recorder.stopRecording();
    await handleSubmitVoiceReply(captured?.blob || null);
  };

  const bannerColors = {
    neutral: "bg-white/10 border-white/20 text-white",
    success: "bg-emerald-500/20 border-emerald-400/50 text-emerald-100",
    amber: "bg-amber-500/20 border-amber-400/50 text-amber-100",
    danger: "bg-rose-500/20 border-rose-400/50 text-rose-100",
  }[vm.bannerTone];

  const radius = compact ? 18 : 24;
  const circumference = 2 * Math.PI * radius;
  const pct =
    vm.challengeTotalSec > 0
      ? Math.max(0, Math.min(1, vm.challengeRemainingSec / vm.challengeTotalSec))
      : 0;
  const dashOffset = circumference * (1 - pct);

  return (
    <PhoneFrame roleLabel="Caller Phone" tone="caller" compact={compact}>
      <div
        data-testid="caller-phone-screen"
        data-screen-state={vm.screen}
        className="flex-1 flex flex-col justify-between gap-3 text-center"
      >
        <div aria-live="polite" className="sr-only">
          {vm.ariaAnnouncement}
        </div>

        {/* Identity + Connection State */}
        <div className="space-y-2 pt-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center relative">
            {vm.showVerifiedShield ? (
              <ShieldCheck className="w-7 h-7 text-emerald-300" />
            ) : vm.screen === "on_hold" ? (
              <PauseCircle className="w-7 h-7 text-amber-300" />
            ) : vm.bannerTone === "danger" ? (
              <ShieldAlert className="w-7 h-7 text-rose-300" />
            ) : (
              <Phone
                className={`w-6 h-6 text-white ${
                  vm.screen === "incoming_ringing" || vm.screen === "outgoing_calling"
                    ? "animate-pulse motion-reduce:animate-none"
                    : ""
                }`}
              />
            )}
          </div>

          <div>
            <p className={`${compact ? "text-[14px]" : "text-[18px]"} font-bold leading-snug text-white`}>
              {vm.headline}
            </p>
            <p className="text-[14px] text-white/80 leading-snug mt-0.5">{vm.subline}</p>
          </div>

          {vm.showTimer && (
            <div className="text-[14px] font-mono text-white/90">
              {formatDuration(vm.elapsedSeconds)}
            </div>
          )}

          {vm.bannerText && (
            <div className={`px-3 py-2 rounded-xl border text-[14px] font-medium ${bannerColors}`}>
              {vm.bannerText}
            </div>
          )}

          {vm.challengeOutcomeText && (
            <div className="px-3 py-1.5 rounded-lg bg-white/15 text-[14px] font-semibold text-white">
              {vm.challengeOutcomeText}
            </div>
          )}

          {vm.micError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-xl border border-amber-400/50 bg-amber-500/20 text-[14px] text-amber-100"
            >
              {vm.micError}
            </div>
          )}
        </div>

        {/* Live Challenge Prompt + Countdown Ring OR Waveform */}
        <div className="space-y-3 my-auto">
          {vm.challengePhrase && (
            <div className="rounded-2xl bg-white/10 border border-white/20 p-3 space-y-2">
              <div className="flex items-center justify-center gap-3">
                <svg
                  width={compact ? 46 : 58}
                  height={compact ? 46 : 58}
                  viewBox={`0 0 ${(radius + 6) * 2} ${(radius + 6) * 2}`}
                  className="-rotate-90"
                  aria-label={`Challenge time remaining: ${vm.challengeRemainingSec} seconds`}
                >
                  <circle
                    cx={radius + 6}
                    cy={radius + 6}
                    r={radius}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx={radius + 6}
                    cy={radius + 6}
                    r={radius}
                    stroke="#fbbf24"
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <span className="text-[16px] font-mono font-bold text-amber-200">
                  {vm.challengeRemainingSec}s
                </span>
              </div>
              <p className="text-[14px] text-white/75 uppercase tracking-wide font-semibold">
                Please say
              </p>
              <p className="text-[16px] font-bold text-white tracking-wide">
                &ldquo;{vm.challengePhrase}&rdquo;
              </p>
            </div>
          )}

          {vm.showWaveform && (
            <div
              aria-label="Caller audio waveform"
              className="flex items-end justify-center gap-1.5 h-10 px-4"
            >
              {WAVEFORM_MULTIPLIERS.map((mult, idx) => {
                const raw = vm.callerMuted ? 8 : Math.max(14, vm.audioLevel || 24);
                const h = Math.min(38, Math.max(6, Math.round(raw * 0.36 * mult)));
                return (
                  <span
                    key={idx}
                    style={{ height: `${h}px` }}
                    className={`w-1.5 rounded-full transition-all duration-150 motion-reduce:transition-none ${
                      vm.screen === "challenge_recording"
                        ? "bg-amber-300"
                        : vm.screen === "analyzing"
                        ? "bg-sky-300"
                        : "bg-emerald-300"
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Caller Interactive Controls */}
        <div className="space-y-2.5 pb-1">
          {vm.showVerifyButton && (
            <button
              type="button"
              aria-label="Verify my voice"
              onClick={() => void handleRequestVoiceVerify()}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[14px] font-bold cursor-pointer transition-colors"
            >
              Verify my voice
            </button>
          )}

          {vm.showStartReplyButton && (
            <button
              type="button"
              aria-label="Start Voice Reply"
              onClick={() => void handleStartReplyRecording()}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[14px] font-bold cursor-pointer transition-colors"
            >
              Start Voice Reply
            </button>
          )}

          {vm.screen === "challenge_recording" && (
            <button
              type="button"
              aria-label="Stop and send voice reply"
              onClick={() => void handleFinishRecordingNow()}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[14px] font-bold cursor-pointer transition-colors"
            >
              Send Reply
            </button>
          )}

          {(vm.showInCallControls || vm.showEndButton) && (
            <div className="flex items-center justify-center gap-3 pt-1">
              {vm.showInCallControls && (
                <>
                  <button
                    type="button"
                    aria-label={vm.callerMuted ? "Unmute microphone" : "Mute microphone"}
                    aria-pressed={vm.callerMuted}
                    onClick={() => phoneDispatch({ type: "TOGGLE_MUTE" })}
                    className={`w-11 h-11 rounded-full flex items-center justify-center border cursor-pointer transition-colors ${
                      vm.callerMuted
                        ? "bg-white text-slate-950 border-white"
                        : "bg-white/10 text-white border-white/25 hover:bg-white/20"
                    }`}
                  >
                    {vm.callerMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    aria-label={vm.callerSpeakerOn ? "Disable speaker" : "Enable speaker"}
                    aria-pressed={vm.callerSpeakerOn}
                    onClick={() => phoneDispatch({ type: "TOGGLE_SPEAKER" })}
                    className={`w-11 h-11 rounded-full flex items-center justify-center border cursor-pointer transition-colors ${
                      vm.callerSpeakerOn
                        ? "bg-white text-slate-950 border-white"
                        : "bg-white/10 text-white border-white/25 hover:bg-white/20"
                    }`}
                  >
                    {vm.callerSpeakerOn ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </button>
                </>
              )}

              {vm.showEndButton && (
                <button
                  type="button"
                  aria-label="End call"
                  onClick={callerHangUpPhoneCall}
                  className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg cursor-pointer transition-colors"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
};
