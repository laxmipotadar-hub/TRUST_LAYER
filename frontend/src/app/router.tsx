import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AnalyzePage } from "../pages/AnalyzePage";
import { LiveDemoPage } from "../pages/LiveDemoPage";
import { IntelligencePage } from "../pages/IntelligencePage";
import { TrustScorePage } from "../pages/TrustScorePage";
import { VoiceprintsPage } from "../pages/VoiceprintsPage";
import { EnrollPage } from "../pages/EnrollPage";
import { UsagePage } from "../pages/UsagePage";
import { ReportsPage } from "../pages/ReportsPage";
import { ReportDetailPage } from "../pages/ReportDetailPage";
import { DeploymentPage } from "../pages/DeploymentPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StagePage } from "../pages/StagePage";
import { KitPage } from "../pages/KitPage";

export const AppRouter: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }
      if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (location.pathname !== "/stage") {
          navigate("/stage");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, location.pathname]);

  return (
    <Routes>
      {/* 20ft Projector Stage Mode (Full Screen) */}
      <Route path="/stage" element={<StagePage />} />

      {/* Main Console App Shell */}
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/analyze" replace />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="live-demo" element={<LiveDemoPage />} />
        <Route path="intelligence" element={<IntelligencePage />} />
        <Route path="trust-score" element={<TrustScorePage />} />
        <Route path="voiceprints" element={<VoiceprintsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportDetailPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="deployment" element={<DeploymentPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="enroll" element={<EnrollPage />} />
        <Route path="kit" element={<KitPage />} />
        <Route path="*" element={<Navigate to="/analyze" replace />} />
      </Route>
    </Routes>
  );
};
