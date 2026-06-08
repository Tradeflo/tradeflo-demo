import type { SupabaseClient, User } from "@supabase/supabase-js";
import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";

/** Contractor may use app routes while Stripe subscription exists (including payment retry states). */
export function hasContractorBillingSubscription(row: {
  stripe_subscription_id: string | null | undefined;
  billing_subscription_status: string | null | undefined;
}): boolean {
  const subId =
    typeof row.stripe_subscription_id === "string"
      ? row.stripe_subscription_id.trim()
      : "";
  if (!subId) return false;

  const status = row.billing_subscription_status;
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "unpaid"
  );
}

/**
 * HTML navigation: contractors without an active Stripe subscription go to `/billing`.
 * Admins skip; transient DB errors do not force billing.
 */
export async function contractorNeedsBillingSubscriptionRedirect(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_info")
    .select("role, stripe_subscription_id, billing_subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return false;

  if (!data) return true;

  if (bypassesLimitsFromAuthRow(data.role)) return false;

  return !hasContractorBillingSubscription(data);
}
