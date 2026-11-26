import type { SpeakerIdentityResult } from "../../types";

export function formatEidosReason(identity?: SpeakerIdentityResult | null): string {
  if (!identity) return "No live Voice ID";
  const reason = (identity.skip_reason || "").trim().toLowerCase();
  const detail = (identity.detail || "").trim();

  if (reason === "no_voice_id") return "No live Voice ID";
  if (reason === "l1_error") return detail.startsWith("Blocked by L1 error") ? detail : "Blocked by L1 error";
  if (reason === "aletheia_fake") return "L1 flagged fake";
  if (reason === "clip_too_short") return "Clip too short: need >= 10 s of speech";
  if (reason === "insufficient_credits") {
    return detail.includes("Insufficient credits")
      ? detail
      : "Insufficient credits: need ~500";
  }

  return detail || "Reason unavailable";
}

export function formatEidosSkippedTitle(identity?: SpeakerIdentityResult | null): string {
  return `Skipped — ${formatEidosReason(identity)}`;
}
