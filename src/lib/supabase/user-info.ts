import { createClient } from "@/lib/supabase/server";

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Partial update, or insert if no `user_info` row exists. */
export async function patchUserInfoOrInsert(
  supabase: SupabaseServer,
  userId: string,
  patch: Record<string, unknown>,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from("user_info")
    .update(patch)
    .eq("id", userId)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (data?.length) {
    return {};
  }

  const { error: insErr } = await supabase.from("user_info").insert({
    id: userId,
    ...patch,
  });

  return insErr ? { error: insErr.message } : {};
}
