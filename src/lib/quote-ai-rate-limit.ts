import type { SupabaseServer } from "@/lib/supabase/user-info";

/** SRS §4.7 — enforced via Postgres RPC `consume_quote_ai_generation` (see db/quote_ai_rate_limit.sql). */
export const QUOTE_AI_DAILY_LIMIT = 20;

type RpcPayload = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

function asRpcPayload(data: unknown): RpcPayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (typeof o.allowed !== "boolean") return null;
  const remaining = Number(o.remaining);
  const limit = Number(o.limit);
  if (!Number.isFinite(remaining) || !Number.isFinite(limit)) return null;
  return { allowed: o.allowed, remaining, limit };
}

export type ConsumeQuoteAiSlotResult =
  | { ok: true; remaining: number; limit: number }
  | { ok: false; reason: "limit"; limit: number }
  | { ok: false; reason: "rpc"; message: string };

/** Atomically reserves one daily slot (RPC: `public.consume_quote_ai_generation`). */
export async function consumeQuoteAiGenerationSlot(
  supabase: SupabaseServer,
  userId: string,
): Promise<ConsumeQuoteAiSlotResult> {
  const { data, error } = await supabase.rpc("consume_quote_ai_generation", {
    p_user_id: userId,
    p_limit: QUOTE_AI_DAILY_LIMIT,
  });

  if (error) {
    return { ok: false, reason: "rpc", message: error.message };
  }

  const payload = asRpcPayload(data);
  if (!payload) {
    return {
      ok: false,
      reason: "rpc",
      message: "Invalid rate limit response from database",
    };
  }

  if (!payload.allowed) {
    return { ok: false, reason: "limit", limit: payload.limit };
  }

  return {
    ok: true,
    remaining: payload.remaining,
    limit: payload.limit,
  };
}
