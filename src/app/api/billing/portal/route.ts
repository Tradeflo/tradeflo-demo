import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getPublicSiteOrigin } from "@/lib/env/public-site-origin";
import { getSessionUser } from "@/lib/api/session";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Stripe Customer Billing Portal — invoices, cancel, payment method. */
export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const origin = getPublicSiteOrigin(request);
  if (!origin) {
    return jsonError(
      "Set NEXT_PUBLIC_BASE_URL for portal return URLs, or use a reachable Host.",
      500,
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_info")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId =
    typeof profile?.stripe_customer_id === "string" &&
    profile.stripe_customer_id.startsWith("cus_")
      ? profile.stripe_customer_id
      : null;

  if (!customerId) {
    return jsonError(
      "No Stripe customer found. Subscribe first via checkout.",
      400,
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/billing`,
  });

  return jsonOk({ url: session.url });
}
