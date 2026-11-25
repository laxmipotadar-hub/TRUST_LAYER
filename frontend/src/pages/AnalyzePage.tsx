import React from "react";
import { Radio } from "lucide-react";
import { useAnalysis } from "../context/AnalysisContext";
import { ClipBar } from "../features/analyze/ClipBar";
import { PipelineStrip } from "../features/analyze/PipelineStrip";
import { LayerCardsGrid } from "../features/analyze/LayerCardsGrid";
import { FusionCard } from "../features/analyze/FusionCard";
import { DecisionCard } from "../features/analyze/DecisionCard";
import { CallerCard } from "../features/analyze/CallerCard";
import { OperatorActionsCard } from "../features/analyze/OperatorActionsCard";
import { BotGuardPanel } from "../features/botguard/BotGuardPanel";
import { AlertsTimelineCard } from "../features/analyze/AlertsTimelineCard";
import { TechnicalDetailsDrawer } from "../features/analyze/TechnicalDetailsDrawer";
import { ChallengeModal } from "../features/challenge/ChallengeModal";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export const AnalyzePage: React.FC = () => {
  const {
    executionMode,
    currentCall,
    voiceprints,
    activeScenarioId,
    layerStatuses,
    isLoading,
    error,
    isLivenessModalOpen,
    isTechnicalDrawerOpen,
    setLivenessModalOpen,
    setTechnicalDrawerOpen,
    guardState,
    guardEnabled,
    guardThreshold,
    guardReason,
    speechSupported,
    setGuardEnabled,
    setGuardThreshold,
    startBotAction,
    resumeBotAction,
    runScenario,
    analyzeLiveAudio,
    executeCallAction,
    retryLastAnalysis,
    clearCurrentCall,
    applyUpdatedCall,
    resetError,
  } = useAnalysis();

  const handlePrimaryDecisionAction = () => {
    if (!currentCall) return;
    if (currentCall.decision === "STEP_UP" || currentCall.decision === "INCOMPLETE ANALYSIS") {
      setLivenessModalOpen(true);
    } else if (currentCall.decision === "ALLOW") {
      void executeCallAction("ALLOW", "Operator confirmed ALLOW action");
    } else {
      void executeCallAction("BLOCK_CALL", "Operator confirmed BLOCK action");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 w-full space-y-3">
        <ClipBar
          executionMode={executionMode}
          activeScenarioId={activeScenarioId}
          voiceprints={voiceprints}
          isLoading={isLoading}
          onSelectScenario={runScenario}
          onClearSession={clearCurrentCall}
          onAnalyzeAudio={analyzeLiveAudio}
        />

        {error && (
          <ErrorState
            message={error.message}
            onRetry={() => {
              resetError();
              if (executionMode !== "LIVE" && (activeScenarioId === "S1" || activeScenarioId === "S2" || activeScenarioId === "S3" || activeScenarioId === "S4")) {
                void runScenario(activeScenarioId);
              }
            }}
          />
        )}

        <PipelineStrip call={currentCall} layerStatuses={layerStatuses} isLoading={isLoading} />

        {isLoading ? (
          <Card className="!p-5 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-full" />
          </Card>
        ) : currentCall ? (
          <>
            <DecisionCard
              decision={currentCall.decision}
              band={currentCall.band}
              mode={currentCall.execution_mode}
              recommendedAction={currentCall.decision_reason || currentCall.trust_breakdown.recommended_action}
              livenessOverrideApplied={currentCall.trust_breakdown.liveness_override_applied}
              voiceCloneOverrideApplied={currentCall.trust_breakdown.voice_clone_override_applied}
              onPrimaryAction={handlePrimaryDecisionAction}
            />

            <FusionCard
              call={currentCall}
              onOpenTechnicalDetails={() => setTechnicalDrawerOpen(true)}
            />
          </>
        ) : !error ? (
          <EmptyState
            icon={<Radio className="w-8 h-8" />}
            title={
              executionMode === "LIVE"
                ? "Ready for LIVE Voice & Scam Analysis"
                : "No scenario or clip evaluated yet"
            }
            description={
              executionMode === "LIVE"
                ? "Record 16 kHz microphone audio or upload a WAV clip above to evaluate all 4 layers freshly against DetectifAI."
                : "Select S1–S4 above or upload audio to run the full 4-layer pipeline."
            }
          />
        ) : null}

        <LayerCardsGrid
          call={currentCall}
          statuses={layerStatuses}
          isLoading={isLoading}
          onRetryEidos={() => void retryLastAnalysis()}
        />
      </div>

      <aside className="w-full lg:w-[320px] shrink-0 space-y-3">
        <CallerCard call={currentCall} voiceprints={voiceprints} executionMode={executionMode} />

        <OperatorActionsCard
          decision={currentCall?.decision}
          guardState={guardState}
          disabled={isLoading || !currentCall}
          onAction={(act, note) => void executeCallAction(act, note)}
        />

        <BotGuardPanel
          guardState={guardState}
          guardEnabled={guardEnabled}
          threshold={guardThreshold}
          guardReason={guardReason}
          speechSupported={speechSupported}
          onToggleEnabled={(v) => void setGuardEnabled(v)}
          onChangeThreshold={(v) => void setGuardThreshold(v)}
          onStartBot={startBotAction}
          onTransferHuman={() => void executeCallAction("TRANSFER_TO_HUMAN", "Bot Guard transfer to human")}
          onResumeOperator={resumeBotAction}
        />

        <AlertsTimelineCard
          events={currentCall?.evidence_timeline || []}
          executionMode={executionMode}
        />
      </aside>

      <TechnicalDetailsDrawer
        isOpen={isTechnicalDrawerOpen}
        onClose={() => setTechnicalDrawerOpen(false)}
        call={currentCall}
        rawUnexpectedPayload={error?.rawPayload}
      />

      <ChallengeModal
        isOpen={isLivenessModalOpen}
        callId={currentCall?.call_id}
        customerId={currentCall?.claimed_customer_id}
        executionMode={executionMode}
        onClose={() => setLivenessModalOpen(false)}
        onComplete={(_resp, updatedCall) => {
          if (updatedCall) applyUpdatedCall(updatedCall);
        }}
      />
    </div>
  );
};
