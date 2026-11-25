import React from "react";
import { User, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { copy } from "../../copy";
import { formatSimilarity } from "../../lib/format";
import type { CallSession, VoiceprintRecord } from "../../types";

export interface CallerCardProps {
  call: CallSession | null;
  voiceprints: VoiceprintRecord[];
}

export const CallerCard: React.FC<CallerCardProps> = ({ call, voiceprints }) => {
  const identity = call?.speaker_identity;
  const profile = call?.caller_profile;
  const matchedVp = voiceprints.find(
    (vp) =>
      vp.customer_id === (identity?.claimed_customer_id || call?.claimed_customer_id) &&
      vp.status === "ACTIVE"
  );

  const enrolled = identity ? identity.enrolled : Boolean(matchedVp);
  const similarityDisplay =
    identity && identity.match_confidence !== null && identity.match_confidence !== undefined
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
            {profile?.claimed_name || identity?.claimed_customer_id || call?.claimed_customer_id || copy.states.unavailable}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">customer_id</span>
          <span className="font-mono text-[var(--text-primary)] truncate">
            {identity?.claimed_customer_id || call?.claimed_customer_id || copy.states.unavailable}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">voiceprint_id</span>
          <span className="font-mono text-[var(--text-primary)] truncate">
            {matchedVp?.voiceprint_id || "UNENROLLED"}
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
          <Badge variant={enrolled ? "success" : "warning"} size="sm">
            {enrolled ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {copy.callerCard.enrolled}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {copy.callerCard.notEnrolled}
              </span>
            )}
          </Badge>
        </div>

        <div className="pt-1 border-t border-[var(--border)]">
          <span className="text-[var(--text-muted)] block">{copy.callerCard.similarity}</span>
          <span className="font-semibold text-[var(--text-primary)]">{similarityDisplay}</span>
        </div>
      </div>
    </Card>
  );
};
