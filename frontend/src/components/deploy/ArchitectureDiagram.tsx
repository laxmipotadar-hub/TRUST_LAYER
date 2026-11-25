import { useState } from 'react';
import {
  ArrowDown,
  Cpu,
  Gauge,
  LayoutDashboard,
  PhoneCall,
  Server,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { AlertCard } from '../ui/AlertCard';
import { StatusBadge } from '../ui/StatusBadge';

interface ArchNode {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof PhoneCall;
  role: string;
  integrationPoint: string;
  securityControls: string;
}

const ARCHITECTURE_NODES: ArchNode[] = [
  {
    id: 'customer-call',
    title: 'CUSTOMER CALL',
    subtitle: 'Inbound PSTN / Mobile / VoIP Audio',
    icon: PhoneCall,
    role: 'Initiates inbound banking call or high-value wire/account support request.',
    integrationPoint: 'Carrier SIP trunk or WebRTC customer voice channel.',
    securityControls: 'Zero trust assumed at ingress; caller claims identity but is unverified.',
  },
  {
    id: 'bank-pbx',
    title: 'BANK TELEPHONY / PBX',
    subtitle: 'SIP SBC / Twilio Media Streams Fork',
    icon: Server,
    role: 'Receives the customer call and passively forks a copy of the RTP/WebSocket audio stream to AEGIS without blocking audio routing.',
    integrationPoint: 'SIPREC session border controller (Avaya/Cisco/Genesys) or Twilio <Stream> WebSocket.',
    securityControls: 'TLS 1.3 + SRTP transport encryption; out-of-band webhook control.',
  },
  {
    id: 'aegis-layer',
    title: 'AEGIS SECURITY LAYER',
    subtitle: 'FastAPI Orchestration & Sliding-Window Buffer',
    icon: Shield,
    role: 'Buffers 4–5 second audio chunks in memory, manages response caching, and orchestrates AI pipelines without exposing keys.',
    integrationPoint: 'Backend REST / WebSocket ingestion service isolated inside bank VPC.',
    securityControls: 'Credentials kept strictly server-side; raw audio never persisted unnecessarily.',
  },
  {
    id: 'ai-engines',
    title: 'ALETHEIA + EIDOS + RISK ENGINE',
    subtitle: 'Deepfake · Speaker Match · Scam & Pressure NLP',
    icon: Cpu,
    role: 'Evaluates synthetic speech (Aletheia), speaker similarity (Eidos), and social-engineering/coercion scripts (Gemini / deterministic fallback).',
    integrationPoint: 'HTTPS Bearer API calls to DetectifAI & Gemini with response caching and circuit breakers.',
    securityControls: 'Honest INCOMPLETE ANALYSIS state if required real-time models fail.',
  },
  {
    id: 'trust-score',
    title: 'COMPOSITE TRUST SCORE',
    subtitle: '35% Voice · 30% Identity · 20% Scam · 15% Behavioral',
    icon: Gauge,
    role: 'Computes the explainable 0–100 score and enforces Challenge Liveness overrides so replayed recordings cannot pass as SAFE.',
    integrationPoint: 'Deterministic Python scoring engine (`services/trust_engine.py`).',
    securityControls: 'Mathematical score preserved separately from liveness-enforced disposition.',
  },
  {
    id: 'bot-agent',
    title: 'BOT GUARD / BANK AGENT DASHBOARD',
    subtitle: 'Real-Time SOC Console & Automated IVR Guard',
    icon: LayoutDashboard,
    role: 'Streams live alerts, transcript highlights, and automatically silences automated voice bots when Trust Score crosses threshold.',
    integrationPoint: 'React SOC workstation + telephony pause/interrupt webhook.',
    securityControls: 'Explicit operator resume lock after Bot Guard activation.',
  },
  {
    id: 'disposition',
    title: 'ALLOW / CHALLENGE / BLOCK / HUMAN TAKEOVER',
    subtitle: 'Final Enforcement & Forensic Audit Log',
    icon: ShieldCheck,
    role: 'Executes final banking disposition: allow servicing, trigger dynamic Challenge Liveness, block call, or warm-transfer to human fraud officer.',
    integrationPoint: 'Core banking step-up auth API, SIEM event sink, and Post-Call Report archive.',
    securityControls: 'Immutable audit trail and anonymized Community Threat Registry submission.',
  },
];

const CONSIDERATIONS = [
  {
    title: 'SIP / PBX Integration Point',
    detail: 'Passive SIPREC media forking from enterprise SBCs (Cisco, Avaya, Genesys) avoids adding inline call jitter.',
  },
  {
    title: 'Twilio-Style Telephony Integration',
    detail: 'Supports Programmable Voice <Start><Stream> WebSocket audio chunks plus webhook-driven call hold/transfer.',
  },
  {
    title: 'Secure Audio Streaming',
    detail: 'Audio frames travel over TLS/SRTP and are hashed/evaluated ephemerally in memory without disk retention.',
  },
  {
    title: 'Backend API Communication',
    detail: 'DetectifAI and Gemini API keys reside strictly in backend environment config and are never sent to browsers.',
  },
  {
    title: 'Bank Agent Dashboard',
    detail: 'Three-panel React SOC interface surfaces caller telemetry, explainable formulas, and 5-second evidence chunks.',
  },
  {
    title: 'Security Event Logging',
    detail: 'Every call disposition, operator action, and Human Takeover is recorded in structured JSON reports ready for SIEM export.',
  },
  {
    title: 'Human Escalation',
    detail: 'Bot Guard suspends automated speech in <1s and routes context + forensic brief to a Tier-3 fraud specialist.',
  },
];

export function ArchitectureDiagram() {
  const [selectedId, setSelectedId] = useState<string>(ARCHITECTURE_NODES[2].id);
  const selectedNode =
    ARCHITECTURE_NODES.find((n) => n.id === selectedId) ?? ARCHITECTURE_NODES[0];

  return (
    <section className="space-y-4">
      <AlertCard
        tone="info"
        title="Proposed Banking Integration Architecture (Blueprint)"
        description="Reference enterprise deployment topology showing how AEGIS integrates into bank telephony. This demonstration environment is NOT connected to a live bank PBX."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Interactive Vertical Flow Pipeline */}
        <div className="rounded-xl border border-slate-800/90 bg-[#111827] p-4 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Interactive Architecture Pipeline (Click node to inspect)
            </h3>
            <StatusBadge label="PROPOSED BLUEPRINT" tone="info" />
          </div>

          <div className="space-y-1.5">
            {ARCHITECTURE_NODES.map((node, index) => {
              const Icon = node.icon;
              const isSelected = node.id === selectedNode.id;
              return (
                <div key={node.id} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-sky-500/60 bg-[#151e30] ring-1 ring-sky-500/30'
                        : 'border-slate-800 bg-[#151e30]/55 hover:border-slate-700 hover:bg-[#151e30]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-[#0a0f1e] text-sky-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-[#f8fafc]">
                          {node.title}
                        </div>
                        <div className="text-[11px] text-[#94a3b8]">{node.subtitle}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-sky-400">
                      0{index + 1}
                    </span>
                  </button>

                  {index < ARCHITECTURE_NODES.length - 1 && (
                    <ArrowDown className="my-0.5 h-3.5 w-3.5 text-slate-600" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Node Explanation + Deployment Considerations */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-sky-500/30 bg-[#111827] p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
              Selected Component Specification
            </div>
            <h3 className="mt-1 font-mono text-sm font-bold text-[#f8fafc]">
              {selectedNode.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#f8fafc]">{selectedNode.role}</p>

            <div className="mt-3 space-y-2 border-t border-slate-800 pt-3 text-xs">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#94a3b8]">
                  Integration Interface:
                </span>
                <p className="mt-0.5 text-[#f8fafc]">{selectedNode.integrationPoint}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-[#94a3b8]">
                  Security Boundary:
                </span>
                <p className="mt-0.5 text-[#94a3b8]">{selectedNode.securityControls}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Deployment Considerations
            </h3>
            <div className="space-y-2">
              {CONSIDERATIONS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-slate-800 bg-[#151e30]/70 px-3 py-2"
                >
                  <div className="text-xs font-semibold text-[#f8fafc]">{item.title}</div>
                  <p className="mt-0.5 text-[11px] text-[#94a3b8]">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
