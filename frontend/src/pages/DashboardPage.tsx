import { useCallback, useEffect, useState } from 'react';
import { CallIntelligencePanel } from '../components/dashboard/CallIntelligencePanel';
import { CenterTrustPanel } from '../components/dashboard/CenterTrustPanel';
import { LiveCallModal } from '../components/dashboard/LiveCallModal';
import { LiveChallengeModal } from '../components/dashboard/LiveChallengeModal';
import { RiskAndGuardPanel } from '../components/dashboard/RiskAndGuardPanel';
import { ScenarioControlStrip } from '../components/dashboard/ScenarioControlStrip';
import { ActionButton } from '../components/ui/ActionButton';
import { EmptyState } from '../components/ui/EmptyState';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { useAegis } from '../hooks/useAegis';
import { callAudioController } from '../utils/audioEngine';

export function DashboardPage() {
  const {
    scenarios,
    currentCall,
    callStateStage,
    loading,
    runningScenarioId,
    runScenario,
    openLiveCallModal,
  } = useAegis();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audibleTelemetry, setAudibleTelemetry] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const stopAudio = useCallback(() => {
    callAudioController.stopSpeech();
    callAudioController.stopAcousticMonitor();
    setIsSpeaking(false);
    setActiveSegmentId(null);
  }, []);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const handlePlay = () => {
    if (!currentCall) return;
    setIsSpeaking(true);
    callAudioController.startAcousticMonitor(currentCall.audio_profile, audibleTelemetry);
    callAudioController.speakTranscript(
      currentCall.transcript,
      (id) => setActiveSegmentId(id),
      () => {
        callAudioController.stopAcousticMonitor();
        setIsSpeaking(false);
        setActiveSegmentId(null);
      },
    );
  };

  const handleToggleTelemetry = () => {
    const next = !audibleTelemetry;
    setAudibleTelemetry(next);
    if (isSpeaking && currentCall) {
      callAudioController.startAcousticMonitor(currentCall.audio_profile, next);
    }
  };

  return (
    <div className="space-y-4">
      <ScenarioControlStrip
        scenarios={scenarios}
        activeScenarioId={currentCall?.scenario_id ?? null}
        runningScenarioId={runningScenarioId}
        isSpeaking={isSpeaking}
        audibleTelemetry={audibleTelemetry}
        hasActiveCall={Boolean(currentCall)}
        onRunScenario={(id) => {
          stopAudio();
          void runScenario(id);
        }}
        onPlayCallAudio={handlePlay}
        onStopCallAudio={stopAudio}
        onToggleAudibleTelemetry={handleToggleTelemetry}
        onOpenLiveCall={() => {
          stopAudio();
          openLiveCallModal();
        }}
      />

      {currentCall ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* LEFT PANEL — CALL INTELLIGENCE */}
          <div className="lg:col-span-3">
            <CallIntelligencePanel call={currentCall} activeSegmentId={activeSegmentId} />
          </div>

          {/* CENTER PANEL — LIVE TRUST INTELLIGENCE */}
          <div className="lg:col-span-6">
            <CenterTrustPanel
              call={currentCall}
              callStateStage={callStateStage}
              isMonitoring={isSpeaking}
            />
          </div>

          {/* RIGHT PANEL — RISK AND GUARD */}
          <div className="lg:col-span-3">
            <RiskAndGuardPanel call={currentCall} />
          </div>
        </div>
      ) : (
        <EmptyState
          title="No Active Call Session"
          description="Select any demonstration scenario (S1–S4) above to inspect the three-panel AEGIS Trust Console."
          action={
            scenarios[0] ? (
              <ActionButton variant="primary" onClick={() => void runScenario(scenarios[0].id)}>
                Load Scenario S1
              </ActionButton>
            ) : undefined
          }
        />
      )}

      <LiveChallengeModal />
      <LiveCallModal />
    </div>
  );
}
