import type { SupabaseClient } from "@supabase/supabase-js";

const WORK_LOGS_BUCKET = "work-logs";

/** Best-effort: remove uploaded work-log blobs under `{userId}/`. */
async function removeWorkLogsForUser(admin: SupabaseClient, userId: string) {
  for (;;) {
    const { data, error } = await admin.storage
      .from(WORK_LOGS_BUCKET)
      .list(userId, { limit: 500 });

    if (error) throw new Error(error.message);
    const names = data?.map((f) => f.name).filter(Boolean) ?? [];
    if (names.length === 0) return;

    const paths = names.map((name) => `${userId}/${name}`);
    const { error: rmErr } = await admin.storage
      .from(WORK_LOGS_BUCKET)
      .remove(paths);
    if (rmErr) throw new Error(rmErr.message);
    if (names.length < 500) return;
  }
}

/**
 * AI / quote payload purge after subscription lapse + retention window:
 * - Catalog gap rows tied to contractor
 * - Work history (`work_logs` + `work-logs` Storage blobs)
 * - All `quotes` for the user (**`quote_versions` cascade**, incl. JSON payloads such as site photos encoded in payload / job/customer fields)
 *
 * Leaves Auth, `user_info` profile, and billing Stripe fields unchanged (except deadline + `work_logs_uploaded`).
 */
async function purgeCalibrationAndQuoteHistory(admin: SupabaseClient, userId: string) {
  await admin.from("materials_catalog_gaps").delete().eq("user_id", userId);

  const { error: wlErr } = await admin
    .from("work_logs")
    .delete()
    .eq("user_id", userId);
  if (wlErr?.message) throw new Error(wlErr.message);

  await removeWorkLogsForUser(admin, userId);

  const { error: quotesErr } = await admin
    .from("quotes")
    .delete()
    .eq("user_id", userId);
  if (quotesErr?.message) throw new Error(quotesErr.message);

  const { error: patchErr } = await admin
    .from("user_info")
    .update({
      data_retention_purge_after_at: null,
      work_logs_uploaded: false,
    })
    .eq("id", userId);

  if (patchErr?.message) throw new Error(patchErr.message);
}

export type DataRetentionPurgeOutcome = {
  candidates: number;
  /** Contractors whose work logs, quotes, and catalog-gap rows were removed (login unchanged). */
  purgedUserIds: string[];
  errors: string[];
};

/**
 * For each due `user_info.data_retention_purge_after_at` (subscription ended + 90d):
 * deletes `materials_catalog_gaps`, `work_logs` + Storage, all `quotes` (cascades `quote_versions`),
 * clears deadline and sets `work_logs_uploaded` false. Profile + billing unchanged.
 */
export async function runDataRetentionPurge(
  admin: SupabaseClient,
  options?: { limit?: number },
): Promise<DataRetentionPurgeOutcome> {
  const cap = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const cutoffIso = new Date().toISOString();

  const { data: candidates, error: qErr } = await admin
    .from("user_info")
    .select("id")
    .not("data_retention_purge_after_at", "is", null)
    .lte("data_retention_purge_after_at", cutoffIso)
    .limit(cap);

  const errors: string[] = [];
  if (qErr) {
    errors.push(qErr.message);
    return {
      candidates: 0,
      purgedUserIds: [],
      errors,
    };
  }

  const ids = candidates?.map((r) => r.id as string) ?? [];
  const purgedUserIds: string[] = [];

  for (const userId of ids) {
    try {
      await purgeCalibrationAndQuoteHistory(admin, userId);
      purgedUserIds.push(userId);
    } catch (e) {
      errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    candidates: ids.length,
    purgedUserIds,
    errors,
  };
}
