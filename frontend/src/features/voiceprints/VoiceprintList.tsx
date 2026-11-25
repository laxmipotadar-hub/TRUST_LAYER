import React, { useState, useEffect } from "react";
import { UserCheck, Trash2, Search, Plus, Loader2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Modal } from "../../components/ui/Modal";
import { copy } from "../../copy";
import { aegisApi } from "../../lib/api";
import { formatDate } from "../../lib/format";
import type { ApiError, Voiceprint } from "../../types";

export interface VoiceprintListProps {
  onNavigateEnroll: () => void;
  onVoiceprintRevoked: () => void;
}

export const VoiceprintList: React.FC<VoiceprintListProps> = ({
  onNavigateEnroll,
  onVoiceprintRevoked,
}) => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voiceprint | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadVoiceprints = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await aegisApi.getVoiceprints();
      setVoiceprints(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr?.message || copy.states.errorTitle);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVoiceprints();
  }, []);

  const handleConfirmRevoke = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    setRevokingId(targetId);

    try {
      await aegisApi.deleteVoiceprint(targetId);
      // Mark "Revoked" ONLY after backend success
      setVoiceprints((prev) =>
        prev.map((vp) => (vp.id === targetId ? { ...vp, status: "revoked" } : vp))
      );
      onVoiceprintRevoked();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr?.message || copy.states.errorTitle);
    } finally {
      setRevokingId(null);
    }
  };

  const filtered = voiceprints.filter(
    (vp) =>
      vp.claimed_user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vp.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={copy.voiceprints.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)]"
          />
        </div>
        <Button variant="primary" onClick={onNavigateEnroll} icon={<Plus className="w-4 h-4" />}>
          {copy.enroll.pageTitle}
        </Button>
      </div>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadVoiceprints} />}

      {isLoading ? (
        <Card className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-8 h-8" />}
          title={copy.voiceprints.emptyTitle}
          description={copy.voiceprints.emptyDesc}
          actionLabel={copy.voiceprints.emptyAction}
          onAction={onNavigateEnroll}
        />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--fill-subtle)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-4 font-semibold">{copy.voiceprints.colUser}</th>
                  <th className="py-3 px-4 font-semibold">{copy.voiceprints.colVoiceId}</th>
                  <th className="py-3 px-4 font-semibold">{copy.voiceprints.colEnrolled}</th>
                  <th className="py-3 px-4 font-semibold">{copy.voiceprints.colLastVerification}</th>
                  <th className="py-3 px-4 font-semibold">{copy.voiceprints.colStatus}</th>
                  <th className="py-3 px-4 font-semibold text-right">{copy.voiceprints.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                {filtered.map((vp) => {
                  const isRevoked = vp.status === "revoked";
                  const isRowRevoking = revokingId === vp.id;
                  return (
                    <tr key={vp.id} className="hover:bg-[var(--fill-subtle)]">
                      <td className="py-3 px-4">
                        <div className="font-semibold">{vp.user_name}</div>
                        <div className="caption-text font-mono">{vp.claimed_user_id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">{vp.id}</td>
                      <td className="py-3 px-4">{formatDate(vp.enrolled_at)}</td>
                      <td className="py-3 px-4">
                        {vp.last_verified_at ? formatDate(vp.last_verified_at) : copy.states.unavailable}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={isRevoked ? "danger" : "success"} size="sm">
                          {isRevoked ? copy.voiceprints.statusRevoked : copy.voiceprints.statusActive}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isRowRevoking ? (
                          <span className="inline-flex items-center gap-1.5 text-[14px] text-[var(--text-muted)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Revoking...</span>
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRevoked || revokingId !== null}
                            onClick={() => setDeleteTarget(vp)}
                            icon={<Trash2 className="w-4 h-4 text-[var(--decision-endcall-solid)]" />}
                          >
                            {copy.voiceprints.deleteButton}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={copy.voiceprints.deleteConfirmTitle}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              {copy.voiceprints.cancel}
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmRevoke}>
              {copy.voiceprints.confirmDelete}
            </Button>
          </>
        }
      >
        <p className="text-[16px] text-[var(--text-primary)]">{copy.voiceprints.deleteConfirmDesc}</p>
        {deleteTarget && (
          <p className="text-[14px] font-mono text-[var(--text-secondary)] mt-2">
            {deleteTarget.user_name} — {deleteTarget.id}
          </p>
        )}
      </Modal>
    </div>
  );
};
