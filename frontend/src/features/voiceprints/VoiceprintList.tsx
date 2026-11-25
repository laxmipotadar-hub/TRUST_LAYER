import React, { useState, useEffect } from "react";
import { UserCheck, Trash2, Search, Plus, Loader2, ShieldOff } from "lucide-react";
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
import type { ApiError, VoiceprintRecord } from "../../types";

export interface VoiceprintListProps {
  onNavigateEnroll: () => void;
  onVoiceprintRevoked: () => void;
}

export const VoiceprintList: React.FC<VoiceprintListProps> = ({
  onNavigateEnroll,
  onVoiceprintRevoked,
}) => {
  const [voiceprints, setVoiceprints] = useState<VoiceprintRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<VoiceprintRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VoiceprintRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    void loadVoiceprints();
  }, []);

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    const targetId = revokeTarget.voiceprint_id;
    setRevokeTarget(null);
    setBusyId(targetId);
    try {
      const updated = await aegisApi.revokeVoiceprint(targetId);
      setVoiceprints((prev) =>
        prev.map((vp) => (vp.voiceprint_id === targetId ? updated : vp))
      );
      onVoiceprintRevoked();
    } catch (err) {
      setErrorMsg((err as ApiError)?.message || copy.states.errorTitle);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.voiceprint_id;
    setDeleteTarget(null);
    setBusyId(targetId);
    try {
      await aegisApi.deleteVoiceprint(targetId);
      setVoiceprints((prev) => prev.filter((vp) => vp.voiceprint_id !== targetId));
      onVoiceprintRevoked();
    } catch (err) {
      setErrorMsg((err as ApiError)?.message || copy.states.errorTitle);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = voiceprints.filter(
    (vp) =>
      vp.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vp.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vp.voiceprint_id.toLowerCase().includes(searchTerm.toLowerCase())
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
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)]"
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
                  <th className="py-3 px-4 font-semibold">customer_name / customer_id</th>
                  <th className="py-3 px-4 font-semibold">voiceprint_id / provider_speaker_ref</th>
                  <th className="py-3 px-4 font-semibold">Enrolled</th>
                  <th className="py-3 px-4 font-semibold">Verifications</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                {filtered.map((vp) => (
                  <tr key={vp.voiceprint_id} className="hover:bg-[var(--fill-subtle)]">
                    <td className="py-3 px-4">
                      <p className="font-semibold">{vp.customer_name}</p>
                      <p className="font-mono text-[var(--text-muted)]">{vp.customer_id}</p>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <p>{vp.voiceprint_id}</p>
                      <p className="text-[var(--text-muted)]">{vp.provider_speaker_ref || "—"}</p>
                    </td>
                    <td className="py-3 px-4">{formatDate(vp.enrolled_at)}</td>
                    <td className="py-3 px-4">
                      <p>{vp.last_verification_status} ({vp.verification_count} checks)</p>
                      {vp.last_verified_at && (
                        <p className="text-[var(--text-muted)]">{formatDate(vp.last_verified_at)}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={vp.status === "ACTIVE" ? "success" : "danger"} size="sm">
                        {vp.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {vp.status === "ACTIVE" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === vp.voiceprint_id}
                          onClick={() => setRevokeTarget(vp)}
                          icon={
                            busyId === vp.voiceprint_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ShieldOff className="w-4 h-4" />
                            )
                          }
                        >
                          Revoke
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === vp.voiceprint_id}
                        onClick={() => setDeleteTarget(vp)}
                        icon={<Trash2 className="w-4 h-4 text-[var(--decision-endcall-solid)]" />}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Voiceprint?"
        subtitle={`Calls DetectifAI Eidos delete-speaker for ${revokeTarget?.customer_name || ""}`}
      >
        <div className="space-y-4">
          <p className="text-[14px] text-[var(--text-secondary)]">
            Revoking marks <span className="font-mono font-semibold">{revokeTarget?.voiceprint_id}</span> as REVOKED and deletes the speaker reference from DetectifAI Eidos.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => void handleConfirmRevoke()}>Confirm Revoke</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Voiceprint Record?"
        subtitle={deleteTarget?.voiceprint_id}
      >
        <div className="space-y-4">
          <p className="text-[14px] text-[var(--text-secondary)]">
            Permanently deletes this local voiceprint record and removes the provider speaker if active.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => void handleConfirmDelete()}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
