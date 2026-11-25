import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Globe,
  Printer,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { ActionButton } from '../components/ui/ActionButton';
import { AlertCard } from '../components/ui/AlertCard';
import { EmptyState } from '../components/ui/EmptyState';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { StatusBadge, type StatusTone } from '../components/ui/StatusBadge';
import { useAegis } from '../hooks/useAegis';
import { aegisApi } from '../services/api';
import type { CallReportResponse } from '../types/aegis';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function verdictTone(v: string): StatusTone {
  if (v === 'SAFE') return 'safe';
  if (v === 'THREAT') return 'threat';
  return 'caution';
}

export function ReportsPage() {
  const { callsHistory, currentCall } = useAegis();
  const [selectedCallId, setSelectedCallId] = useState<string | null>(
    currentCall?.call_id ?? callsHistory[0]?.call_id ?? null,
  );
  const [report, setReport] = useState<CallReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'SAFE' | 'CAUTION' | 'THREAT'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'CACHED' | 'REAL' | 'SIMULATION'>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [activeLang, setActiveLang] = useState<'en' | 'es' | 'fr' | 'de'>('en');

  useEffect(() => {
    if (!selectedCallId && (currentCall?.call_id || callsHistory[0]?.call_id)) {
      setSelectedCallId(currentCall?.call_id ?? callsHistory[0]?.call_id ?? null);
    }
  }, [selectedCallId, currentCall?.call_id, callsHistory]);

  const filteredCalls = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return callsHistory.filter((call) => {
      const verdict = call.trust_breakdown.final_decision || call.trust_breakdown.verdict;
      if (verdictFilter !== 'ALL' && verdict !== verdictFilter) return false;
      const mode = call.mode === 'REAL' ? 'REAL' : call.overall_provenance === 'CACHED ANALYSIS' ? 'CACHED' : 'SIMULATION';
      if (modeFilter !== 'ALL' && mode !== modeFilter) return false;
      if (dateFilter && !call.created_at.startsWith(dateFilter)) return false;
      if (!q) return true;
      return (
        call.call_id.toLowerCase().includes(q) ||
        call.caller_label.toLowerCase().includes(q) ||
        call.claimed_customer_id.toLowerCase().includes(q) ||
        (call.caller_profile?.claimed_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [callsHistory, searchQuery, verdictFilter, modeFilter, dateFilter]);

  const loadReport = useCallback(async (callId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await aegisApi.getCallReport(callId);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate post-call report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCallId) {
      void loadReport(selectedCallId);
    }
  }, [selectedCallId, loadReport]);

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AEGIS_Report_${report.call_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // Combine actual evidence_timeline & segment_chunks chronologically without inventing timestamps
  const chronologicalEvidence = useMemo(() => {
    if (!report) return [];
    const session = report.call_session;
    const events = session.evidence_timeline.map((ev) => ({
      id: ev.id,
      timeSec: ev.timestamp_sec,
      title: ev.title,
      detail: ev.description,
      severity: ev.severity,
    }));
    const chunks = (session.segment_chunks ?? []).map((ch) => ({
      id: `chunk-${ch.chunk_index}`,
      timeSec: ch.end_sec,
      title: `Segment ${formatClock(ch.start_sec)}–${formatClock(ch.end_sec)}: ${ch.label}`,
      detail: `Segment risk level: ${ch.risk_level}`,
      severity: ch.risk_level === 'HIGH' ? 'CRITICAL' : ch.risk_level === 'MEDIUM' ? 'WARNING' : 'INFO',
    }));
    return [...events, ...chunks].sort((a, b) => a.timeSec - b.timeSec);
  }, [report]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#f8fafc]">AEGIS Post-Call Reports</h2>
          <p className="text-xs text-[#94a3b8]">
            Auditable forensic call reports with formula breakdowns, chronological evidence, and
            PDF/JSON export.
          </p>
        </div>

        {report && (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="secondary"
              icon={<Printer className="h-3.5 w-3.5" />}
              onClick={handlePrintPdf}
            >
              Download PDF (Print)
            </ActionButton>
            <ActionButton
              variant="primary"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleDownloadJson}
            >
              Download JSON
            </ActionButton>
          </div>
        )}
      </div>

      {error && (
        <AlertCard
          className="no-print"
          tone="threat"
          title="Report Generation Error"
          description={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Searchable Report History Table */}
      <section className="no-print space-y-3 rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Report History ({filteredCalls.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Search Call ID or Caller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-md border border-slate-700 bg-[#0a0f1e] py-1.5 pl-8 pr-3 text-xs text-[#f8fafc] focus:border-sky-500 focus:outline-none"
              />
            </div>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter reports by date"
              className="rounded-md border border-slate-700 bg-[#0a0f1e] px-2.5 py-1.5 font-mono text-xs text-[#f8fafc]"
            />

            <select
              value={verdictFilter}
              onChange={(e) =>
                setVerdictFilter(e.target.value as 'ALL' | 'SAFE' | 'CAUTION' | 'THREAT')
              }
              aria-label="Filter reports by verdict"
              className="rounded-md border border-slate-700 bg-[#0a0f1e] px-2.5 py-1.5 font-mono text-xs text-[#f8fafc]"
            >
              <option value="ALL">Verdict: ALL</option>
              <option value="SAFE">SAFE</option>
              <option value="CAUTION">CAUTION</option>
              <option value="THREAT">THREAT</option>
            </select>

            <select
              value={modeFilter}
              onChange={(e) =>
                setModeFilter(e.target.value as 'ALL' | 'CACHED' | 'REAL' | 'SIMULATION')
              }
              aria-label="Filter reports by analysis mode"
              className="rounded-md border border-slate-700 bg-[#0a0f1e] px-2.5 py-1.5 font-mono text-xs text-[#f8fafc]"
            >
              <option value="ALL">Mode: ALL</option>
              <option value="CACHED">CACHED</option>
              <option value="REAL">REAL</option>
              <option value="SIMULATION">SIMULATION</option>
            </select>
          </div>
        </div>

        {filteredCalls.length === 0 ? (
          <EmptyState
            title="No Matching Call Reports"
            description="Adjust filters or run a call scenario on the Dashboard to generate forensic reports."
          />
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#151e30] font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Call ID</th>
                  <th className="px-3 py-2">Date / Time</th>
                  <th className="px-3 py-2">Caller Identity</th>
                  <th className="px-3 py-2">Analysis Mode</th>
                  <th className="px-3 py-2">Trust Score</th>
                  <th className="px-3 py-2">Final Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredCalls.map((c) => {
                  const decision = c.trust_breakdown.final_decision || c.trust_breakdown.verdict;
                  const active = c.call_id === selectedCallId;
                  return (
                    <tr
                      key={c.call_id}
                      onClick={() => setSelectedCallId(c.call_id)}
                      className={`cursor-pointer transition-colors ${
                        active ? 'bg-sky-500/10' : 'hover:bg-[#151e30]/60'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-[#f8fafc]">
                        {c.call_id}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#94a3b8]">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-[#f8fafc]">{c.caller_label}</td>
                      <td className="px-3 py-2">
                        <ProvenanceBadge provenance={c.overall_provenance} compact />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-[#f8fafc]">
                        {c.trust_breakdown.composite_score !== null
                          ? c.trust_breakdown.composite_score.toFixed(2)
                          : 'N/A'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge label={decision} tone={verdictTone(decision)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loading && <DashboardSkeleton />}

      {/* Printable Detailed Post-Call Report */}
      {!loading && report && (
        <article className="print-report space-y-5 rounded-xl border border-slate-800/90 bg-[#111827] p-6">
          {/* REPORT SUMMARY */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <span className="font-mono text-sm font-bold text-[#f8fafc]">
                  AEGIS FORENSIC REPORT · {report.report_id}
                </span>
                <ProvenanceBadge provenance={report.provenance} compact />
              </div>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Generated: {new Date(report.generated_at).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={`SCORE VERDICT: ${report.score_based_verdict ?? report.verdict}`}
                tone={verdictTone(report.score_based_verdict ?? report.verdict)}
                size="md"
              />
              <StatusBadge
                label={`FINAL DECISION: ${report.final_security_decision ?? report.verdict}`}
                tone={verdictTone(report.final_security_decision ?? report.verdict)}
                size="md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-[#151e30] p-3">
              <div className="font-mono text-[10px] uppercase text-[#94a3b8]">Call ID</div>
              <div className="mt-1 font-mono text-xs font-semibold text-[#f8fafc]">
                {report.call_id}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#151e30] p-3">
              <div className="font-mono text-[10px] uppercase text-[#94a3b8]">Caller Identity</div>
              <div className="mt-1 text-xs font-semibold text-[#f8fafc]">
                {report.caller_identity || report.call_session.caller_label}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#151e30] p-3">
              <div className="font-mono text-[10px] uppercase text-[#94a3b8]">
                Duration &amp; Mode
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-[#f8fafc]">
                {(report.call_duration_sec ?? 15).toFixed(0)}s ·{' '}
                {report.analysis_mode ?? report.call_session.mode}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#151e30] p-3">
              <div className="font-mono text-[10px] uppercase text-[#94a3b8]">Final Trust Score</div>
              <div className="mt-1 font-mono text-lg font-bold text-[#f8fafc]">
                {report.composite_score !== null ? `${report.composite_score.toFixed(2)} / 100` : 'N/A'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Executive Summary
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#f8fafc]">{report.executive_summary}</p>
          </div>

          {/* AI ANALYSIS — FOUR LAYERS */}
          <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Four-Layer AI Trust Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {report.call_session.trust_breakdown.factor_contributions.map((layer) => (
                <div
                  key={layer.key}
                  className="rounded-lg border border-slate-800 bg-[#151e30]/80 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#f8fafc]">
                      {layer.layer_name || layer.label}
                    </span>
                    <span className="font-mono font-semibold text-sky-300">
                      +{layer.weighted_contribution.toFixed(2)} ({Math.round(layer.weight * 100)}%)
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[#94a3b8]">
                    Formula: {layer.formula}
                  </div>
                  <p className="mt-1 text-[11px] text-[#94a3b8]">{layer.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CHRONOLOGICAL EVIDENCE TIMELINE */}
          <div>
            <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              Chronological Evidence Timeline
            </h3>
            <div className="space-y-1.5">
              {chronologicalEvidence.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-slate-800 bg-[#0a0f1e]/70 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-sky-400">
                      {formatClock(item.timeSec)}
                    </span>{' '}
                    — <span className="font-semibold text-[#f8fafc]">{item.title}</span>
                    <div className="mt-0.5 text-[11px] text-[#94a3b8]">{item.detail}</div>
                  </div>
                  <StatusBadge
                    label={item.severity}
                    tone={
                      item.severity === 'CRITICAL'
                        ? 'threat'
                        : item.severity === 'WARNING'
                          ? 'caution'
                          : 'safe'
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* RECOMMENDATIONS */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              <ShieldAlert className="h-3.5 w-3.5 text-sky-400" />
              Actionable Recommendations
            </h3>
            <ul className="space-y-1.5 rounded-lg border border-slate-800 bg-[#151e30] p-3.5 text-xs">
              {(report.recommendations ?? [report.call_session.trust_breakdown.recommended_action]).map(
                (rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-[#f8fafc]">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <span>{rec}</span>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* MULTILINGUAL VERDICTS WITH INTERACTIVE LANGUAGE SWITCHER */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                <Globe className="h-3.5 w-3.5 text-sky-400" />
                Multi-Language Verdict Switcher
              </h3>
              <div
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0f1e] p-0.5"
                role="group"
                aria-label="Report verdict language switcher"
              >
                {(
                  [
                    ['en', 'EN'],
                    ['es', 'ES'],
                    ['fr', 'FR'],
                    ['de', 'DE'],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveLang(code)}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
                      activeLang === code
                        ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                        : 'text-[#94a3b8] hover:text-[#f8fafc]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2.5 rounded-lg border border-sky-500/35 bg-sky-500/10 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-sky-300">
                Active Display Language ({activeLang.toUpperCase()})
              </div>
              <div className="mt-1 text-sm font-medium text-[#f8fafc]">
                {report.multilingual_verdicts[activeLang] ??
                  Object.values(report.multilingual_verdicts)[0]}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(report.multilingual_verdicts).map(([lang, text]) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveLang(lang as 'en' | 'es' | 'fr' | 'de')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    activeLang === lang
                      ? 'border-sky-500/50 bg-[#151e30]'
                      : 'border-slate-800 bg-[#151e30]/60 hover:border-slate-700'
                  }`}
                >
                  <div className="font-mono text-[10px] uppercase text-sky-400">{lang}</div>
                  <div className="mt-1 text-xs text-[#f8fafc]">{text}</div>
                </button>
              ))}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
