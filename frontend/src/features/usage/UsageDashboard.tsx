import React, { useState, useEffect, useCallback } from "react";
import { Shield, Database, CheckCircle2, Copy, Check, Download, Flame, RefreshCw } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { copy } from "../../copy";
import { aegisApi } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { useAnalysis } from "../../context/AnalysisContext";
import type { ApiError, UsageSummaryResponse } from "../../types";

export const UsageDashboard: React.FC = () => {
  const { executionMode } = useAnalysis();
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await aegisApi.getUsage(true);
      setUsage(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr?.message || copy.states.errorTitle);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
    if (executionMode !== "LIVE") return;
    const timer = window.setInterval(() => {
      void aegisApi.getUsage(false).then(setUsage).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadUsage, executionMode]);

  const handleCopyOpId = (opId: string) => {
    navigator.clipboard?.writeText(opId);
    setCopiedId(opId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const creditBalanceDisplay =
    usage?.credit_balance !== null && usage?.credit_balance !== undefined
      ? usage.credit_balance.toLocaleString()
      : copy.states.unavailable;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-[var(--text-secondary)]">
          Live backend operations ledger ({executionMode === "LIVE" ? "auto-refreshing every 5s in LIVE mode" : "snapshot"}).
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadUsage()} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
          <a
            href={aegisApi.getUsageCsvUrl()}
            download="aegis_operations_ledger.csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand-navy)] text-white text-[14px] font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadUsage} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">{copy.usage.creditBalance}</span>
            <Database className="w-5 h-5 text-[var(--brand-navy)]" />
          </div>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <p className="text-[28px] font-extrabold text-[var(--text-primary)]">{creditBalanceDisplay}</p>
          )}
          <p className="caption-text">{usage?.credit_balance_error || copy.usage.reportedByDetectifAI}</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">FRESH / Provider Calls</span>
            <Shield className="w-5 h-5 text-[var(--brand-steel)]" />
          </div>
          {isLoading ? <Skeleton className="h-8 w-20" /> : (
            <p className="text-[28px] font-extrabold text-[var(--text-primary)]">
              {usage?.fresh_calls ?? 0} fresh
            </p>
          )}
          <p className="caption-text">
            Aletheia {usage?.aletheia_calls ?? 0} · Eidos {usage?.eidos_calls ?? 0} · Gemini {usage?.gemini_calls ?? 0}
          </p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">Credit Burn Rate</span>
            <Flame className="w-5 h-5 text-[var(--decision-stepup-solid)]" />
          </div>
          {isLoading ? <Skeleton className="h-8 w-20" /> : (
            <p className="text-[28px] font-extrabold text-[var(--text-primary)]">
              {(usage?.burn_rate_per_call ?? 0).toFixed(1)}
            </p>
          )}
          <p className="caption-text">credits / call ({usage?.total_credits_used ?? 0} total used)</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="caption-text font-medium">Cache Hits & Credits Saved</span>
            <CheckCircle2 className="w-5 h-5 text-[var(--decision-continue-solid)]" />
          </div>
          {isLoading ? <Skeleton className="h-8 w-20" /> : (
            <p className="text-[28px] font-extrabold text-[var(--decision-continue-text)]">
              {usage?.total_credits_saved ?? 0}
            </p>
          )}
          <p className="caption-text">{usage?.cache_hits ?? 0} cache hits recorded</p>
        </Card>
      </div>

      {!isLoading && (!usage || usage.operations.length === 0) ? (
        <EmptyState
          title="No ledger operations yet"
          description="Analyze a call in LIVE, CACHED, or DEMO mode to inspect operation IDs, credit costs, and latencies."
        />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="card-title">{copy.usage.operationsLogTitle}</h3>
            <span className="caption-text font-mono">{usage?.operations.length || 0} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--fill-subtle)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-4 font-semibold">operation_id</th>
                  <th className="py-3 px-4 font-semibold">Service / Endpoint</th>
                  <th className="py-3 px-4 font-semibold">Mode</th>
                  <th className="py-3 px-4 font-semibold">Latency</th>
                  <th className="py-3 px-4 font-semibold">Credits</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {(usage?.operations || []).map((op) => (
                  <tr key={`${op.operation_id}-${op.timestamp}`} className="hover:bg-[var(--fill-subtle)]">
                    <td className="py-2.5 px-4 font-mono">
                      <button
                        type="button"
                        onClick={() => handleCopyOpId(op.operation_id)}
                        className="inline-flex items-center gap-1.5 hover:text-[var(--brand-steel)] cursor-pointer"
                      >
                        <span>{op.operation_id}</span>
                        {copiedId === op.operation_id ? <Check className="w-3.5 h-3.5 text-[var(--decision-continue-solid)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold uppercase">{op.service}</span>{" "}
                      <span className="font-mono text-[var(--text-muted)]">{op.endpoint}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={op.mode === "FRESH" ? "info" : op.mode === "CACHED" ? "success" : "neutral"} size="sm">
                        {op.mode}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{op.latency_ms.toFixed(0)} ms</td>
                    <td className="py-2.5 px-4 font-mono font-bold">{op.cost_credits}</td>
                    <td className="py-2.5 px-4">{formatDate(op.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
