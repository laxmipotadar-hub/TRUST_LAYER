import React from "react";
import { Radio } from "lucide-react";
import { useAnalysis } from "../context/AnalysisContext";
import { StepIndicator } from "../components/ui/StepIndicator";
import { ClipBar } from "../features/analyze/ClipBar";
import { PipelineStrip } from "../features/analyze/PipelineStrip";
import { TwoChecksCards } from "../features/analyze/TwoChecksCards";
import { DecisionCard } from "../features/analyze/DecisionCard";
import { HeuristicRiskRow } from "../features/analyze/HeuristicRiskRow";
import { CallerCard } from "../features/analyze/CallerCard";
import { OperatorActionsCard } from "../features/analyze/OperatorActionsCard";
import { BotGuardPanel } from "../features/botguard/BotGuardPanel";
import { AlertsTimelineCard } from "../features/analyze/AlertsTimelineCard";
import { TechnicalDetailsDrawer } from "../features/analyze/TechnicalDetailsDrawer";
import { ChallengeModal } from "../features/challenge/ChallengeModal";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { copy } from "../copy";

export const AnalyzePage: React.FC = () => {
  const {
    currentAnalysis,
    events,
    guardState,
    guardEnabled,
    guardThreshold,
    guardReason,
    speechSupported,
    voiceprints,
    callerMeta,
    activeScenarioId,
    isLoading,
    error,
    selectedStep,
    setSelectedStep,
    setGuardEnabled,
    setGuardThreshold,
    startBotAction,
    resumeBotAction,
    analyzeScenario,
    analyzeCustomAudio,
    isLivenessModalOpen,
    setLivenessModalOpen,
    isTechnicalDrawerOpen,
    setTechnicalDrawerOpen,
    handleLivenessOutcome,
    allowCall,
    runChallengeAction,
    pauseBotAction,
    transferToHumanAction,
    endCallAction,
  } = useAnalysis();

  const handlePrimaryDecisionAction = () => {
    if (!currentAnalysis) return;
    const effective =
      currentAnalysis.liveness.status === "failed" ? "END_CALL" : currentAnalysis.decision;

    if (effective === "STEP_UP") {
      runChallengeAction();
    } else if (effective === "CONTINUE") {
      allowCall();
    } else {
      endCallAction();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Main Column */}
      <div className="flex-1 min-w-0 w-full space-y-3">
        <StepIndicator
          currentStep={selectedStep}
          onSelectStep={(s) => setSelectedStep(s)}
          className="!py-2 !px-3"
        />

        <ClipBar
          activeScenarioId={activeScenarioId}
          voiceprints={voiceprints}
          isLoading={isLoading}
          onSelectScenario={analyzeScenario}
          onAnalyzeCustomAudio={analyzeCustomAudio}
        />

        {error && (
          <div className="space-y-2">
            <ErrorState
              message={error.message}
              onRetry={() => {
                if (activeScenarioId === "S2" || activeScenarioId === "S3" || activeScenarioId === "S4") {
                  analyzeScenario(activeScenarioId);
                } else {
                  analyzeScenario("S1");
                }
              }}
            />
            {error.rawPayload !== undefined && (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTechnicalDrawerOpen(true)}
                >
                  {copy.states.viewTechnicalDetails}
                </Button>
              </div>
            )}
          </div>
        )}

        <PipelineStrip analysis={currentAnalysis} isLoading={isLoading} />

        <TwoChecksCards
          aletheia={currentAnalysis?.aletheia}
          eidos={currentAnalysis?.eidos}
          isLoading={isLoading}
        />

        {isLoading ? (
          <Card className="!p-5 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-full" />
          </Card>
        ) : currentAnalysis ? (
          <>
            <DecisionCard
              decision={currentAnalysis.decision}
              mode={currentAnalysis.mode}
              livenessStatus={currentAnalysis.liveness.status}
              actionLabel={currentAnalysis.action_label}
              onPrimaryAction={handlePrimaryDecisionAction}
            />

            <HeuristicRiskRow
              trustScore={currentAnalysis.trust_score}
              decision={
                currentAnalysis.liveness.status === "failed"
                  ? "END_CALL"
                  : currentAnalysis.decision
              }
              livenessStatus={currentAnalysis.liveness.status}
              onOpenTechnicalDetails={() => setTechnicalDrawerOpen(true)}
            />
          </>
        ) : !error ? (
          <EmptyState
            icon={<Radio className="w-8 h-8" />}
            title={copy.states.emptyVerdictTitle}
            description={copy.states.emptyVerdictSubtitle}
            actionLabel={copy.states.emptyAction}
            onAction={() => analyzeScenario("S1")}
          />
        ) : null}
      </div>

      {/* Right Rail: 320px, scrolls inside itself */}
      <aside className="w-full lg:w-[320px] shrink-0 space-y-3 lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:pr-1">
        <CallerCard callerMeta={callerMeta} eidos={currentAnalysis?.eidos} />

        <OperatorActionsCard
          decision={
            currentAnalysis?.liveness.status === "failed"
              ? "END_CALL"
              : currentAnalysis?.decision
          }
          guardState={guardState}
          disabled={isLoading || !currentAnalysis}
          onAllow={allowCall}
          onRunChallenge={runChallengeAction}
          onPauseBot={pauseBotAction}
          onTransferHuman={transferToHumanAction}
          onEndCall={endCallAction}
        />

        <BotGuardPanel
          guardState={guardState}
          guardEnabled={guardEnabled}
          threshold={guardThreshold}
          guardReason={guardReason}
          speechSupported={speechSupported}
          onToggleEnabled={setGuardEnabled}
          onChangeThreshold={setGuardThreshold}
          onStartBot={startBotAction}
          onTransferHuman={transferToHumanAction}
          onResumeOperator={resumeBotAction}
        />

        <AlertsTimelineCard events={events} />
      </aside>

      <TechnicalDetailsDrawer
        isOpen={isTechnicalDrawerOpen}
        onClose={() => setTechnicalDrawerOpen(false)}
        analysis={currentAnalysis}
        rawUnexpectedPayload={error?.rawPayload}
      />

      <ChallengeModal
        isOpen={isLivenessModalOpen}
        scenarioId={activeScenarioId}
        onClose={() => setLivenessModalOpen(false)}
        onOutcome={handleLivenessOutcome}
      />
    </div>
  );
};
