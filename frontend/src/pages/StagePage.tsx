import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { ModeBadge } from "../components/ui/ModeBadge";
import { copy } from "../copy";
import { useAnalysis } from "../context/AnalysisContext";
import { DEMO_SCENARIO_LIST } from "../mocks/fixtures";
import { formatSimilarity, formatSyntheticLikelihood } from "../lib/format";
import { ChallengeModal } from "../features/challenge/ChallengeModal";
import { PhonePanel } from "../features/phone/PhonePanel";

export const StagePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    executionMode,
    currentCall,
    activeScenarioId,
    isLoading,
    runScenario,
    isLivenessModalOpen,
    setLivenessModalOpen,
    applyUpdatedCall,
    phoneDispatch,
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

  const effectiveDecision = currentCall?.decision || "STEP_UP";

  const bgToken =
    effectiveDecision === "ALLOW"
      ? "bg-[var(--decision-continue-solid)]"
      : effectiveDecision === "STEP_UP" || effectiveDecision === "INCOMPLETE ANALYSIS"
      ? "bg-[var(--decision-stepup-solid)]"
      : "bg-[var(--decision-endcall-solid)]";

  const verdictIcon =
    effectiveDecision === "ALLOW" ? (
      <CheckCircle2 className="w-24 h-24 text-white shrink-0" />
    ) : effectiveDecision === "STEP_UP" || effectiveDecision === "INCOMPLETE ANALYSIS" ? (
      <AlertTriangle className="w-24 h-24 text-white shrink-0" />
    ) : (
      <XCircle className="w-24 h-24 text-white shrink-0" />
    );

  return (
    <div
      className={`h-screen w-screen overflow-hidden text-white p-6 lg:p-8 flex flex-col justify-between transition-colors duration-200 ${bgToken}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/25 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              navigate("/analyze");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-[16px] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{copy.stage.exitButton}</span>
          </button>

          {executionMode !== "LIVE" && (
            <div className="flex items-center gap-2">
              {DEMO_SCENARIO_LIST.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void runScenario(sc.id as "S1" | "S2" | "S3" | "S4")}
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
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[18px] font-semibold text-white/95">{copy.app.footerPower}</span>
          <ModeBadge mode={currentCall?.execution_mode || executionMode} />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-center max-w-6xl w-full mx-auto px-4 py-4">
        <div className="flex flex-col justify-center items-center text-center space-y-6">
        {!currentCall ? (
          <div className="space-y-4">
            <p className="text-[36px] font-bold">{copy.stage.waitingForCall}</p>
            <p className="text-[20px] text-white/85">{copy.stage.selectCallInstruction}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {verdictIcon}
              <h1 className="text-[72px] sm:text-[96px] font-black tracking-tight leading-none uppercase">
                {effectiveDecision}
              </h1>
            </div>

            <p className="text-[24px] sm:text-[28px] font-semibold text-white/95 max-w-4xl leading-snug">
              {currentCall.trust_breakdown.recommended_action}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left bg-black/25 backdrop-blur-xs rounded-2xl p-5 border border-white/20">
              <div className="space-y-1">
                <span className="text-[14px] uppercase tracking-wider text-white/75 font-semibold">
                  L1 Aletheia
                </span>
                <p className="text-[18px] font-bold text-white">
                  {formatSyntheticLikelihood(currentCall.voice_authenticity.deepfake_probability)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[14px] uppercase tracking-wider text-white/75 font-semibold">
                  L2 Eidos
                </span>
                <p className="text-[18px] font-bold text-white">
                  {formatSimilarity(currentCall.speaker_identity.match_confidence)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[14px] uppercase tracking-wider text-white/75 font-semibold">
                  L3 Script Risk
                </span>
                <p className="text-[18px] font-bold text-white">
                  {currentCall.scam_analysis.risk_score !== null
                    ? `${currentCall.scam_analysis.risk_score.toFixed(1)} / 100`
                    : "Unavailable"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[14px] uppercase tracking-wider text-white/75 font-semibold">
                  L4 Manipulation & Fusion
                </span>
                <p className="text-[18px] font-bold text-white">
                  {currentCall.trust_score !== null ? `${currentCall.trust_score.toFixed(1)} (${currentCall.band})` : "INCOMPLETE"}
                </p>
              </div>
            </div>
          </>
        )}
        </div>
        <div className="w-full max-w-[360px] mx-auto">
          <PhonePanel stageEmbedded />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/25 pt-4 text-[16px] text-white/90 shrink-0">
        <span>{copy.stage.readoutHint}</span>
        {currentCall?.decision === "STEP_UP" && (
          <button
            type="button"
            onClick={() => {
              setLivenessModalOpen(true);
              phoneDispatch({
                type: "START_CHALLENGE",
                actor: "operator",
                phrase: "cobalt mango seven",
                expiresInSeconds: 20,
              });
            }}
            className="px-4 py-2 rounded-lg bg-white text-[var(--brand-navy)] font-bold cursor-pointer"
          >
            {copy.decisions.stepUp.actionLabel}
          </button>
        )}
      </div>

      <ChallengeModal
        isOpen={isLivenessModalOpen}
        callId={currentCall?.call_id}
        customerId={currentCall?.claimed_customer_id}
        executionMode={executionMode}
        onClose={() => setLivenessModalOpen(false)}
        onComplete={(resp, updatedCall) => {
          phoneDispatch({
            type: "CHALLENGE_RESULT",
            actor: "system",
            passed: resp.passed,
            incomplete: resp.liveness_status === "INCOMPLETE",
            note: resp.explanation,
          });
          if (updatedCall) applyUpdatedCall(updatedCall);
        }}
      />
    </div>
  );
};
