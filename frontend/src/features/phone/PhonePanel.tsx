import React, { useState } from "react";
import {
  FastForward,
  Pause,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Play,
  RotateCcw,
  Smartphone,
  StepForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAnalysis } from "../../context/AnalysisContext";
import type { ScenarioId } from "../../types";
import { SCENARIO_SCRIPTS } from "./simulationDirector";
import { CallerPhoneScreen } from "./CallerPhoneScreen";
import { AgentPhoneScreen } from "./AgentPhoneScreen";
import { PhoneErrorBoundary } from "./PhoneErrorBoundary";

export type PhoneViewMode = "caller" | "agent" | "both";

export interface PhonePanelProps {
  /** Compact inline Stage Mode presentation without the Scenario Director drawer chrome */
  stageEmbedded?: boolean;
}

const PhoneWorkspaceContent: React.FC<{
  viewMode: PhoneViewMode;
  setViewMode: (m: PhoneViewMode) => void;
  stageEmbedded?: boolean;
  onCloseDrawer?: () => void;
}> = ({ viewMode, setViewMode, stageEmbedded = false, onCloseDrawer }) => {
  const {
    phoneState,
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
    simulateIncomingPhoneCall,
    callerHangUpPhoneCall,
    triggerCallerMissedTimeout,
  } = useAnalysis();

  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>(
    directorScenarioId || "S1"
  );
  const activeScript = SCENARIO_SCRIPTS[directorScenarioId || selectedScenario];
  const isSideBySide = viewMode === "both";

  return (
    <div className="space-y-3 text-[14px]">
      {/* Role View Switcher + Sound Control */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Phone view selector"
          className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] p-0.5"
        >
          {(
            [
              { id: "caller", label: "Caller phone" },
              { id: "agent", label: "Agent phone" },
              { id: "both", label: "Side by side" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={viewMode === tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[14px] font-semibold cursor-pointer transition-colors ${
                viewMode === tab.id
                  ? "bg-[var(--brand-navy)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={ringtoneStatus.muted ? "Unmute ringtone" : "Mute ringtone"}
            onClick={toggleRingtoneMute}
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {ringtoneStatus.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {onCloseDrawer && (
            <button
              type="button"
              aria-label="Close phone drawer"
              onClick={onCloseDrawer}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Autoplay Blocked Banner */}
      {ringtoneStatus.audioBlocked && phoneState.callState === "incoming_ringing" && (
        <button
          type="button"
          onClick={() => void unlockRingtoneAudio()}
          className="w-full py-2 px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[var(--text-primary)] text-[14px] font-semibold cursor-pointer flex items-center justify-center gap-2"
        >
          <Volume2 className="w-4 h-4 text-[var(--decision-stepup-solid)]" />
          Tap to enable sound
        </button>
      )}

      {/* Handset Preview */}
      <PhoneErrorBoundary>
        {isSideBySide ? (
          <div className="grid grid-cols-2 gap-2 items-start">
            <CallerPhoneScreen compact />
            <AgentPhoneScreen compact />
          </div>
        ) : viewMode === "agent" ? (
          <AgentPhoneScreen />
        ) : (
          <CallerPhoneScreen />
        )}
      </PhoneErrorBoundary>

      {/* Simulation Director (hidden in condensed stage view) */}
      {!stageEmbedded && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold text-[var(--text-primary)]">
              Simulation Director
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--decision-stepup-tint)] border border-[var(--decision-stepup-border)] text-[var(--decision-stepup-text)] text-[13px] font-semibold">
              DEMO
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="director-scenario-select" className="sr-only">
              Scenario selector
            </label>
            <select
              id="director-scenario-select"
              aria-label="Simulation scenario"
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value as ScenarioId)}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text-primary)]"
            >
              {(["S1", "S2", "S3", "S4"] as ScenarioId[]).map((sid) => (
                <option key={sid} value={sid}>
                  {SCENARIO_SCRIPTS[sid].title}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Toggle playback speed"
              onClick={() => setDirectorSpeed(directorSpeed === 1 ? 2 : 1)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] text-[14px] font-mono font-bold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              {directorSpeed}x
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {directorStatus === "playing" ? (
              <button
                type="button"
                aria-label="Pause scenario"
                onClick={pauseDirector}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-navy)] text-white text-[14px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            ) : directorStatus === "yielded" ? (
              <button
                type="button"
                aria-label="Resume scenario"
                onClick={resumeScenario}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-navy)] text-white text-[14px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Resume scenario
              </button>
            ) : (
              <button
                type="button"
                aria-label="Play scenario"
                onClick={() => playScenario(selectedScenario)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-navy)] text-white text-[14px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Play
              </button>
            )}

            <button
              type="button"
              aria-label="Step next scenario beat"
              onClick={() => stepDirectorNext(selectedScenario)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-[14px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <StepForward className="w-3.5 h-3.5" />
              Step
            </button>

            <button
              type="button"
              aria-label="Reset scenario"
              onClick={resetDirector}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] text-[14px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {directorStatus === "yielded" && (
            <p className="text-[13px] font-medium text-[var(--decision-stepup-text)] bg-[var(--decision-stepup-tint)] border border-[var(--decision-stepup-border)] rounded-lg px-2.5 py-1.5">
              Paused for manual operator action. Click Resume scenario to continue remaining steps.
            </p>
          )}

          {/* Scenario Step Timeline */}
          <ol className="space-y-1 list-none m-0 p-0 max-h-[150px] overflow-y-auto">
            {activeScript.steps.map((step, idx) => {
              const isCurrent =
                (directorScenarioId === activeScript.id && idx === directorStepIndex - 1) ||
                (directorScenarioId === activeScript.id &&
                  directorStatus === "idle" &&
                  directorStepIndex === activeScript.steps.length &&
                  idx === activeScript.steps.length - 1);
              const isDone =
                directorScenarioId === activeScript.id && idx < directorStepIndex;
              return (
                <li
                  key={step.id}
                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md text-[13px] ${
                    isCurrent
                      ? "bg-[var(--brand-navy)] text-white font-semibold"
                      : isDone
                      ? "bg-[var(--decision-continue-tint)] text-[var(--decision-continue-text)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="truncate">
                    {idx + 1}. {step.label}
                  </span>
                  <span className="font-mono shrink-0">{(step.offsetMs / 1000).toFixed(1)}s</span>
                </li>
              );
            })}
          </ol>

          {/* Manual Edge Case Call Controls */}
          <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)] block">
              Manual Call Triggers
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                aria-label="Simulate incoming call"
                onClick={simulateIncomingPhoneCall}
                className="w-full py-1.5 px-2.5 rounded-lg border border-[var(--brand-steel)] text-[var(--brand-steel)] hover:bg-[var(--fill-subtle)] text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PhoneIncoming className="w-4 h-4" />
                Simulate incoming call
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  aria-label="Caller hangs up"
                  onClick={callerHangUpPhoneCall}
                  disabled={phoneState.callState === "idle" || phoneState.callState === "ended"}
                  className="py-1.5 px-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-45 text-[13px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  Caller hangs up
                </button>
                <button
                  type="button"
                  aria-label="Caller does not answer (missed)"
                  onClick={triggerCallerMissedTimeout}
                  className="py-1.5 px-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-[13px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PhoneMissed className="w-3.5 h-3.5" />
                  Missed (25s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PhonePanel: React.FC<PhonePanelProps> = ({ stageEmbedded = false }) => {
  const { showPhone, setShowPhone, phoneState } = useAnalysis();
  const [viewMode, setViewMode] = useState<PhoneViewMode>("caller");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  if (stageEmbedded) {
    return (
      <div className="w-full max-w-[360px] mx-auto">
        <PhoneWorkspaceContent
          viewMode={viewMode}
          setViewMode={setViewMode}
          stageEmbedded
        />
      </div>
    );
  }

  return (
    <>
      {/* Desktop Wide Docked Column (>= 1600px, ~380px wide) */}
      {showPhone ? (
        <aside
          aria-label="Live Phone Panel"
          className="hidden min-[1600px]:block w-[380px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs sticky top-4"
        >
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[var(--brand-steel)]" />
              <h3 className="text-[15px] font-bold text-[var(--text-primary)] m-0">
                Live Phone Mirror
              </h3>
            </div>
            <button
              type="button"
              aria-label="Hide phone"
              onClick={() => setShowPhone(false)}
              className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Hide phone
            </button>
          </div>
          <PhoneWorkspaceContent viewMode={viewMode} setViewMode={setViewMode} />
        </aside>
      ) : (
        <div className="hidden min-[1600px]:flex shrink-0">
          <button
            type="button"
            aria-label="Show phone"
            onClick={() => setShowPhone(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[14px] font-semibold text-[var(--text-primary)] shadow-xs cursor-pointer hover:bg-[var(--fill-subtle)]"
          >
            <Smartphone className="w-4 h-4 text-[var(--brand-steel)]" />
            Show phone
          </button>
        </div>
      )}

      {/* Below 1600px Floating Launcher + Slide-Over Drawer */}
      <div className="min-[1600px]:hidden">
        <button
          type="button"
          aria-label="Open Phone preview"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--brand-navy)] text-white shadow-xl border border-white/20 text-[14px] font-bold cursor-pointer hover:opacity-95"
        >
          <Phone
            className={`w-4 h-4 ${
              phoneState.callState === "incoming_ringing"
                ? "animate-pulse motion-reduce:animate-none text-amber-300"
                : ""
            }`}
          />
          <span>Phone</span>
        </button>

        {drawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Phone Preview Drawer"
            className="fixed inset-0 z-50 flex justify-end bg-black/50"
          >
            <div className="w-full max-w-[400px] h-full bg-[var(--surface)] border-l border-[var(--border)] p-4 overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[var(--brand-steel)]" />
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)] m-0">
                    Live Phone Mirror
                  </h3>
                </div>
              </div>
              <PhoneWorkspaceContent
                viewMode={viewMode}
                setViewMode={setViewMode}
                onCloseDrawer={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
