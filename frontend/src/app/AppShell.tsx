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
} from "lucide-react";
import { ModeBadge } from "../components/ui/ModeBadge";
import { Button } from "../components/ui/Button";
import { Banner } from "../components/ui/Banner";
import { copy } from "../copy";
import { useAnalysis } from "../context/AnalysisContext";

export const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentAnalysis, healthBanner } = useAnalysis();

  const getPageTitle = () => {
    if (location.pathname.startsWith("/reports")) return copy.reports.pageTitle;
    switch (location.pathname) {
      case "/":
      case "/analyze":
        return copy.navigation.analyze;
      case "/voiceprints":
        return copy.voiceprints.pageTitle;
      case "/usage":
        return copy.usage.pageTitle;
      case "/deployment":
        return copy.deployment.pageTitle;
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
    { to: "/analyze", label: copy.navigation.analyze, icon: <Radio className="w-5 h-5 shrink-0" /> },
    { to: "/voiceprints", label: copy.navigation.voiceprints, icon: <Users className="w-5 h-5 shrink-0" /> },
    { to: "/reports", label: copy.navigation.reports, icon: <FileText className="w-5 h-5 shrink-0" /> },
    { to: "/usage", label: copy.navigation.usage, icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
    { to: "/deployment", label: copy.navigation.deployment, icon: <Network className="w-5 h-5 shrink-0" /> },
  ];

  const currentMode = currentAnalysis?.mode || "DEMO";

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex">
      {/* Left Sidebar: 240px on wide screens, collapses to 64px icon rail on narrow screens */}
      <aside className="sticky top-0 h-screen w-16 md:w-[240px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between shrink-0 transition-all duration-200">
        <div>
          {/* Brand / Logo */}
          <div className="h-16 border-b border-[var(--border)] flex items-center px-4 md:px-5 gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--brand-navy)] text-white flex items-center justify-center font-bold text-[18px] shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="hidden md:block min-w-0">
              <span className="font-bold text-[18px] tracking-tight text-[var(--brand-navy)] block truncate">
                {copy.app.name}
              </span>
              <p className="text-[12px] text-[var(--text-muted)] leading-none mt-0.5 truncate">
                {copy.app.hackathonLabel}
              </p>
            </div>
          </div>

          {/* 4 Nav Items */}
          <nav className="p-2 md:p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors justify-center md:justify-start ${
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

        {/* Footer in Sidebar */}
        <div className="p-2 md:p-3 border-t border-[var(--border)] space-y-1">
          <NavLink
            to="/kit"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors justify-center md:justify-start ${
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

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-14 bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-[var(--text-primary)] truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="caption-text font-medium text-[var(--text-secondary)] hidden sm:inline">
              {copy.app.poweredBy}
            </span>
            <ModeBadge mode={currentMode} />
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

        {/* Main Content Area: Centred, max 1200px */}
        <main className="flex-1 p-4">
          <div className="max-w-[1200px] mx-auto w-full space-y-3">
            {healthBanner.backendUnavailable && (
              <Banner variant="warn">{copy.health.backendUnavailable}</Banner>
            )}
            {healthBanner.keyNotSet && (
              <Banner variant="warn">{copy.health.apiKeyNotSet}</Banner>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
