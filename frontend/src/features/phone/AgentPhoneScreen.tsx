import React from "react";
import {
  AlertTriangle,
  Headphones,
  Pause,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useAnalysis, usePhoneViewModel } from "../../context/AnalysisContext";
import { PhoneFrame } from "./PhoneFrame";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface AgentPhoneScreenProps {
  compact?: boolean;
}

export const AgentPhoneScreen: React.FC<AgentPhoneScreenProps> = ({ compact = false }) => {
  const vm = usePhoneViewModel("agent");
  const {
    phoneState,
    acceptIncomingPhoneCall,
    declineIncomingPhoneCall,
    executeCallAction,
    resumeBotAction,
    guardState,
  } = useAnalysis();

  const chipStyle = {
    info: "bg-sky-500/20 text-sky-100 border-sky-400/50",
    success: "bg-emerald-500/20 text-emerald-100 border-emerald-400/50",
    warning: "bg-amber-500/20 text-amber-100 border-amber-400/50",
    danger: "bg-rose-500/25 text-rose-100 border-rose-400/60",
    neutral: "bg-white/10 text-white/90 border-white/25",
  }[vm.statusVariant];

  const canAct = vm.screen !== "idle" && vm.screen !== "ended" && !vm.showIncomingActions;
  const isPaused = vm.screen === "on_hold" || guardState === "PAUSED_BY_GUARD";

  return (
    <PhoneFrame roleLabel="Agent Phone" tone="agent" compact={compact}>
      <div
        data-testid="agent-phone-screen"
        data-screen-state={vm.screen}
        className="flex-1 flex flex-col justify-between gap-2.5 text-left"
      >
        <div aria-live="polite" className="sr-only">
          {vm.ariaAnnouncement}
        </div>

        {/* Caller Identity & Status Chip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full border text-[13px] font-bold ${chipStyle}`}>
              {vm.statusChip}
            </span>
            {vm.screen !== "idle" && (
              <span className="text-[13px] font-mono text-white/80">
                {vm.showIncomingActions
                  ? `${vm.ringElapsedSeconds}s / ${vm.ringTimeoutSeconds}s`
                  : formatDuration(vm.elapsedSeconds)}
              </span>
            )}
          </div>

          <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 space-y-0.5">
            <p className={`${compact ? "text-[14px]" : "text-[16px]"} font-bold text-white leading-snug`}>
              {vm.headline}
            </p>
            <p className="text-[14px] text-white/80 leading-snug">{vm.subline}</p>
            <p className="text-[13px] font-mono text-white/70">
              {vm.callerId} · {vm.claimedCustomerId}
            </p>
          </div>
        </div>

        {/* Incoming Call UI OR Transcript & Recommended Action */}
        {vm.showIncomingActions ? (
          <div className="my-auto rounded-2xl bg-sky-500/15 border border-sky-400/40 p-3 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-sky-500/25 flex items-center justify-center">
              <PhoneIncoming className="w-6 h-6 text-sky-200 animate-pulse motion-reduce:animate-none" />
            </div>
            <p className="text-[14px] font-semibold text-white">
              Incoming Call · {vm.claimedIdentity}
            </p>
            <div className={`grid ${compact ? "grid-cols-1 gap-1.5" : "grid-cols-2 gap-2"}`}>
              <button
                type="button"
                aria-label="Accept incoming call"
                onClick={acceptIncomingPhoneCall}
                className={`${compact ? "py-2 px-2 text-[13px]" : "py-2.5 px-2 text-[14px]"} rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                Accept
              </button>
              <button
                type="button"
                aria-label="Decline incoming call"
                onClick={declineIncomingPhoneCall}
                className={`${compact ? "py-2 px-2 text-[13px]" : "py-2.5 px-2 text-[14px]"} rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <PhoneOff className="w-4 h-4 shrink-0" />
                Decline
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Transcript snippet preview */}
            <div className="rounded-xl bg-black/30 border border-white/15 p-2.5 space-y-1.5 max-h-[155px] overflow-y-auto">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-white/65 block">
                Live Transcript
              </span>
              {vm.transcriptBubbles.length === 0 ? (
                <p className="text-[14px] text-white/65">No speech captured yet.</p>
              ) : (
                vm.transcriptBubbles.slice(-3).map((b) => {
                  const suspicious =
                    /otp|urgent|freeze|frozen|do not tell|wire|gift card/i.test(b.text);
                  return (
                    <div
                      key={b.id}
                      className={`px-2 py-1.5 rounded-lg text-[14px] leading-snug ${
                        suspicious
                          ? "bg-amber-500/20 border border-amber-400/50 text-amber-100"
                          : "bg-white/10 text-white/95"
                      }`}
                    >
                      <span className="text-[12px] font-bold uppercase text-white/70 mr-1.5">
                        {b.speaker}:
                      </span>
                      {b.text}
                    </div>
                  );
                })
              )}
            </div>

            {/* Recommended action guidance */}
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 space-y-1">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-white/70 inline-flex items-center gap-1">
                {vm.statusVariant === "danger" && <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />}
                Recommended Action
              </span>
              <p className="text-[14px] text-white font-medium leading-snug">
                {vm.recommendedAction}
              </p>
            </div>
          </div>
        )}

        {/* Quick Agent Phone Action Sync Controls */}
        {canAct && (
          <div className={`grid grid-cols-2 ${compact ? "gap-1" : "gap-1.5"} pt-1`}>
            <button
              type="button"
              aria-label="Agent phone step-up challenge"
              onClick={() => void executeCallAction("CHALLENGE", "Triggered from agent phone", phoneState.callId || undefined)}
              className={`${compact ? "py-1.5 px-1 text-[12px]" : "py-1.5 px-2 text-[14px]"} rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-100 font-semibold inline-flex items-center justify-center gap-1 cursor-pointer min-w-0`}
            >
              {!compact && <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">Challenge</span>
            </button>

            <button
              type="button"
              aria-label={isPaused ? "Resume bot" : "Pause bot"}
              onClick={() =>
                isPaused
                  ? resumeBotAction()
                  : void executeCallAction("PAUSE_BOT", "Paused from agent phone", phoneState.callId || undefined)
              }
              className={`${compact ? "py-1.5 px-1 text-[12px]" : "py-1.5 px-2 text-[14px]"} rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold inline-flex items-center justify-center gap-1 cursor-pointer min-w-0`}
            >
              {!compact && (isPaused ? <Play className="w-3.5 h-3.5 shrink-0" /> : <Pause className="w-3.5 h-3.5 shrink-0" />)}
              <span className="truncate">{isPaused ? "Resume" : "Pause"}</span>
            </button>

            <button
              type="button"
              aria-label="Transfer call to human"
              onClick={() =>
                void executeCallAction("TRANSFER_TO_HUMAN", "Escalated from agent phone", phoneState.callId || undefined)
              }
              className={`${compact ? "py-1.5 px-1 text-[12px]" : "py-1.5 px-2 text-[14px]"} rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-100 font-semibold inline-flex items-center justify-center gap-1 cursor-pointer min-w-0`}
            >
              {!compact && <Headphones className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">Transfer</span>
            </button>

            <button
              type="button"
              aria-label="Agent terminate call"
              onClick={() =>
                void executeCallAction("TERMINATE_CALL", "Ended from agent phone", phoneState.callId || undefined)
              }
              className={`${compact ? "py-1.5 px-1 text-[12px]" : "py-1.5 px-2 text-[14px]"} rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold inline-flex items-center justify-center gap-1 cursor-pointer min-w-0`}
            >
              {!compact && <PhoneOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">End Call</span>
            </button>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
};
