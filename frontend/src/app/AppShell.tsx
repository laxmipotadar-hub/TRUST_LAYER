import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Radio,
  Users,
  FileText,
  BarChart3,
  Network,
  Tv,
  Layers,
  Mic,
  FileSearch,
  Sliders,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Banner } from "../components/ui/Banner";
import { copy } from "../copy";
import { useAnalysis } from "../context/AnalysisContext";
import type { ExecutionMode } from "../types";

export const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { executionMode, setExecutionMode, health, credits, backendOffline, toast, dismissToast } = useAnalysis();

  const getPageTitle = () => {
    if (location.pathname.startsWith("/reports")) return copy.reports.pageTitle;
    switch (location.pathname) {
      case "/":
      case "/analyze":
        return copy.navigation.analyze;
      case "/live-demo":
        return copy.navigation.liveDemo;
      case "/intelligence":
        return copy.navigation.intelligence;
      case "/trust-score":
        return copy.navigation.trustScore;
      case "/voiceprints":
        return copy.voiceprints.pageTitle;
      case "/usage":
        return copy.usage.pageTitle;
      case "/deployment":
        return copy.deployment.pageTitle;
      case "/settings":
        return copy.navigation.settings;
      case "/enroll":
        return copy.enroll.pageTitle;
      case "/stage":
        return copy.stage.pageTitle;
      case "/kit":
        return copy.navigation.componentKit;
      default:
        return copy.app.name;
    }
  };

  const navItems = [
    { to: "/live-demo", label: copy.navigation.liveDemo, icon: <Mic className="w-5 h-5 shrink-0" /> },
    { to: "/analyze", label: copy.navigation.analyze, icon: <Radio className="w-5 h-5 shrink-0" /> },
    { to: "/intelligence", label: copy.navigation.intelligence, icon: <FileSearch className="w-5 h-5 shrink-0" /> },
    { to: "/trust-score", label: copy.navigation.trustScore, icon: <Sliders className="w-5 h-5 shrink-0" /> },
    { to: "/voiceprints", label: copy.navigation.voiceprints, icon: <Users className="w-5 h-5 shrink-0" /> },
    { to: "/reports", label: copy.navigation.reports, icon: <FileText className="w-5 h-5 shrink-0" /> },
    { to: "/usage", label: copy.navigation.usage, icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
    { to: "/deployment", label: copy.navigation.deployment, icon: <Network className="w-5 h-5 shrink-0" /> },
    { to: "/settings", label: copy.navigation.settings, icon: <Settings className="w-5 h-5 shrink-0" /> },
  ];

  const modes: ExecutionMode[] = ["LIVE", "CACHED", "DEMO"];

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex">
      <aside className="sticky top-0 h-screen w-16 md:w-[244px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between shrink-0 transition-all duration-200">
        <div className="overflow-y-auto">
          <div className="h-16 border-b border-[var(--border)] flex items-center px-4 md:px-5 gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--brand-navy)] text-white flex items-center justify-center font-bold text-[18px] shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="hidden md:block min-w-0">
              <span className="font-bold text-[18px] tracking-tight text-[var(--brand-navy)] block truncate">
                {copy.app.name}
              </span>
              <p className="text-[14px] text-[var(--text-muted)] leading-none mt-0.5 truncate">
                {copy.app.hackathonLabel}
              </p>
            </div>
          </div>

          <nav className="p-2 md:p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors justify-center md:justify-start ${
                    isActive
                      ? "bg-[var(--fill-subtle)] text-[var(--brand-steel)] font-semibold border-l-0 md:border-l-4 border-[var(--brand-steel)] md:pl-2.5"
                      : "text-[var(--text-secondary)] hover:bg-[var(--fill-subtle)] hover:text-[var(--text-primary)]"
                  }`
                }
                title={item.label}
              >
                {item.icon}
                <span className="hidden md:inline truncate">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-2 md:p-3 border-t border-[var(--border)] space-y-1">
          <NavLink
            to="/kit"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors justify-center md:justify-start ${
                isActive
                  ? "bg-[var(--fill-subtle)] text-[var(--brand-steel)] font-semibold"
                  : "text-[var(--text-muted)] hover:bg-[var(--fill-subtle)] hover:text-[var(--text-primary)]"
              }`
            }
            title={copy.navigation.componentKit}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline truncate">{copy.navigation.componentKit}</span>
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-[var(--text-primary)] truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {credits?.configured && credits.available !== null && (
              <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--fill-subtle)] border border-[var(--border)] text-[14px] font-mono font-semibold text-[var(--text-primary)]">
                {credits.available.toLocaleString()} credits
              </span>
            )}

            <div
              role="group"
              aria-label="Execution mode switch"
              className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] p-0.5"
            >
              {modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => void setExecutionMode(m)}
                  className={`px-2.5 py-1 rounded-md text-[14px] font-semibold transition-colors cursor-pointer ${
                    executionMode === m
                      ? m === "DEMO"
                        ? "bg-[var(--mode-demo-bg)] text-[var(--mode-demo-text)]"
                        : m === "CACHED"
                        ? "bg-white text-[var(--brand-steel)] shadow-xs"
                        : "bg-[var(--brand-navy)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                document.documentElement.requestFullscreen?.().catch(() => {});
                navigate("/stage");
              }}
              icon={<Tv className="w-4 h-4 text-[var(--brand-steel)]" />}
            >
              <span className="hidden md:inline">{copy.navigation.stage}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4">
          <div className="max-w-[1200px] mx-auto w-full space-y-3">
            {backendOffline && (
              <Banner variant="error">
                Backend connection lost — scoring paused. Check that FastAPI is running on port 8000.
              </Banner>
            )}
            {!backendOffline && health && !health.detectifai_configured && executionMode === "LIVE" && (
              <Banner variant="warn">
                DetectifAI API key is NOT SET on the backend server. Configure keys in{" "}
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="underline font-bold cursor-pointer"
                >
                  Settings
                </button>{" "}
                before running LIVE microphone analysis.
              </Banner>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border p-4 shadow-lg flex items-start gap-3 ${
            toast.variant === "success"
              ? "bg-[var(--decision-continue-tint)] border-[var(--decision-continue-border)] text-[var(--decision-continue-text)]"
              : toast.variant === "error"
              ? "bg-[var(--decision-endcall-tint)] border-[var(--decision-endcall-border)] text-[var(--decision-endcall-text)]"
              : toast.variant === "warning"
              ? "bg-[var(--decision-stepup-tint)] border-[var(--decision-stepup-border)] text-[var(--decision-stepup-text)]"
              : "bg-[var(--surface)] border-[var(--brand-steel)] text-[var(--text-primary)]"
          }`}
        >
          {toast.variant === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : toast.variant === "error" || toast.variant === "warning" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-[var(--brand-steel)]" />
          )}
          <div className="min-w-0 flex-1 text-[14px]">
            <p className="font-bold">{toast.title}</p>
            <p className="opacity-90">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Close notification"
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
