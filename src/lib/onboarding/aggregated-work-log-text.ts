import type { SupabaseServer } from "@/lib/supabase/user-info";

/** Concatenate completed work-log extracts for AI context (SRS §4.5). */
export async function loadAggregatedWorkLogText(
  supabase: SupabaseServer,
  userId: string,
  maxChars = 50_000,
): Promise<string> {
  const { data, error } = await supabase
    .from("work_logs")
    .select("raw_text, uploaded_at")
    .eq("user_id", userId)
    .eq("processing_status", "complete")
    .order("uploaded_at", { ascending: false })
    .limit(25);

  if (error || !data?.length) {
    return "";
  }

  const parts: string[] = [];
  let used = 0;
  for (const row of data) {
    const t = row.raw_text?.trim();
    if (!t) continue;
    const sep = parts.length ? "\n\n---\n\n" : "";
    const add = sep + t;
    if (used + add.length > maxChars) {
      const rest = maxChars - used;
      if (rest > 0) {
        parts.push(add.slice(0, rest));
      }
      break;
    }
    parts.push(add);
    used += add.length;
  }

  return parts.join("");
}
