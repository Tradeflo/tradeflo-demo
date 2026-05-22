import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getPublicSiteOrigin } from "@/lib/env/public-site-origin";
import { getSessionUser } from "@/lib/api/session";
import { captureApiRouteError } from "@/lib/observability/sentry-api";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Stripe Customer Billing Portal — invoices, cancel, payment method. */
async function handlePost(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const origin = getPublicSiteOrigin();
  if (!origin) {
    return jsonError(
      "Set NEXT_PUBLIC_BASE_URL for portal return URLs.",
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
  let session;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });
  } catch (e) {
    captureApiRouteError({
      domain: "billing",
      route: "/api/billing/portal",
      userId: user.id,
      error: e,
      extra: { step: "billingPortal.sessions.create" },
    });
    return jsonError("Could not open billing portal. Try again.", 502);
  }

  return jsonOk({ url: session.url });
}

export const POST = wrapRouteWithSentry(
  "POST /api/billing/portal",
  "billing",
  handlePost,
);
