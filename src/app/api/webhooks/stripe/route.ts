import { headers } from "next/headers";
import type Stripe from "stripe";
import {
  gracePeriodEndIsoFromNow,
  lookupUserIdByStripeCustomer,
  lookupUserIdByStripeSubscription,
  patchUserInfoByStripeCustomerId,
  updateUserBillingFromStripe,
  dataRetentionPurgeDeadlineIsoFromNow,
} from "@/lib/billing/stripe-sync";
import { captureApiRouteError } from "@/lib/observability/sentry-api";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    }
  ).subscription;
  if (typeof sub === "string") return sub.startsWith("sub_") ? sub : null;
  if (sub != null && typeof sub === "object" && "id" in sub) {
    const id = String((sub as { id: string }).id);
    return id.startsWith("sub_") ? id : null;
  }
  return null;
}

function customerIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = invoice.customer;
  const id = typeof raw === "string" ? raw : raw?.id;
  return id?.startsWith("cus_") ? id : null;
}

async function resolveUserIdForSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = subscription.metadata?.supabase_user_id?.trim();
  if (fromMeta) return fromMeta;
  const cid = subscription.customer as string;
  return lookupUserIdByStripeCustomer(admin, cid);
}

async function handlePost(request: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!whSecret) {
    return new Response("STRIPE_WEBHOOK_SECRET is not configured", {
      status: 500,
    });
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  const hdrList = await headers();
  const signature = hdrList.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, whSecret);
  } catch {
    return new Response("Stripe signature verification failed", {
      status: 400,
    });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    captureApiRouteError({
      domain: "billing",
      route: "/api/webhooks/stripe",
      error: e,
      extra: { step: "createAdminClient" },
    });
    return new Response("Server misconfigured", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userIdRaw =
          session.client_reference_id || session.metadata?.supabase_user_id;
        const userId = typeof userIdRaw === "string" ? userIdRaw.trim() : "";
        const customerRaw = session.customer;
        const customerId =
          typeof customerRaw === "string"
            ? customerRaw
            : customerRaw?.id ?? null;

        const subRaw = session.subscription;
        const subscriptionId =
          typeof subRaw === "string" ? subRaw : subRaw?.id ?? null;

        if (
          userId &&
          customerId?.startsWith("cus_") &&
          subscriptionId?.startsWith("sub_")
        ) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);

          const { error } = await updateUserBillingFromStripe(admin, {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeStatus: sub.status,
            clearGrace:
              sub.status === "active" || sub.status === "trialing",
            billingReadOnly: false,
          });
          if (error) {
            captureApiRouteError({
              domain: "billing",
              route: "/api/webhooks/stripe",
              userId,
              error: new Error(error),
              extra: { stripe_event_type: event.type },
            });
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        let userId = await resolveUserIdForSubscription(admin, sub);

        if (!userId && customerId) {
          userId = await lookupUserIdByStripeCustomer(admin, customerId);
        }
        if (!userId && customerId) {
          userId =
            await lookupUserIdByStripeSubscription(admin, sub.id);
        }

        const readOnly =
          sub.status === "canceled" ||
          sub.status === "unpaid" ||
          sub.status === "incomplete_expired";

        const clearGrace =
          sub.status === "active" || sub.status === "trialing";

        if (userId && customerId?.startsWith("cus_")) {
          const { error } = await updateUserBillingFromStripe(admin, {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.status === "canceled" ? null : sub.id,
            stripeStatus: sub.status,
            clearGrace,
            billingReadOnly: readOnly ? true : false,
            graceEndsAt: readOnly ? null : undefined,
          });
          if (error) {
            captureApiRouteError({
              domain: "billing",
              route: "/api/webhooks/stripe",
              userId,
              error: new Error(error),
              extra: { stripe_event_type: event.type },
            });
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        if (customerId?.startsWith("cus_")) {
          await patchUserInfoByStripeCustomerId(admin, customerId, {
            stripe_subscription_id: null,
            billing_subscription_status: "canceled",
            billing_grace_period_ends_at: null,
            billing_read_only: true,
            data_retention_purge_after_at:
              dataRetentionPurgeDeadlineIsoFromNow(),
          });
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = customerIdFromInvoice(invoice);
        if (customerId) {
          await patchUserInfoByStripeCustomerId(admin, customerId, {
            billing_grace_period_ends_at: null,
            billing_read_only: false,
            data_retention_purge_after_at: null,
          });
        }

        const subId = subscriptionIdFromInvoice(invoice);
        if (subId) {
          const hydrated = await stripe.subscriptions.retrieve(subId);
          const uid = await resolveUserIdForSubscription(admin, hydrated);
          if (uid && customerId) {
            await updateUserBillingFromStripe(admin, {
              userId: uid,
              stripeCustomerId: customerId,
              stripeSubscriptionId: hydrated.id,
              stripeStatus: hydrated.status,
              clearGrace: true,
              billingReadOnly: false,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = customerIdFromInvoice(invoice);
        if (!customerId) break;

        await patchUserInfoByStripeCustomerId(admin, customerId, {
          billing_subscription_status: "past_due",
          billing_grace_period_ends_at: gracePeriodEndIsoFromNow(),
          billing_read_only: false,
        });

        const subId = subscriptionIdFromInvoice(invoice);
        if (subId) {
          const hydrated = await stripe.subscriptions.retrieve(subId);
          const uid =
            (await resolveUserIdForSubscription(admin, hydrated)) ??
            (await lookupUserIdByStripeSubscription(admin, subId));
          if (uid) {
            await updateUserBillingFromStripe(admin, {
              userId: uid,
              stripeCustomerId: customerId,
              stripeSubscriptionId: hydrated.id,
              stripeStatus: hydrated.status,
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    captureApiRouteError({
      domain: "billing",
      route: "/api/webhooks/stripe",
      error: err,
      extra: { stripe_event_type: event.type },
    });
    return new Response("Webhook handler error", { status: 500 });
  }
}

export const POST = wrapRouteWithSentry(
  "POST /api/webhooks/stripe",
  "billing",
  handlePost,
);
