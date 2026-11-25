import React from "react";
import { Link } from "react-router-dom";
import { User, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { copy } from "../../copy";
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
  const identity = call?.speaker_identity;
  const profile = call?.caller_profile;
  const activeCustomerId = identity?.claimed_customer_id || call?.claimed_customer_id;
  const matchedVp = voiceprints.find(
    (vp) => vp.customer_id === activeCustomerId && vp.status === "ACTIVE"
  );

  const isLive = (call?.execution_mode || executionMode) === "LIVE";
  const hasRealLiveSpeakerId = Boolean(
    matchedVp &&
      matchedVp.enrollment_source === "REAL ANALYSIS" &&
      matchedVp.provider_speaker_ref &&
      !matchedVp.provider_speaker_ref.startsWith("eidos-ref-") &&
      !matchedVp.provider_speaker_ref.startsWith("sim-")
  );
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
                {copy.callerCard.enrolled}
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
          <div className="pt-1">
            <Link
              to="/enroll"
              className="text-[14px] font-semibold text-[var(--brand-steel)] hover:underline"
            >
              Enroll a live Voice ID &rarr;
            </Link>
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
