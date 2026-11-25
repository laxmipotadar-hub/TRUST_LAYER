import React, { useEffect, useState } from "react";
import { ShieldAlert, Plus, RefreshCw } from "lucide-react";
import { ArchitectureDiagram } from "../features/deployment/ArchitectureDiagram";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import { aegisApi } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ThreatRegistryEntry } from "../types";

export const DeploymentPage: React.FC = () => {
  const [entries, setEntries] = useState<ThreatRegistryEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patternName, setPatternName] = useState("");
  const [speakerRef, setSpeakerRef] = useState("");
  const [category, setCategory] = useState("Voice Clone Attack");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [indicatorsText, setIndicatorsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRegistry = async (cat?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await aegisApi.getThreatRegistry(cat || undefined);
      setEntries(res.entries);
      if (res.categories.length > 0) setCategories(res.categories);
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unable to load Threat Registry."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegistry(selectedCategory);
  }, [selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patternName.trim() || !speakerRef.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await aegisApi.submitThreatRecord({
        pattern_name: patternName.trim(),
        raw_speaker_reference: speakerRef.trim(),
        category: category.trim(),
        severity,
        evidence_reference: evidenceRef.trim() || "Operator manual submission",
        indicators: indicatorsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setPatternName("");
      setSpeakerRef("");
      setEvidenceRef("");
      setIndicatorsText("");
      await loadRegistry(selectedCategory);
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to create Threat Registry entry."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    entryId: string,
    nextStatus: "PENDING REVIEW" | "CONFIRMED THREAT" | "MITIGATED"
  ) => {
    try {
      const updated = await aegisApi.updateThreatStatus(entryId, nextStatus);
      setEntries((prev) => prev.map((item) => (item.entry_id === entryId ? updated : item)));
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to update threat status."
      );
    }
  };

  return (
    <div className="space-y-6">
      <ArchitectureDiagram />

      {/* Threat Registry */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[var(--brand-steel)]" />
            <div>
              <h2 className="section-title">Inter-Bank Threat Signature Registry</h2>
              <p className="caption-text">
                Shared anonymized voice-clone &amp; social-engineering signatures (`GET / POST / PATCH /api/threat-registry`).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void loadRegistry(selectedCategory)}
              disabled={loading}
              icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Banner variant="error" title="Registry Error">
            {error}
          </Banner>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[14px] font-semibold text-[var(--text-secondary)]">
                <th className="py-2.5 pr-4">Pattern</th>
                <th className="py-2.5 pr-4">Category</th>
                <th className="py-2.5 pr-4">Severity</th>
                <th className="py-2.5 pr-4">Anonymous Ref</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">Last Seen</th>
                <th className="py-2.5 text-right">Governance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[14px]">
              {entries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {entry.pattern_name}
                    </div>
                    <div className="caption-text">{entry.indicators.join(", ")}</div>
                  </td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.category}</td>
                  <td className="py-3 pr-4">
                    <Badge
                      variant={
                        entry.severity === "CRITICAL" || entry.severity === "HIGH"
                          ? "danger"
                          : entry.severity === "MEDIUM"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {entry.severity}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 font-mono text-[13px] text-[var(--text-secondary)]">
                    {entry.anonymous_speaker_ref}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge
                      variant={
                        entry.verification_status === "CONFIRMED THREAT"
                          ? "danger"
                          : entry.verification_status === "MITIGATED"
                            ? "success"
                            : "warning"
                      }
                    >
                      {entry.verification_status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 caption-text">{formatDate(entry.last_seen)}</td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleStatusChange(entry.entry_id, "CONFIRMED THREAT")}
                      >
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleStatusChange(entry.entry_id, "MITIGATED")}
                      >
                        Mitigate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Submit Threat Record */}
        <form
          onSubmit={handleSubmit}
          className="pt-4 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <input
            type="text"
            value={patternName}
            onChange={(e) => setPatternName(e.target.value)}
            placeholder="Pattern name (e.g. RBI Warrant Clone)"
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
            required
          />
          <input
            type="text"
            value={speakerRef}
            onChange={(e) => setSpeakerRef(e.target.value)}
            placeholder="Raw speaker/call ref (hashed server-side)"
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
            required
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          >
            <option value="Voice Clone Attack">Voice Clone Attack</option>
            <option value="OTP Harvesting">OTP Harvesting</option>
            <option value="Executive Impersonation">Executive Impersonation</option>
            <option value="Replay Injection">Replay Injection</option>
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <input
            type="text"
            value={evidenceRef}
            onChange={(e) => setEvidenceRef(e.target.value)}
            placeholder="Evidence reference (call ID / op ID)"
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          />
          <input
            type="text"
            value={indicatorsText}
            onChange={(e) => setIndicatorsText(e.target.value)}
            placeholder="Comma-separated indicators (OTP, arrest, transfer)"
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          />
          <div className="md:col-span-3">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              icon={<Plus className="w-4 h-4" />}
            >
              {submitting ? "Registering..." : "Register Anonymized Threat Signature"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
