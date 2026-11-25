import React, { useState } from "react";
import { ArrowRight, Shield, Database } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Banner } from "../../components/ui/Banner";
import { copy } from "../../copy";

type NodeTag = "PROPOSED" | "BUILT IN DEMO" | "FUTURE";

interface ArchNode {
  id: string;
  title: string;
  tag: NodeTag;
  input: string;
  output: string;
  responsibility: string;
}

const PIPELINE_NODES: ArchNode[] = [
  {
    id: "customer",
    title: "Customer call",
    tag: "PROPOSED",
    input: "Caller voice stream over PSTN / VoIP",
    output: "Raw telephony audio frames",
    responsibility: "Originating caller audio channel; untrusted external source.",
  },
  {
    id: "pbx",
    title: "Bank telephony / PBX",
    tag: "PROPOSED",
    input: "PSTN / SIP trunk session",
    output: "8kHz / 16kHz PCM or WAV media stream",
    responsibility: "Routes call audio to security sidecar; no PBX or Twilio connected in this demo.",
  },
  {
    id: "aegis-layer",
    title: "AEGIS audio security layer",
    tag: "BUILT IN DEMO",
    input: "Audio clip + claimed customer ID",
    output: "Normalized multipart payload & idempotency key",
    responsibility: "Holds API keys server-side, enforces consent checks, and caches repeat clips.",
  },
  {
    id: "engines",
    title: "Aletheia + Eidos + risk index",
    tag: "BUILT IN DEMO",
    input: "Validated WAV segment + enrolled voiceprint reference",
    output: "Synthetic likelihood, similarity (-1 to 1), and heuristic risk index",
    responsibility: "DetectifAI hosted API evaluates voice authenticity & identity (audio retained 30 days).",
  },
  {
    id: "decision",
    title: "Decision",
    tag: "BUILT IN DEMO",
    input: "Aletheia verdict, Eidos match, and challenge liveness status",
    output: "CONTINUE, STEP_UP, or END_CALL directive",
    responsibility: "Enforces policy precedence: failed liveness overrides prior scores.",
  },
  {
    id: "dashboard-guard",
    title: "Agent dashboard and Bot Guard",
    tag: "BUILT IN DEMO",
    input: "Final decision, risk index, and liveness state",
    output: "Operator controls, speech synthesis pause, and audit report",
    responsibility: "Displays signal-not-proof verdicts and pauses automated bot speech on high risk.",
  },
];

const REGISTRY_NODE: ArchNode = {
  id: "threat-registry",
  title: "Shared threat registry",
  tag: "FUTURE",
  input: "Anonymized synthetic vocoder signatures and confirmed replay patterns",
  output: "Cross-institution risk advisories",
  responsibility: "Planned consortium threat sharing without exposing raw customer voiceprints.",
};

export const ArchitectureDiagram: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<ArchNode>(PIPELINE_NODES[3]);

  const badgeVariant = (tag: NodeTag) =>
    tag === "BUILT IN DEMO" ? "success" : tag === "PROPOSED" ? "warning" : "info";

  const renderNodeButton = (node: ArchNode) => {
    const isSelected = selectedNode.id === node.id;
    return (
      <button
        key={node.id}
        type="button"
        onClick={() => setSelectedNode(node)}
        onFocus={() => setSelectedNode(node)}
        className={`text-left p-4 rounded-[12px] border transition-colors cursor-pointer min-w-[170px] flex-1 focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)] ${
          isSelected
            ? "bg-[var(--fill-subtle)] border-[var(--brand-steel)] ring-1 ring-[var(--brand-steel)]"
            : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--fill-subtle)]"
        }`}
      >
        <Badge variant={badgeVariant(node.tag)} size="sm" className="mb-2">
          {node.tag}
        </Badge>
        <p className="font-semibold text-[15px] text-[var(--text-primary)] leading-snug">
          {node.title}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <Banner variant="warn">{copy.deployment.proposedBanner}</Banner>

      {/* Main Horizontal Flow */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">Call Security Topology</h2>
          <span className="caption-text">{copy.deployment.retentionNote}</span>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 overflow-x-auto pb-2">
          {PIPELINE_NODES.map((node, idx) => (
            <React.Fragment key={node.id}>
              {renderNodeButton(node)}
              {idx < PIPELINE_NODES.length - 1 && (
                <ArrowRight className="w-5 h-5 text-[var(--text-muted)] shrink-0 self-center rotate-90 lg:rotate-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Separate Shared Threat Registry Node */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center gap-3">
          <Database className="w-5 h-5 text-[var(--brand-steel)] shrink-0" />
          <div className="max-w-xs w-full">{renderNodeButton(REGISTRY_NODE)}</div>
        </div>
      </Card>

      {/* Selected Node Inspection Panel */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--brand-steel)]" />
            <h3 className="section-title">{selectedNode.title}</h3>
          </div>
          <Badge variant={badgeVariant(selectedNode.tag)}>{selectedNode.tag}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px]">
          <div className="p-3 bg-[var(--fill-subtle)] rounded-lg border border-[var(--border)]">
            <span className="caption-text font-semibold block mb-1">
              {copy.deployment.inputLabel}
            </span>
            <p className="text-[var(--text-primary)]">{selectedNode.input}</p>
          </div>
          <div className="p-3 bg-[var(--fill-subtle)] rounded-lg border border-[var(--border)]">
            <span className="caption-text font-semibold block mb-1">
              {copy.deployment.outputLabel}
            </span>
            <p className="text-[var(--text-primary)]">{selectedNode.output}</p>
          </div>
          <div className="p-3 bg-[var(--fill-subtle)] rounded-lg border border-[var(--border)]">
            <span className="caption-text font-semibold block mb-1">
              {copy.deployment.responsibilityLabel}
            </span>
            <p className="text-[var(--text-primary)]">{selectedNode.responsibility}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
