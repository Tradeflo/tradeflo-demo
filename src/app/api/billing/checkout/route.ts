import type Stripe from "stripe";
import { getPublicSiteOrigin } from "@/lib/env/public-site-origin";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Starts a Stripe Checkout subscription session. Client redirects to returned `url`.
 * Env: STRIPE_PRICE_ID (recurring Price id).
 */
export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) {
    return jsonError(
      "Stripe billing is not configured (STRIPE_PRICE_ID)",
      500,
    );
  }

  const origin = getPublicSiteOrigin(request);
  if (!origin) {
    return jsonError(
      "Set NEXT_PUBLIC_BASE_URL for checkout redirects, or use a reachable Host.",
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
    success_url: `${origin}/?billing_success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?billing_cancel=1`,
    client_reference_id: user.id,
    customer: stripeCustomerId,
    customer_email:
      !stripeCustomerId && user.email ? user.email : undefined,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    metadata: { supabase_user_id: user.id },
  };

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    return jsonError("Could not start checkout session", 500);
  }

  return jsonOk({ url: session.url });
}
