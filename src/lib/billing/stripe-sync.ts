import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingSubscriptionStatusDb =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

function mapStripeSubscriptionStatus(status: string): BillingSubscriptionStatusDb {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "paused":
      return "past_due";
    default:
      return "none";
  }
}

/** Update profile row after Stripe subscription payloads (webhooks). */
export async function upsertStripeSubscriptionOnUserRow(
  admin: SupabaseClient,
  params: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    stripeStatus: string | null;
    /** Clear grace/read-only when subscription is usable again. */
    clearGrace?: boolean;
    billingReadOnly?: boolean;
    /** Exact ISO grace end or `null` to clear `billing_grace_period_ends_at`. */
    graceEndsAt?: string | null;
  },
) {
  const dbStatus: BillingSubscriptionStatusDb =
    params.stripeStatus != null
      ? mapStripeSubscriptionStatus(params.stripeStatus)
      : "none";

  const patch: Record<string, unknown> = {
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    billing_subscription_status: dbStatus,
  };

  if (params.clearGrace) {
    patch.billing_grace_period_ends_at = null;
    patch.billing_read_only = false;
  }
  if (params.graceEndsAt !== undefined) {
    patch.billing_grace_period_ends_at = params.graceEndsAt;
  }
  if (params.billingReadOnly !== undefined) {
    patch.billing_read_only = params.billingReadOnly;
  }

  const { error } = await admin
    .from("user_info")
    .update(patch)
    .eq("id", params.userId);

  return { error: error?.message };
}

/** Patch all rows tied to `stripe_customer_id` (typically one contractor). */
export async function patchUserInfoByStripeCustomerId(
  admin: SupabaseClient,
  stripeCustomerId: string,
  patch: Record<string, unknown>,
): Promise<{ error?: string }> {
  const { error } = await admin
    .from("user_info")
    .update(patch)
    .eq("stripe_customer_id", stripeCustomerId);

  return { error: error?.message };
}

/** Load `auth` user id for a Stripe customer/subscription linkage. */
export async function lookupUserIdByStripeCustomer(
  admin: SupabaseClient,
  stripeCustomerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("user_info")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Load user id keyed by Stripe subscription row on file. */
export async function lookupUserIdByStripeSubscription(
  admin: SupabaseClient,
  stripeSubscriptionId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("user_info")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  return data?.id ?? null;
}

export function gracePeriodEndIsoFromNow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}
