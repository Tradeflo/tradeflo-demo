import type { QuoteGenerateRequest } from "@/lib/schemas/quote-builder";

/** Best-effort job label for telemetry (chat mode may omit). */
export function jobTypeFromGenerateInput(
  input: QuoteGenerateRequest,
): string | null {
  const j = input.job?.jobType?.trim();
  if (j) return j;
  const cs = input.collectedSummary;
  if (cs && typeof cs === "object") {
    const o = cs as Record<string, unknown>;
    const a = o.jobType;
    if (typeof a === "string" && a.trim()) return a.trim();
    const b = o.job_type;
    if (typeof b === "string" && b.trim()) return b.trim();
  }
  return null;
}
