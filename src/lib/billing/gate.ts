import type { User } from "@supabase/supabase-js";
import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";
import { jsonError } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";

/**
 * True when mutating product actions should be blocked (SRS: post–grace read-only).
 * Admins (`user_info.role = admin`) and bootstrap emails bypass.
 */
export async function billingBlocksMutations(
  account: Pick<User, "id" | "email">,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_info")
    .select("billing_read_only, billing_grace_period_ends_at, role")
    .eq("id", account.id)
    .maybeSingle();

  if (error || !data) return false;

  if (bypassesLimitsFromAuthRow(data.role, account.email)) {
    return false;
  }

  if (data.billing_read_only === true) return true;

  const grace = data.billing_grace_period_ends_at;
  if (
    typeof grace === "string" &&
    grace.trim() &&
    !Number.isNaN(Date.parse(grace))
  ) {
    if (Date.now() >= Date.parse(grace)) return true;
  }

  return false;
}

/** Returns a 402 response when billing blocks writes; otherwise `null`. */
export async function billingMutationBlockedResponse(
  account: Pick<User, "id" | "email">,
): Promise<Response | null> {
  const blocked = await billingBlocksMutations(account);
  if (!blocked) return null;
  return jsonError(
    "Your subscription is in read-only mode after the billing grace period. Update payment in billing to continue.",
    402,
  );
}
