import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { Modal } from '../ui/Modal';
import { Tooltip } from '../ui/Tooltip';
import { NotificationPanel } from './NotificationPanel';

const MOBILE_NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/voiceprints', label: 'Voiceprints' },
  { to: '/reports', label: 'Reports' },
  { to: '/deploy', label: 'Deployment' },
  { to: '/stage', label: 'Stage Mode' },
];

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TopHeader() {
  const { health, currentCall, callsHistory, setAppMode, refreshAll, selectCall } = useAegis();
  const navigate = useNavigate();
  const mode = health?.app_mode ?? 'DEMO';

  const [callSeconds, setCallSeconds] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  // Live call duration timer resets whenever the active call changes
  useEffect(() => {
    setCallSeconds(0);
    if (!currentCall) return;
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentCall?.call_id]);

  const unreadAlerts = Math.max(
    0,
    callsHistory.filter((c) => c.trust_breakdown.final_decision !== 'SAFE').length - readCount,
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0a0f1e]/95 backdrop-blur">
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-5">
        {/* Left: Brand Identity (mobile + compact descriptor) */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/35 bg-[#111827] text-sky-400 lg:hidden">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-[#f8fafc] lg:hidden">
                AEGIS
              </span>
              <span className="text-sm font-semibold tracking-tight text-[#f8fafc] hidden lg:inline">
                AEGIS
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-xs tracking-wider text-sky-400">
                THE TRUST LAYER
              </span>
            </div>
            <p className="hidden text-[11px] text-[#94a3b8] sm:block">
              Banking Voice Authentication &amp; Real-Time Call Protection SOC
            </p>
          </div>
        </div>

        {/* Right: Call Timer, Provenance, Mode Toggle, Connection, Notifications, User Profile */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Current Call Timer */}
          <Tooltip content="Elapsed monitoring duration for active call session" position="bottom">
            <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#111827] px-2.5 py-1 font-mono text-xs tabular-nums text-[#f8fafc]">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span>{currentCall ? formatDuration(callSeconds) : '00:00'}</span>
            </div>
          </Tooltip>

          {currentCall && <ProvenanceBadge provenance={currentCall.overall_provenance} compact />}

          {/* DEMO / REAL Mode Switch */}
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-[#111827] p-0.5"
            role="group"
            aria-label="Analysis operating mode"
          >
            <button
              type="button"
              onClick={() => void setAppMode('DEMO')}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${mode === 'DEMO'
                ? 'bg-[#151e30] text-sky-300 ring-1 ring-sky-500/40'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
            >
              DEMO
            </button>
            <button
              type="button"
              onClick={() => void setAppMode('REAL')}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${mode === 'REAL'
                ? 'bg-[#22c55e]/15 text-[#22c55e] ring-1 ring-[#22c55e]/40'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
            >
              REAL
            </button>
          </div>

          {/* Connection Status */}
          <Tooltip content="Refresh backend API & AI readiness status" position="bottom">
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111827] px-2.5 py-1.5 text-xs text-[#94a3b8] hover:border-slate-700 hover:text-[#f8fafc]"
            >
              <Activity
                className={`h-3.5 w-3.5 ${health?.status === 'ok' ? 'text-[#22c55e]' : 'text-[#ef4444]'
                  }`}
              />
              <span className="hidden font-mono text-[11px] sm:inline">
                {health?.status === 'ok' ? 'ONLINE' : 'OFFLINE'}
              </span>
              <RefreshCw className="h-3 w-3 opacity-70" />
            </button>
          </Tooltip>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Open SOC alert notifications"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex items-center justify-center rounded-lg border border-slate-800 bg-[#111827] p-1.5 text-[#94a3b8] hover:border-slate-700 hover:text-[#f8fafc]"
          >
            <Bell className="h-4 w-4" />
            {unreadAlerts > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 font-mono text-[9px] font-bold text-white">
                {unreadAlerts}
              </span>
            )}
          </button>

          {/* SOC Operator Session Modal Trigger */}
          <button
            type="button"
            aria-label="Open SOC operator profile"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#111827] px-2.5 py-1 text-xs text-[#f8fafc] hover:border-slate-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 font-mono text-[10px] font-bold text-sky-300">
              SO
            </span>
            <span className="hidden font-medium md:inline">SOC Lead</span>
          </button>
        </div>

        <NotificationPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          calls={callsHistory}
          onSelectCall={(call) => {
            selectCall(call);
            navigate('/');
          }}
          onMarkAllRead={() =>
            setReadCount(callsHistory.filter((c) => c.trust_breakdown.final_decision !== 'SAFE').length)
          }
        />
      </div>

      {/* Compact mobile nav */}
      <div className="flex gap-1 overflow-x-auto border-t border-slate-800/80 px-4 py-1.5 lg:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium ${isActive ? 'bg-[#151e30] text-sky-300' : 'text-[#94a3b8]'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {mode === 'REAL' && health && (!health.detectifai_configured || !health.gemini_configured) && (
        <div className="border-t border-[#f59e0b]/25 bg-[#f59e0b]/8 px-5 py-1.5">
          <div className="flex items-center gap-2 text-xs text-[#f59e0b]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{health.real_mode_note}</span>
          </div>
        </div>
      )}

      {/* Operator Profile Modal */}
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="SOC Operator Session"
        subtitle="Banking Fraud & Call Authentication Desk"
      >
        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#151e30] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-[#f8fafc]">Sentinel SOC Operator (Tier-3)</div>
              <div className="font-mono text-[11px] text-[#94a3b8]">
                Role: Senior Fraud Analyst · Clearance: Wire &amp; Voice Override
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="rounded border border-slate-800 bg-[#0a0f1e] p-2.5">
              <div className="text-[#94a3b8]">Active Mode</div>
              <div className="mt-0.5 text-[#f8fafc]">{mode} MODE</div>
            </div>
            <div className="rounded border border-slate-800 bg-[#0a0f1e] p-2.5">
              <div className="text-[#94a3b8]">Voiceprints Stored</div>
              <div className="mt-0.5 text-[#f8fafc]">{health?.voiceprints_count ?? 0}</div>
            </div>
          </div>
        </div>
      </Modal>
    </header>
  );
}
