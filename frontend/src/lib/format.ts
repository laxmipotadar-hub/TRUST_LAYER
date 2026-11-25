import { copy } from "../copy";

/**
 * Format helpers strictly enforcing hackathon language & display rules:
 * - Similarity is never a percentage. Show "Similarity 0.91 (scale -1 to 1)"
 * - Show "Synthetic likelihood 0.03" for Aletheia score
 * - Missing data is shown as "Unavailable", never invented
 */

export function formatSimilarity(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return copy.states.unavailable;
  }
  return `Similarity ${value.toFixed(2)} (scale -1 to 1)`;
}

export function formatSyntheticLikelihood(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return copy.states.unavailable;
  }
  return `Synthetic likelihood ${value.toFixed(2)}`;
}

export function formatCredits(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return copy.states.unavailable;
  }
  return `${value.toLocaleString()} credits`;
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return copy.states.unavailable;
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return copy.states.unavailable;
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return copy.states.unavailable;
  }
  return `${seconds.toFixed(1)}s`;
}

export function formatFallback(val: string | null | undefined): string {
  if (!val || val.trim() === "") return copy.states.unavailable;
  return val;
}
