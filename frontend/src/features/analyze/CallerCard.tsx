import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { copy } from "../../copy";
import { aegisApi } from "../../lib/api";
import { useAnalysis } from "../../context/AnalysisContext";
import { formatSimilarity } from "../../lib/format";
import type { CallSession, ExecutionMode, VoiceprintRecord } from "../../types";

export interface CallerCardProps {
  call: CallSession | null;
  voiceprints: VoiceprintRecord[];
  executionMode?: ExecutionMode;
}

export const CallerCard: React.FC<CallerCardProps> = ({
  call,
  voiceprints,
  executionMode,
}) => {
  const { refreshVoiceprints, showToast } = useAnalysis();
  const [resyncing, setResyncing] = useState(false);
  const identity = call?.speaker_identity;
  const profile = call?.caller_profile;
  const activeCustomerId = identity?.claimed_customer_id || call?.claimed_customer_id;
  const activeVps = voiceprints.filter(
    (vp) => vp.customer_id === activeCustomerId && vp.status === "ACTIVE"
  );
  const liveVp = activeVps.find((vp) => {
    const pid = (vp.provider_speaker_id || vp.provider_speaker_ref || "").trim();
    return Boolean(pid) && !pid.startsWith("eidos-ref-") && !pid.startsWith("sim-");
  });
  const matchedVp = liveVp || activeVps[0];

  const isLive = (call?.execution_mode || executionMode) === "LIVE";
  const resolvedSpeakerId =
    identity?.provider_speaker_id ||
    matchedVp?.provider_speaker_id ||
    matchedVp?.provider_speaker_ref ||
    "";
  const hasRealLiveSpeakerId = Boolean(
    matchedVp &&
      matchedVp.status === "ACTIVE" &&
      resolvedSpeakerId &&
      !resolvedSpeakerId.startsWith("eidos-ref-") &&
      !resolvedSpeakerId.startsWith("sim-")
  );
  const handleResync = async () => {
    setResyncing(true);
    try {
      await aegisApi.reconcileVoiceprints();
      await refreshVoiceprints();
      showToast({
        variant: "success",
        title: "Voiceprints Re-synced",
        message: "Updated local voiceprints from DetectifAI /v1/speakers (0 credits).",
      });
    } catch {
      showToast({
        variant: "error",
        title: "Re-sync Failed",
        message: "Unable to fetch speakers from DetectifAI provider.",
      });
    } finally {
      setResyncing(false);
    }
  };
  const isNoLiveVoiceId = identity?.skip_reason === "no_voice_id";

  // In LIVE mode, ONLY treat real Eidos enrollments as Enrolled; seeded demo records show Demo Only
  const enrolled = isLive
    ? !isNoLiveVoiceId && hasRealLiveSpeakerId
    : identity
    ? identity.enrolled
    : Boolean(matchedVp);

  const isDemoSeedOnly = isLive && Boolean(matchedVp) && !hasRealLiveSpeakerId;

  const similarityDisplay = isNoLiveVoiceId
    ? "Skipped — No live Voice ID"
    : identity && identity.match_confidence !== null && identity.match_confidence !== undefined
    ? formatSimilarity(identity.match_confidence)
    : copy.states.unavailable;

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
        <h3 className="card-title">{copy.callerCard.title}</h3>
      </div>

      <div className="space-y-2 text-[14px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">{copy.callerCard.claimedIdentity}</span>
          <span className="font-semibold text-[var(--text-primary)] text-right truncate">
            {profile?.claimed_name ||
              identity?.claimed_customer_id ||
              call?.claimed_customer_id ||
              copy.states.unavailable}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">customer_id</span>
          <span className="font-mono text-[var(--text-primary)] truncate">
            {identity?.claimed_customer_id ||
              call?.claimed_customer_id ||
              copy.states.unavailable}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">voiceprint_id</span>
          <span className="font-mono text-[var(--text-primary)] truncate">
            {enrolled && matchedVp ? matchedVp.voiceprint_id : isDemoSeedOnly ? "DEMO ONLY" : "UNENROLLED"}
          </span>
        </div>

        {(identity?.provider_speaker_id || (hasRealLiveSpeakerId && resolvedSpeakerId)) && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">provider_speaker_id</span>
            <span className="font-mono text-[var(--text-primary)] truncate">
              {identity?.provider_speaker_id || resolvedSpeakerId}
            </span>
          </div>
        )}

        {profile?.account_ref_masked && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">Account Ref</span>
            <span className="font-mono text-[var(--text-primary)]">{profile.account_ref_masked}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">{copy.callerCard.enrollmentStatus}</span>
          {enrolled ? (
            <Badge variant="success" size="sm">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isLive && hasRealLiveSpeakerId ? "Live Enrolled" : copy.callerCard.enrolled}
              </span>
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {isDemoSeedOnly ? "Demo Only (Not Live Enrolled)" : copy.callerCard.notEnrolled}
              </span>
            </Badge>
          )}
        </div>

        {isLive && !enrolled && (
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/enroll"
              className="text-[14px] font-semibold text-[var(--brand-steel)] hover:underline"
            >
              Enroll a live Voice ID &rarr;
            </Link>
            <button
              type="button"
              disabled={resyncing}
              onClick={() => void handleResync()}
              className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--brand-steel)] hover:underline disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? "animate-spin" : ""}`} />
              {resyncing ? "Re-syncing..." : "Re-sync from provider"}
            </button>
          </div>
        )}

        <div className="pt-1 border-t border-[var(--border)]">
          <span className="text-[var(--text-muted)] block">{copy.callerCard.similarity}</span>
          <span className="font-semibold text-[var(--text-primary)]">{similarityDisplay}</span>
        </div>
      </div>
    </Card>
  );
};
