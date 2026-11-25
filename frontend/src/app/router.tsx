import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AnalyzePage } from "../pages/AnalyzePage";
import { VoiceprintsPage } from "../pages/VoiceprintsPage";
import { EnrollPage } from "../pages/EnrollPage";
import { UsagePage } from "../pages/UsagePage";
import { ReportsPage } from "../pages/ReportsPage";
import { ReportDetailPage } from "../pages/ReportDetailPage";
import { DeploymentPage } from "../pages/DeploymentPage";
import { StagePage } from "../pages/StagePage";
import { KitPage } from "../pages/KitPage";

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 20ft Projector Stage Mode (Full Screen) */}
      <Route path="/stage" element={<StagePage />} />

      {/* Main Console App Shell */}
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/analyze" replace />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="voiceprints" element={<VoiceprintsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:callId" element={<ReportDetailPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="deployment" element={<DeploymentPage />} />
        <Route path="enroll" element={<EnrollPage />} />
        <Route path="kit" element={<KitPage />} />
        <Route path="*" element={<Navigate to="/analyze" replace />} />
      </Route>
    </Routes>
  );
};
