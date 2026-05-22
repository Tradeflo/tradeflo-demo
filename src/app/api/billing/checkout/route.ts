import type Stripe from "stripe";
import { getPublicSiteOrigin } from "@/lib/env/public-site-origin";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { captureApiRouteError } from "@/lib/observability/sentry-api";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Client-confirmed billing config (single plan launch). */
const STRIPE_TRIAL_DAYS = 14;

/**
 * Starts a Stripe Checkout subscription session. Client redirects to returned `url`.
 * Env: STRIPE_PRICE_ID (recurring Price id).
 *
 * Plan: 14-day trial (CC required), auto-converts to paid; Canadian GST/HST via Stripe Tax.
 */
async function handlePost(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) {
    return jsonError(
      "Stripe billing is not configured (STRIPE_PRICE_ID)",
      500,
    );
  }

  const origin = getPublicSiteOrigin();
  if (!origin) {
    return jsonError(
      "Set NEXT_PUBLIC_BASE_URL for checkout redirects.",
      500,
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_info")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const stripeCustomerId =
    typeof profile?.stripe_customer_id === "string" &&
    profile.stripe_customer_id.startsWith("cus_")
      ? profile.stripe_customer_id
      : undefined;

  const stripe = getStripe();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing?billing_success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing?billing_cancel=1`,
    client_reference_id: user.id,
    customer: stripeCustomerId,
    customer_email:
      !stripeCustomerId && user.email ? user.email : undefined,
    payment_method_collection: "always",
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    subscription_data: {
      trial_period_days: STRIPE_TRIAL_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      metadata: { supabase_user_id: user.id },
    },
    metadata: { supabase_user_id: user.id },
  };

  if (stripeCustomerId) {
    params.customer_update = { address: "auto", name: "auto" };
  }

  let session: Stripe.Response<Stripe.Checkout.Session>;
  try {
    session = await stripe.checkout.sessions.create(params);
  } catch (e) {
    captureApiRouteError({
      domain: "billing",
      route: "/api/billing/checkout",
      userId: user.id,
      error: e,
      extra: { step: "checkout.sessions.create" },
    });
    return jsonError("Could not start checkout. Try again or contact support.", 502);
  }

  if (!session.url) {
    captureApiRouteError({
      domain: "billing",
      route: "/api/billing/checkout",
      userId: user.id,
      error: new Error("Stripe checkout session missing redirect url"),
      extra: { step: "checkout.session.url" },
    });
    return jsonError("Could not start checkout session", 500);
  }

  return jsonOk({ url: session.url });
}

export const POST = wrapRouteWithSentry(
  "POST /api/billing/checkout",
  "billing",
  handlePost,
);
