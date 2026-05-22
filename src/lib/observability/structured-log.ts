/**
 * SRS §4.11 structured logs — one JSON object per line (easy to grep / ship to a log drain).
 * Never pass secrets, full request bodies, or provider tokens here.
 */

export type StructuredApiLogLevel = "error" | "warn" | "info";

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error != null && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Flatten primitive extras under `detail` (optional). */
function detailOnly(
  extra?: Record<string, string | number | boolean | undefined | null>,
): Record<string, string | number | boolean> | undefined {
  if (!extra) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Emits one JSON line: `timestamp`, `action`, optional `user_id`, optional `error`, optional `detail`.
 * Primary fields align with SRS (user_id, action, error, timestamp).
 */
export function emitStructuredApiLog(params: {
  level: StructuredApiLogLevel;
  /** Business or route label, e.g. `POST /api/quotes/[id]/send` or `ai /api/chat`. */
  action: string;
  userId?: string | null;
  error?: unknown;
  detail?: Record<string, string | number | boolean | undefined | null>;
}): void {
  const timestamp = new Date().toISOString();
  const line: Record<string, unknown> = {
    timestamp,
    action: params.action,
  };
  if (params.userId) line.user_id = params.userId;
  if (params.error !== undefined) line.error = messageFromUnknown(params.error);
  const d = detailOnly(params.detail);
  if (d && Object.keys(d).length > 0) line.detail = d;

  const encoded = JSON.stringify(line);
  switch (params.level) {
    case "error":
      console.error(encoded);
      break;
    case "warn":
      console.warn(encoded);
      break;
    default:
      console.log(encoded);
  }
}
