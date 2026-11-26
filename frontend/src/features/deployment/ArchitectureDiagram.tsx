import React from "react";
import { PhoneIncoming, Server, Cpu, ShieldCheck, Headphones, ArrowRight, Bot } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";

export const ArchitectureDiagram: React.FC = () => {
  const nodes = [
    {
      icon: PhoneIncoming,
      title: "1. Inbound Customer Call",
      desc: "SIP / PSTN / WebRTC caller audio arrives with claimed account ID.",
      tag: "PROPOSED",
      variant: "neutral" as const,
    },
    {
      icon: Server,
      title: "2. Bank Telephony / PBX",
      desc: "Session border controller forks real-time 16 kHz mono PCM stream.",
      tag: "PROPOSED",
      variant: "neutral" as const,
    },
    {
      icon: Cpu,
      title: "3. AEGIS Audio & WS Gateway",
      desc: "FastAPI WebSocket & AudioWorklet ingest, quality gate, & live ASR.",
      tag: "LIVE",
      variant: "info" as const,
    },
    {
      icon: ShieldCheck,
      title: "4. L1–L4 Signal Pipeline",
      desc: "L1 Aletheia (deepfake) + L2 Eidos (voiceprint) + L3 Script + L4 Manipulation.",
      tag: "LIVE",
      variant: "success" as const,
    },
    {
      icon: Bot,
      title: "5. Trust Fusion & Bot Guard",
      desc: "Configurable weighted fusion, EMA smoothing, overrides & challenge liveness.",
      tag: "LIVE",
      variant: "success" as const,
    },
    {
      icon: Headphones,
      title: "6. Branch / SOC Agent",
      desc: "Receives ALLOW / STEP_UP / BLOCK decision, audit report & takeover handoff.",
      tag: "LIVE / PROPOSED",
      variant: "info" as const,
    },
  ];

  return (
    <Card className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">AEGIS Deployment Architecture</h1>
        <p className="body-text">
          End-to-end banking fraud-defense topology mapping implemented local/cloud modules versus
          proposed enterprise telephony integration.
        </p>
      </div>

      <Banner variant="warn" title="Proposed Integration Boundary">
        Nodes 1 and 2 (carrier SIP / Bank PBX) represent proposed enterprise telephony integration
        and are not connected to a live bank PBX in this console. Nodes 3 through 5 execute live
        in this runtime against real DetectifAI & Groq Whisper + LLM APIs.
      </Banner>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-stretch">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          return (
            <div key={node.title} className="relative flex flex-col">
              <div className="flex-1 p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-9 h-9 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-steel)]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={node.variant}>{node.tag}</Badge>
                  </div>
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {node.title}
                  </h3>
                  <p className="caption-text leading-relaxed">{node.desc}</p>
                </div>
              </div>
              {idx < nodes.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[var(--surface)] border border-[var(--border)] items-center justify-center text-[var(--brand-steel)]">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
