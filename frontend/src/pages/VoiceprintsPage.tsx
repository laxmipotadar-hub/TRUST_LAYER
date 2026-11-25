import React from "react";
import { useNavigate } from "react-router-dom";
import { VoiceprintList } from "../features/voiceprints/VoiceprintList";
import { useAnalysis } from "../context/AnalysisContext";

export const VoiceprintsPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshVoiceprints } = useAnalysis();

  return (
    <div className="space-y-6">
      <VoiceprintList
        onNavigateEnroll={() => navigate("/enroll")}
        onVoiceprintRevoked={() => refreshVoiceprints()}
      />
    </div>
  );
};
