import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, ShieldCheck, X } from 'lucide-react';
import { TrustScoreRadialGauge } from '../components/charts/TrustScoreRadialGauge';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { LiveChallengeModal } from '../components/dashboard/LiveChallengeModal';
import { ActionButton } from '../components/ui/ActionButton';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { StatusBadge, type StatusTone } from '../components/ui/StatusBadge';
import { useAegis } from '../hooks/useAegis';

function verdictTone(verdict: string): StatusTone {
  if (verdict === 'SAFE') return 'safe';
  if (verdict === 'THREAT') return 'threat';
  return 'caution';
}

export function StageModePage() {
  const {
    scenarios,
    currentCall,
    botStatus,
    loading,
    runningScenarioId,
    runScenario,
    openChallengeForCurrentCall,
  } = useAegis();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen may be blocked outside user gesture in some embedded frames
    }
  };

  const exitStage = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    navigate('/');
  };

  if (loading || !currentCall) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  const tb = currentCall.trust_breakdown;
  const finalVerdict = tb.final_decision || tb.verdict;
  const scoreVerdict = tb.score_based_verdict || tb.verdict;

  const heroBorder =
    finalVerdict === 'SAFE'
      ? 'border-[#22c55e]/50 bg-[#111827]'
      : finalVerdict === 'THREAT'
        ? 'animate-threat-escalation border-[#ef4444]/60 bg-[#111827]'
        : 'border-[#f59e0b]/50 bg-[#111827]';

  const verdictTextColor =
    finalVerdict === 'SAFE'
      ? 'text-[#22c55e]'
      : finalVerdict === 'THREAT'
        ? 'text-[#ef4444]'
        : 'text-[#f59e0b]';

  const callerStatus =
    currentCall.caller_profile?.verification_status ?? currentCall.speaker_identity.status;

  const oneLineExplanation = tb.liveness_override_applied
    ? 'Voice and speaker matched, but failed Challenge Liveness overrode a SAFE score to THREAT.'
    : tb.recommended_action;

  return (
    <div className="flex h-screen w-screen flex-col justify-between overflow-hidden bg-[#0a0f1e] p-5 lg:p-7">
      {/* Minimal Projector Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/40 bg-[#111827] text-sky-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tracking-tight text-[#f8fafc]">AEGIS</span>
              <span className="font-mono text-sm tracking-widest text-sky-400">
                THE TRUST LAYER
              </span>
              <ProvenanceBadge provenance={currentCall.overall_provenance} />
            </div>
          </div>
        </div>

        {/* Minimal Stage Controls */}
        <div className="flex items-center gap-2.5">
          <select
            aria-label="Select demonstration scenario"
            disabled={runningScenarioId !== null}
            value={currentCall.scenario_id ?? ''}
            onChange={(e) => {
              if (e.target.value) void runScenario(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-[#111827] px-3.5 py-2 font-mono text-sm font-semibold text-[#f8fafc] focus:border-sky-500 focus:outline-none"
          >
            {!currentCall.scenario_id && <option value="">Custom Session</option>}
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.code}: {sc.title}
              </option>
            ))}
          </select>

          <ActionButton
            variant="caution"
            size="md"
            onClick={() => void openChallengeForCurrentCall()}
          >
            Live Challenge
          </ActionButton>

          <ActionButton
            variant="secondary"
            size="md"
            icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </ActionButton>

          <ActionButton
            variant="ghost"
            size="md"
            icon={<X className="h-4 w-4" />}
            onClick={exitStage}
          >
            ESC
          </ActionButton>
        </div>
      </header>

      {/* Center Hero Card: 20ft Projector Legibility */}
      <section
        className={`my-4 flex flex-1 flex-col justify-center rounded-2xl border-2 px-6 py-5 lg:px-10 ${heroBorder}`}
      >
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="flex justify-center lg:col-span-4">
            <TrustScoreRadialGauge
              score={tb.composite_score}
              verdict={finalVerdict}
              label="TRUST SCORE"
              size={240}
            />
          </div>

          <div className="space-y-3 text-center lg:col-span-8 lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <span className="font-mono text-sm uppercase tracking-widest text-[#94a3b8]">
                FINAL SECURITY DECISION
              </span>
              {tb.liveness_override_applied && (
                <StatusBadge
                  label={`SCORE WAS ${scoreVerdict} (${tb.composite_score?.toFixed(2)}) · OVERRIDDEN`}
                  tone="threat"
                  size="md"
                />
              )}
            </div>

            <div className={`font-mono text-5xl font-extrabold tracking-tight lg:text-7xl ${verdictTextColor}`}>
              {finalVerdict}
            </div>

            <div className="text-xl font-semibold text-[#f8fafc] lg:text-2xl">
              {currentCall.caller_profile?.claimed_name ?? currentCall.caller_label}
              <span className="mx-2 text-slate-600">·</span>
              <span className="font-mono text-sky-300">{callerStatus}</span>
            </div>

            <p className="text-base leading-snug text-[#94a3b8] lg:text-xl">{oneLineExplanation}</p>
          </div>
        </div>
      </section>

      {/* Bottom 6-Metric Projector Strip */}
      <footer className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Voice Authenticity
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#f8fafc] lg:text-3xl">
            {currentCall.voice_authenticity.score !== null
              ? `${currentCall.voice_authenticity.score.toFixed(0)}%`
              : 'N/A'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Speaker Match
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#f8fafc] lg:text-3xl">
            {currentCall.speaker_identity.score !== null
              ? `${currentCall.speaker_identity.score.toFixed(0)}%`
              : 'N/A'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Scam Risk
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#f8fafc] lg:text-3xl">
            {currentCall.scam_analysis.risk_score.toFixed(0)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Behavioral Pressure
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#f8fafc] lg:text-3xl">
            {currentCall.scam_analysis.behavioral_pressure_score.toFixed(0)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Challenge Liveness
          </div>
          <div className="mt-2">
            <StatusBadge
              label={tb.liveness_status}
              tone={
                tb.liveness_status === 'PASSED'
                  ? 'safe'
                  : tb.liveness_status === 'FAILED'
                    ? 'threat'
                    : 'caution'
              }
              size="md"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Bot Guard
          </div>
          <div className="mt-2">
            <StatusBadge
              label={botStatus}
              tone={
                botStatus === 'PAUSED BY GUARD'
                  ? 'threat'
                  : botStatus === 'SPEAKING'
                    ? 'safe'
                    : botStatus === 'TRANSFERRED TO HUMAN'
                      ? 'info'
                      : verdictTone(finalVerdict)
              }
              size="md"
            />
          </div>
        </div>
      </footer>

      <LiveChallengeModal />
    </div>
  );
}
