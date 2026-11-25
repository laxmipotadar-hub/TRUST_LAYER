import React, { useState, useEffect, useCallback } from "react";
import { Shield, Sparkles, Database, CheckCircle2, Copy, Check, RefreshCw } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { ModeBadge } from "../../components/ui/ModeBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { Tooltip } from "../../components/ui/Tooltip";
import { copy } from "../../copy";
import { aegisApi } from "../../lib/api";
import { formatDate } from "../../lib/format";
import type { ApiError, UsageResponse } from "../../types";

export const UsageDashboard: React.FC = () => {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await aegisApi.getUsage();
      setUsage(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr?.message || copy.states.errorTitle);
      setUsage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handleCopyOpId = (opId: string) => {
    navigator.clipboard?.writeText(opId);
    setCopiedId(opId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRerunSameClip = async () => {
    setIsRerunning(true);
    try {
      // Run S1; if first time in session, run a second time so cache hit triggers
      const first = await aegisApi.analyzeCall({ scenario_id: "S1" });
      if (first.mode !== "CACHED") {
        await aegisApi.analyzeCall({ scenario_id: "S1" });
      }
      const updated = await aegisApi.getUsage();
      setUsage(updated);
      if (updated.operations.length > 0) {
        setHighlightId(updated.operations[0].id);
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsRerunning(false);
    }
  };

  const creditBalanceDisplay =
    errorMsg || usage?.credit_balance === null || usage?.credit_balance === undefined
      ? copy.states.unavailable
      : usage.credit_balance.toLocaleString();

  const providerCallsCount = usage
    ? usage.aletheia_calls + usage.eidos_calls
    : copy.states.unavailable;

  return (
    <div className="space-y-6">
      {errorMsg && <ErrorState message={errorMsg} onRetry={loadUsage} />}

      {/* Four Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">{copy.usage.creditBalance}</span>
            <Database className="w-5 h-5 text-[var(--brand-navy)]" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-[28px] font-extrabold text-[var(--text-primary)]">
              {creditBalanceDisplay}
            </p>
          )}
          <p className="caption-text">{copy.usage.reportedByDetectifAI}</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">{copy.usage.providerCalls}</span>
            <Shield className="w-5 h-5 text-[var(--brand-steel)]" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-[28px] font-extrabold text-[var(--text-primary)]">
              {providerCallsCount}
            </p>
          )}
          <p className="caption-text">Aletheia + Eidos</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">{copy.usage.cacheHits}</span>
            <CheckCircle2 className="w-5 h-5 text-[var(--brand-steel)]" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-[28px] font-extrabold text-[var(--text-primary)]">
              {usage ? usage.cache_hits : copy.states.unavailable}
            </p>
          )}
          <p className="caption-text">Idempotent repeats</p>
        </Card>

        <Card className="space-y-1.5 bg-[var(--decision-continue-tint)] border-[var(--decision-continue-border)]">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium text-[var(--decision-continue-text)]">
              {copy.usage.creditsSaved}
            </span>
            <Sparkles className="w-5 h-5 text-[var(--decision-continue-solid)]" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-[28px] font-extrabold text-[var(--decision-continue-solid)]">
              {usage ? `+${usage.total_credits_saved}` : copy.states.unavailable}
            </p>
          )}
          <p className="caption-text text-[var(--decision-continue-text)]">
            {copy.usage.calculatedLocally}
          </p>
        </Card>
      </div>

      {/* Ledger Table + Re-run same clip button */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="section-title">{copy.usage.operationsLogTitle}</h3>
            <Tooltip content={copy.tooltips.idempotency} />
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={isRerunning}
            onClick={handleRerunSameClip}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {copy.usage.rerunSameClip}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !usage?.operations || usage.operations.length === 0 ? (
          <p className="text-[14px] text-[var(--text-secondary)]">{copy.usage.noOperations}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--fill-subtle)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colCall}</th>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colModel}</th>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colTime}</th>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colMode}</th>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colOperationId}</th>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colCredits}</th>
                  <th className="py-2.5 px-3 font-semibold">{copy.usage.colCacheStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                {usage.operations.map((op) => {
                  const isHighlighted = highlightId === op.id && op.mode === "CACHED";
                  return (
                    <tr
                      key={op.id}
                      className={
                        isHighlighted
                          ? "bg-[var(--decision-continue-tint)] font-medium transition-colors"
                          : "hover:bg-[var(--fill-subtle)]"
                      }
                    >
                      <td className="py-2.5 px-3 font-mono">{op.call_id || copy.states.unavailable}</td>
                      <td className="py-2.5 px-3 font-semibold capitalize">{op.service}</td>
                      <td className="py-2.5 px-3 font-mono">{formatDate(op.timestamp)}</td>
                      <td className="py-2.5 px-3">
                        <ModeBadge mode={op.mode} />
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{op.id}</span>
                          <button
                            type="button"
                            aria-label="Copy operation ID"
                            onClick={() => handleCopyOpId(op.id)}
                            className="p-1 rounded hover:bg-[var(--border)] cursor-pointer text-[var(--text-muted)]"
                          >
                            {copiedId === op.id ? (
                              <Check className="w-3.5 h-3.5 text-[var(--decision-continue-solid)]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">{op.cost_credits}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={op.mode === "CACHED" || op.cached ? "info" : "neutral"} size="sm">
                          {op.mode === "CACHED" || op.cached
                            ? copy.usage.cacheHitLabel
                            : copy.usage.cacheMissLabel}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
