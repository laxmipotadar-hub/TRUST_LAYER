import React, { useState } from "react";
import { Copy, Check, Terminal, Shield, Hash } from "lucide-react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { ModeBadge } from "../../components/ui/ModeBadge";
import { Tooltip } from "../../components/ui/Tooltip";
import { copy } from "../../copy";
import type { AnalyzeResponse } from "../../types";

export interface TechnicalDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalyzeResponse | null;
  rawUnexpectedPayload?: unknown;
}

export const TechnicalDetailsDrawer: React.FC<TechnicalDetailsDrawerProps> = ({
  isOpen,
  onClose,
  analysis,
  rawUnexpectedPayload,
}) => {
  const [copied, setCopied] = useState(false);

  if (!analysis && rawUnexpectedPayload === undefined) return null;

  const jsonContent = JSON.stringify(
    analysis ?? rawUnexpectedPayload,
    null,
    2
  );

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonContent);
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
      {analysis && (
        <>
          <div className="flex items-center justify-between p-3 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg">
            <span className="text-[14px] font-medium text-[var(--text-secondary)]">
              {copy.technicalDetails.mode}
            </span>
            <ModeBadge mode={analysis.mode} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="caption-text font-medium">{copy.technicalDetails.callId}</span>
                <Hash className="w-4 h-4 text-[var(--brand-steel)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--text-primary)] mt-1 font-mono">
                {analysis.call_id}
              </p>
            </div>

            <div className="p-3.5 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="caption-text font-medium">{copy.technicalDetails.creditsSaved}</span>
                <Shield className="w-4 h-4 text-[var(--decision-continue-solid)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--decision-continue-solid)] mt-1">
                +{analysis.credits_saved} credits
              </p>
            </div>
          </div>

          <div className="p-4 border border-[var(--border)] rounded-lg space-y-2 bg-[var(--surface)]">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[15px] text-[var(--text-primary)]">
                Aletheia Operation Telemetry
              </h4>
              <Tooltip content={copy.tooltips.operationId} />
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {copy.technicalDetails.operationId}:{" "}
              <span className="font-mono">{analysis.aletheia.operation_id}</span>
            </p>
            <p className="text-[14px] text-[var(--text-secondary)]">
              Cost: {analysis.aletheia.cost_credits} credits • Status: {analysis.aletheia.status}
            </p>
          </div>

          <div className="p-4 border border-[var(--border)] rounded-lg space-y-2 bg-[var(--surface)]">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[15px] text-[var(--text-primary)]">
                Eidos Biometric Telemetry
              </h4>
              <Tooltip content={copy.tooltips.similarity} />
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {copy.technicalDetails.operationId}:{" "}
              <span className="font-mono">
                {analysis.eidos.operation_id || copy.states.unavailable}
              </span>
            </p>
            <p className="text-[14px] text-[var(--text-secondary)]">
              Cost: {analysis.eidos.cost_credits ?? 0} credits • Status: {analysis.eidos.status}
            </p>
            {analysis.eidos.skip_reason && (
              <p className="text-[14px] text-[var(--decision-stepup-text)]">
                {copy.technicalDetails.skipReason}: {analysis.eidos.skip_reason}
              </p>
            )}
          </div>
        </>
      )}

      {/* Raw JSON View */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--brand-steel)]" />
            {copy.technicalDetails.rawPayload}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyJson}
            icon={copied ? <Check className="w-4 h-4 text-[var(--decision-continue-solid)]" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? copy.technicalDetails.copied : copy.technicalDetails.copyJson}
          </Button>
        </div>

        <pre className="p-4 bg-[var(--fill-subtle)] border border-[var(--border)] rounded-lg text-[14px] font-mono text-[var(--text-primary)] overflow-x-auto max-h-72">
          {jsonContent}
        </pre>
      </div>
    </Drawer>
  );
};
