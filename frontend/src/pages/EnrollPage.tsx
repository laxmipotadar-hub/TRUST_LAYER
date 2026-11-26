import React from "react";
import { useNavigate } from "react-router-dom";
import { EnrollmentForm } from "../features/enroll/EnrollmentForm";
import { useAnalysis } from "../context/AnalysisContext";

export const EnrollPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshVoiceprints, refreshSystem } = useAnalysis();

  return (
    <div className="space-y-6">
      <EnrollmentForm
        onSuccess={() => {
          void Promise.all([refreshVoiceprints(), refreshSystem()]);
        }}
        onNavigateList={() => navigate("/voiceprints")}
      />
    </div>
  );
};
