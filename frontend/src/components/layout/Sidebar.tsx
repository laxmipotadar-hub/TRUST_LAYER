import { NavLink } from 'react-router-dom';
import {
  FileText,
  Fingerprint,
  LayoutDashboard,
  Network,
  Presentation,
  ShieldCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/voiceprints', label: 'Voiceprint Library', icon: Fingerprint, end: false },
  { to: '/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/deploy', label: 'Deployment', icon: Network, end: false },
  { to: '/stage', label: 'Stage Mode', icon: Presentation, end: false },
];

export function Sidebar() {
  return (
    <aside
      aria-label="Primary Navigation"
      className="hidden w-56 shrink-0 flex-col border-r border-slate-800/90 bg-[#0d1324] lg:flex"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-800/90 px-4 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/35 bg-[#111827] text-sky-400">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-[#f8fafc]">AEGIS</div>
          <div className="font-mono text-[10px] tracking-widest text-sky-400">THE TRUST LAYER</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-2.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border border-sky-500/35 bg-[#151e30] text-sky-300'
                    : 'border border-transparent text-[#94a3b8] hover:bg-[#111827] hover:text-[#f8fafc]'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/90 px-4 py-3 text-[11px] text-[#94a3b8]">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          SOC Security Posture
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
          <span>4-Layer Trust Active</span>
        </div>
      </div>
    </aside>
  );
}
