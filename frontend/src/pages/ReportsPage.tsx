import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, ArrowRight } from "lucide-react";
import { useAnalysis } from "../context/AnalysisContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ModeBadge } from "../components/ui/ModeBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { copy } from "../copy";
import { formatDate } from "../lib/format";
import type { DecisionType } from "../types";

export const ReportsPage: React.FC = () => {
  const { reports } = useAnalysis();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | DecisionType>("ALL");

  const filtered = reports.filter((r) => {
    const matchesSearch =
      r.call_id.toLowerCase().includes(search.toLowerCase()) ||
      r.caller_label.toLowerCase().includes(search.toLowerCase());
    const effective = r.analysis.liveness.status === "failed" ? "END_CALL" : r.analysis.decision;
    const matchesDecision = decisionFilter === "ALL" || effective === decisionFilter;
    return matchesSearch && matchesDecision;
  });

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-8 h-8" />}
        title={copy.reports.emptyTitle}
        description={copy.reports.emptyDesc}
        actionLabel={copy.reports.emptyAction}
        onAction={() => navigate("/analyze")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={copy.reports.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)]"
          />
        </div>

        <select
          aria-label="Filter by decision"
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value as "ALL" | DecisionType)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)]"
        >
          <option value="ALL">{copy.reports.filterAll}</option>
          <option value="CONTINUE">CONTINUE</option>
          <option value="STEP_UP">STEP_UP</option>
          <option value="END_CALL">END_CALL</option>
        </select>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[var(--fill-subtle)] text-[var(--text-secondary)] border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4 font-semibold">Call ID</th>
                <th className="py-3 px-4 font-semibold">Time</th>
                <th className="py-3 px-4 font-semibold">Caller</th>
                <th className="py-3 px-4 font-semibold">Mode</th>
                <th className="py-3 px-4 font-semibold">Decision</th>
                <th className="py-3 px-4 font-semibold">Risk Index</th>
                <th className="py-3 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
              {filtered.map((rep) => {
                const effDecision =
                  rep.analysis.liveness.status === "failed"
                    ? "END_CALL"
                    : rep.analysis.decision;
                const badgeVariant =
                  effDecision === "CONTINUE"
                    ? "success"
                    : effDecision === "STEP_UP"
                    ? "warning"
                    : "danger";

                return (
                  <tr
                    key={rep.call_id}
                    onClick={() => navigate(`/reports/${encodeURIComponent(rep.call_id)}`)}
                    className="hover:bg-[var(--fill-subtle)] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold">{rep.call_id}</td>
                    <td className="py-3 px-4">{formatDate(rep.saved_at)}</td>
                    <td className="py-3 px-4">{rep.caller_label}</td>
                    <td className="py-3 px-4">
                      <ModeBadge mode={rep.analysis.mode} />
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={badgeVariant} size="sm">
                        {effDecision}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {rep.analysis.trust_score.value} ({rep.analysis.trust_score.band})
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ArrowRight className="w-4 h-4 inline text-[var(--brand-steel)]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
