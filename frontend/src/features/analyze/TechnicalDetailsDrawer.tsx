import React, { useState } from "react";
import { Copy, Check, Terminal, Shield, Hash } from "lucide-react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { ModeBadge } from "../../components/ui/ModeBadge";
import { copy } from "../../copy";
import type { CallSession } from "../../types";

export interface TechnicalDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  call: CallSession | null;
  rawUnexpectedPayload?: unknown;
}

export const TechnicalDetailsDrawer: React.FC<TechnicalDetailsDrawerProps> = ({
  isOpen,
  onClose,
  call,
  rawUnexpectedPayload,
}) => {
  const [copied, setCopied] = useState(false);

  if (!call && rawUnexpectedPayload === undefined) return null;

  const jsonContent = JSON.stringify(call ?? rawUnexpectedPayload, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(jsonContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={copy.technicalDetails.drawerTitle}
      subtitle={copy.technicalDetails.drawerSubtitle}
    >
      {call && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg">
            <span className="text-[14px] font-medium text-[var(--text-secondary)]">
              {copy.technicalDetails.mode}
            </span>
            <ModeBadge mode={call.execution_mode} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="caption-text font-medium">{copy.technicalDetails.callId}</span>
                <Hash className="w-4 h-4 text-[var(--brand-steel)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--text-primary)] mt-1 font-mono">
                {call.call_id}
              </p>
            </div>

            <div className="p-3.5 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="caption-text font-medium">{copy.technicalDetails.creditsSaved}</span>
                <Shield className="w-4 h-4 text-[var(--decision-continue-solid)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--decision-continue-solid)] mt-1">
                +{call.credits_saved} credits
              </p>
            </div>
          </div>

          <div className="p-4 border border-[var(--border)] rounded-lg space-y-2 bg-[var(--surface)] text-[14px]">
            <h4 className="font-semibold text-[15px] text-[var(--text-primary)]">
              Layer Operation & Latency Telemetry
            </h4>
            <p className="text-[var(--text-secondary)] font-mono">
              Aletheia op={call.voice_authenticity.operation_id || "none"} · {call.voice_authenticity.latency_ms ?? "—"} ms · {call.voice_authenticity.cost_credits ?? 0} cr
            </p>
            <p className="text-[var(--text-secondary)] font-mono">
              Eidos op={call.speaker_identity.operation_id || "none"} · {call.speaker_identity.latency_ms ?? "—"} ms · {call.speaker_identity.cost_credits ?? 0} cr
            </p>
            <p className="text-[var(--text-secondary)] font-mono">
              Script ({call.scam_analysis.engine_used}) · {call.scam_analysis.latency_ms ?? "—"} ms
            </p>
            <p className="text-[var(--text-secondary)] font-mono">
              Manipulation ({call.manipulation_analysis.model_version}) · {call.manipulation_analysis.latency_ms ?? "—"} ms
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]">
            <Terminal className="w-4 h-4 text-[var(--brand-steel)]" />
            <span>{copy.technicalDetails.rawPayload}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyJson}
            icon={copied ? <Check className="w-4 h-4 text-[var(--decision-continue-solid)]" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? copy.technicalDetails.copied : copy.technicalDetails.copyJson}
          </Button>
        </div>

        <pre className="p-4 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] text-[14px] font-mono text-[var(--text-primary)] overflow-x-auto max-h-96">
          {jsonContent}
        </pre>
      </div>
    </Drawer>
  );
};
