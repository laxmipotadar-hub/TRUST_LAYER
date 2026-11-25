import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { ModeBadge } from "../components/ui/ModeBadge";
import { copy } from "../copy";
import { useAnalysis } from "../context/AnalysisContext";
import { DEMO_SCENARIO_LIST } from "../mocks/fixtures";
import { formatSimilarity, formatSyntheticLikelihood } from "../lib/format";
import { ChallengeModal } from "../features/challenge/ChallengeModal";

export const StagePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentAnalysis,
    activeScenarioId,
    guardState,
    guardReason,
    isLoading,
    analyzeScenario,
    allowCall,
    runChallengeAction,
    endCallAction,
    isLivenessModalOpen,
    setLivenessModalOpen,
    handleLivenessOutcome,
  } = useAnalysis();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLivenessModalOpen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        navigate("/analyze");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, isLivenessModalOpen]);

  const effectiveDecision =
    currentAnalysis?.liveness.status === "failed"
      ? "END_CALL"
      : currentAnalysis?.decision || "STEP_UP";

  const bgToken =
    effectiveDecision === "CONTINUE"
      ? "bg-[var(--decision-continue-solid)]"
      : effectiveDecision === "STEP_UP"
      ? "bg-[var(--decision-stepup-solid)]"
      : "bg-[var(--decision-endcall-solid)]";

  const verdictIcon =
    effectiveDecision === "CONTINUE" ? (
      <CheckCircle2 className="w-24 h-24 text-white shrink-0" />
    ) : effectiveDecision === "STEP_UP" ? (
      <AlertTriangle className="w-24 h-24 text-white shrink-0" />
    ) : (
      <XCircle className="w-24 h-24 text-white shrink-0" />
    );

  const summarySentence =
    currentAnalysis?.liveness.status === "failed"
      ? copy.liveness.overrideLine
      : effectiveDecision === "CONTINUE"
      ? `${copy.decisions.continue.summary} ${copy.decisions.continue.mandatoryNotice}`
      : effectiveDecision === "STEP_UP"
      ? copy.decisions.stepUp.summary
      : copy.decisions.endCall.summary;

  const handleNextAction = () => {
    if (!currentAnalysis) return;
    if (effectiveDecision === "STEP_UP") runChallengeAction();
    else if (effectiveDecision === "CONTINUE") allowCall();
    else endCallAction();
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden text-white p-6 lg:p-8 flex flex-col justify-between transition-colors duration-200 ${bgToken}`}
    >
      {/* Top Bar: Exit + Scenarios S1..S4 + ModeBadge + DetectifAI attribution */}
      <div className="flex items-center justify-between gap-4 border-b border-white/25 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              }
              navigate("/analyze");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-[16px] cursor-pointer focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{copy.stage.exitButton}</span>
          </button>

          <div className="flex items-center gap-2">
            {DEMO_SCENARIO_LIST.map((sc) => (
              <button
                key={sc.id}
                type="button"
                disabled={isLoading}
                onClick={() => analyzeScenario(sc.id as "S1" | "S2" | "S3" | "S4")}
                className={`px-3 py-1.5 rounded-lg text-[16px] font-bold cursor-pointer border transition-colors ${
                  activeScenarioId === sc.id
                    ? "bg-white text-[var(--brand-navy)] border-white"
                    : "bg-white/15 text-white border-white/30 hover:bg-white/25"
                }`}
              >
                {sc.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[18px] font-semibold text-white/95">
            {copy.app.footerPower}
          </span>
          <div className="bg-white rounded-full px-1 py-0.5">
            <ModeBadge mode={currentAnalysis?.mode || "DEMO"} />
          </div>
        </div>
      </div>

      {/* Main Verdict: 96px + One Sentence + Next Action Button */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 my-auto py-4">
        <div className="flex items-center gap-6">
          {verdictIcon}
          <div className="space-y-2">
            <h1 className="text-[72px] xl:text-[96px] font-black tracking-tight leading-none text-white">
              {effectiveDecision}
            </h1>
            <p className="text-[28px] font-semibold leading-snug text-white max-w-4xl">
              {summarySentence}
            </p>
          </div>
        </div>

        {currentAnalysis && (
          <button
            type="button"
            onClick={handleNextAction}
            className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-white text-[var(--brand-navy)] hover:bg-white/90 font-bold text-[28px] leading-none shadow-lg cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>{currentAnalysis.action_label}</span>
            <ArrowRight className="w-7 h-7" />
          </button>
        )}
      </div>

      {/* Bottom 2x2 Readout Grid: All secondary text >= 28px, fits without scrolling */}
      {currentAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/25 pt-4 shrink-0">
          {/* Aletheia -> Eidos Checklist */}
          <div className="bg-black/20 rounded-xl p-4 space-y-1">
            <p className="text-[28px] font-bold leading-tight">
              Aletheia: {formatSyntheticLikelihood(currentAnalysis.aletheia.score)}
            </p>
            <p className="text-[28px] font-medium leading-tight text-white/90">
              Eidos:{" "}
              {currentAnalysis.eidos.status === "skipped"
                ? copy.checks.eidosSkippedAletheia
                : formatSimilarity(currentAnalysis.eidos.similarity)}
            </p>
          </div>

          {/* Risk Index + Liveness + Bot Guard */}
          <div className="bg-black/20 rounded-xl p-4 space-y-1">
            <p className="text-[28px] font-bold leading-tight">
              {copy.heuristics.title}: {currentAnalysis.trust_score.value} ({currentAnalysis.trust_score.band})
            </p>
            <p className="text-[28px] font-medium leading-tight text-white/90">
              Liveness: {currentAnalysis.liveness.status} • Bot Guard: {guardState} ({guardReason})
            </p>
          </div>
        </div>
      )}

      <ChallengeModal
        isOpen={isLivenessModalOpen}
        scenarioId={activeScenarioId}
        onClose={() => setLivenessModalOpen(false)}
        onOutcome={handleLivenessOutcome}
      />
    </div>
  );
};
