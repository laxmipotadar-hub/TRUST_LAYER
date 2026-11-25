import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, RefreshCw, Search, ShieldCheck, ArrowRight } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ModeBadge } from "../components/ui/ModeBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { useAnalysis } from "../context/AnalysisContext";
import { copy } from "../copy";
import { formatDate } from "../lib/format";
import type { CallReportResponse, TrustVerdict } from "../types";

function verdictBadgeVariant(
  verdict: TrustVerdict
): "success" | "warning" | "danger" | "neutral" {
  if (verdict === "SAFE") return "success";
  if (verdict === "CAUTION") return "warning";
  if (verdict === "THREAT") return "danger";
  return "neutral";
}

function reportModeToBadge(report: CallReportResponse): "LIVE" | "CACHED" | "DEMO" {
  if (report.call_session.execution_mode === "LIVE") return "LIVE";
  if (report.analysis_mode === "CACHED") return "CACHED";
  return "DEMO";
}

export const ReportsPage: React.FC = () => {
  const { reports, refreshReports } = useAnalysis();
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshReports();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (verdictFilter !== "ALL" && r.final_security_decision !== verdictFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.call_id.toLowerCase().includes(q) ||
        r.report_id.toLowerCase().includes(q) ||
        r.caller_identity.toLowerCase().includes(q) ||
        r.executive_summary.toLowerCase().includes(q)
      );
    });
  }, [reports, search, verdictFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{copy.reports.pageTitle}</h1>
          <p className="body-text">{copy.reports.pageSubtitle}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}
        >
          Refresh Reports
        </Button>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by call ID, report ID, caller..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text-primary)]"
            />
          </div>

          <div className="flex items-center gap-2">
            {(["ALL", "SAFE", "CAUTION", "THREAT"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVerdictFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-[14px] font-semibold cursor-pointer border transition-colors ${
                  verdictFilter === v
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--fill-subtle)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title={copy.reports.emptyTitle}
            description={copy.reports.emptyDesc}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[14px] font-semibold text-[var(--text-secondary)]">
                  <th className="py-3 pr-4">Report / Call ID</th>
                  <th className="py-3 pr-4">Caller Identity</th>
                  <th className="py-3 pr-4">Mode</th>
                  <th className="py-3 pr-4">Trust Score</th>
                  <th className="py-3 pr-4">Decision</th>
                  <th className="py-3 pr-4">Analyst Feedback</th>
                  <th className="py-3 pr-4">Generated</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[14px]">
                {filteredReports.map((r) => {
                  const fb = r.call_session.feedback;
                  return (
                    <tr key={r.report_id} className="hover:bg-[var(--fill-subtle)]">
                      <td className="py-3 pr-4 font-mono text-[13px]">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {r.call_id}
                        </div>
                        <div className="text-[var(--text-muted)]">{r.report_id}</div>
                      </td>
                      <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">
                        {r.caller_identity}
                      </td>
                      <td className="py-3 pr-4">
                        <ModeBadge mode={reportModeToBadge(r)} />
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold text-[var(--text-primary)]">
                        {r.composite_score !== null ? `${r.composite_score.toFixed(1)}/100` : "N/A"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={verdictBadgeVariant(r.final_security_decision)}>
                          {r.final_security_decision}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {fb ? (
                          <Badge
                            variant={
                              fb.label === "SCAM"
                                ? "danger"
                                : fb.label === "LEGITIMATE"
                                  ? "success"
                                  : "warning"
                            }
                          >
                            {fb.label}
                          </Badge>
                        ) : (
                          <span className="text-[var(--text-muted)]">Unlabelled</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[var(--text-secondary)]">
                        {formatDate(r.generated_at)}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/reports/${encodeURIComponent(r.call_id)}`}
                          className="inline-flex items-center gap-1 font-semibold text-[var(--brand-steel)] hover:underline"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
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
