import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogoutButton } from "@/components/auth/logout-button";
import { BillingActions } from "@/components/billing/BillingActions";
import { HeaderNavLinks } from "@/components/nav/HeaderNavLinks";
import { QuoteFooter } from "@/components/quote-builder/QuoteFooter";
import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";

import "@/components/quote-builder/quote-builder.css";

export const metadata: Metadata = {
  title: "Billing — Tradeflo AI",
  description: "Manage your Tradeflo AI subscription.",
};

type DbBillingStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

type BillingProfile = {
  status: DbBillingStatus;
  hasStripeCustomer: boolean;
  graceEndsAt: string | null;
  readOnly: boolean;
  limitsBypass: boolean;
};

const PLAN_NAME = "Tradeflo Pro";
const PLAN_PRICE_AMOUNT = "$49";
const PLAN_PRICE_PERIOD = "/ month CAD";
const TRIAL_DAYS = 14;

const ALL_STATUSES: ReadonlySet<DbBillingStatus> = new Set([
  "none",
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
]);

function asDbStatus(value: unknown): DbBillingStatus {
  return typeof value === "string" && ALL_STATUSES.has(value as DbBillingStatus)
    ? (value as DbBillingStatus)
    : "none";
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type PillStyle = {
  label: string;
  /** "green" | "amber" | "blue" | "red" | "muted". */
  tone: "green" | "amber" | "blue" | "red" | "muted";
};

function statusPill(status: DbBillingStatus): PillStyle {
  switch (status) {
    case "trialing":
      return { label: "Trial active", tone: "blue" };
    case "active":
      return { label: "Active", tone: "green" };
    case "past_due":
      return { label: "Payment failed", tone: "amber" };
    case "incomplete":
      return { label: "Payment pending", tone: "amber" };
    case "unpaid":
    case "incomplete_expired":
    case "canceled":
      return { label: "Subscription ended", tone: "red" };
    default:
      return { label: "No subscription", tone: "muted" };
  }
}

const PILL_STYLE: Record<PillStyle["tone"], React.CSSProperties> = {
  green: {
    background: "var(--green-bg)",
    color: "var(--green)",
    border: "1px solid var(--green-border)",
  },
  amber: {
    background: "var(--amber-bg)",
    color: "var(--amber)",
    border: "1px solid var(--amber-border)",
  },
  blue: {
    background: "var(--blue-bg)",
    color: "var(--blue)",
    border: "1px solid var(--blue-border)",
  },
  red: {
    background: "var(--red-bg)",
    color: "var(--red)",
    border: "1px solid var(--red-border)",
  },
  muted: {
    background: "var(--surface)",
    color: "var(--text2)",
    border: "1px solid var(--border)",
  },
};

function decideAction(profile: BillingProfile): {
  primaryLabel: string;
  primaryAction: "checkout" | "portal";
  showPortal: boolean;
} {
  if (!profile.hasStripeCustomer) {
    return {
      primaryLabel: `Start ${TRIAL_DAYS}-day free trial`,
      primaryAction: "checkout",
      showPortal: false,
    };
  }
  if (profile.status === "active" || profile.status === "trialing") {
    return {
      primaryLabel: "Manage billing",
      primaryAction: "portal",
      showPortal: false,
    };
  }
  if (profile.status === "past_due" || profile.status === "incomplete") {
    return {
      primaryLabel: "Update payment method",
      primaryAction: "portal",
      showPortal: false,
    };
  }
  return {
    primaryLabel: "Resubscribe",
    primaryAction: "checkout",
    showPortal: true,
  };
}

async function loadBillingProfile(
  account: Pick<User, "id" | "email">,
): Promise<BillingProfile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_info")
    .select(
      "stripe_customer_id, billing_subscription_status, billing_grace_period_ends_at, billing_read_only, role",
    )
    .eq("id", account.id)
    .maybeSingle();

  const customerId =
    typeof data?.stripe_customer_id === "string" &&
      data.stripe_customer_id.startsWith("cus_")
      ? data.stripe_customer_id
      : null;

  return {
    status: asDbStatus(data?.billing_subscription_status),
    hasStripeCustomer: customerId != null,
    graceEndsAt:
      typeof data?.billing_grace_period_ends_at === "string"
        ? data.billing_grace_period_ends_at
        : null,
    readOnly: data?.billing_read_only === true,
    limitsBypass: bypassesLimitsFromAuthRow(data?.role, account.email),
  };
}

const FEATURES: ReadonlyArray<string> = [
  "Unlimited quotes, drafts, and saved customers",
  "Up to 20 AI quote generations per day",
  "Email + SMS delivery to your customers",
  "PDF export with Tradeflo branding",
  "GST/HST handled by Stripe Tax",
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing_success?: string; billing_cancel?: string }>;
}) {
  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login?next=/billing");
  }

  const profile = await loadBillingProfile(user);
  const action = decideAction(profile);
  const pill = statusPill(profile.status);
  const sp = await searchParams;

  const graceEndsLabel = formatDate(profile.graceEndsAt);
  const graceEndsInFuture =
    profile.graceEndsAt != null &&
    !Number.isNaN(Date.parse(profile.graceEndsAt)) &&
    Date.parse(profile.graceEndsAt) > Date.now();

  const showSuccessBanner = sp.billing_success === "1";
  const showCancelBanner = sp.billing_cancel === "1";

  return (
    <div className="qb-app">
      {showSuccessBanner ? (
        <div
          className="qb-banner"
          style={{
            background: "var(--green-bg)",
            color: "var(--green)",
            borderColor: "var(--green-border)",
          }}
        >
          Subscription started — your status will refresh in a moment.
        </div>
      ) : null}
      {showCancelBanner ? (
        <div className="qb-banner qb-banner-muted">
          Checkout cancelled. No charge was made.
        </div>
      ) : null}

      <header className="header">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          <span className="logo-dot" />
          Tradeflo AI
        </Link>
        <div className="header-right">
          <span className="header-label">Billing</span>
          <HeaderNavLinks />
          <LogoutButton />
        </div>
      </header>

      <div className="app">
        <main className="main">
          {profile.readOnly && !profile.limitsBypass ? (
            <div
              className="card"
              role="alert"
              style={{
                background: "var(--red-bg)",
                borderColor: "var(--red-border)",
              }}
            >
              <div
                className="card-label"
                style={{
                  color: "var(--red)",
                  borderBottomColor: "var(--red-border)",
                }}
              >
                Account is read-only
              </div>
              <p className="help-text" style={{ marginBottom: 0 }}>
                Your billing grace period has ended, so editing and sending
                quotes are paused. Update your payment method to restore full
                access.
              </p>
            </div>
          ) : null}

          {profile.limitsBypass ? (
            <div
              className="card"
              role="status"
              style={{
                background: "var(--blue-bg)",
                borderColor: "var(--blue-border)",
              }}
            >
              <div
                className="card-label"
                style={{
                  color: "var(--blue)",
                  borderBottomColor: "var(--blue-border)",
                }}
              >
                Operator access
              </div>
              <p className="help-text" style={{ marginBottom: 0 }}>
                Your account skips subscription read-only locks and AI quote
                daily limits for product use (admin role or bootstrap email).
              </p>
            </div>
          ) : null}

          {!profile.limitsBypass &&
            !profile.readOnly &&
            profile.status === "past_due" &&
            graceEndsInFuture ? (
            <div
              className="card"
              role="status"
              style={{
                background: "var(--amber-bg)",
                borderColor: "var(--amber-border)",
              }}
            >
              <div
                className="card-label"
                style={{
                  color: "var(--amber)",
                  borderBottomColor: "var(--amber-border)",
                }}
              >
                Payment failed — grace period
              </div>
              <p className="help-text" style={{ marginBottom: 0 }}>
                Your last payment didn’t go through. We’ll keep your account
                active until <strong>{graceEndsLabel}</strong>. After that, the
                account moves to read-only until payment succeeds.
              </p>
            </div>
          ) : null}

          <div className="card">
            <div
              className="card-label"
              style={{ justifyContent: "space-between" }}
            >
              <span>Subscription</span>
              <span
                className="badge"
                style={PILL_STYLE[pill.tone]}
              >
                {pill.label}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text2)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {PLAN_NAME}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 600,
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {PLAN_PRICE_AMOUNT}
              </span>
              <span style={{ fontSize: 14, color: "var(--text2)" }}>
                {PLAN_PRICE_PERIOD}
              </span>
              <span
                className="badge"
                style={PILL_STYLE.green}
              >
                {TRIAL_DAYS}-day free trial
              </span>
            </div>

            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 8,
                marginBottom: 4,
              }}
            >
              {FEATURES.map((f) => (
                <li
                  key={f}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: 14,
                    color: "var(--text)",
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      flexShrink: 0,
                      marginTop: 2,
                      background: "var(--green-bg)",
                      color: "var(--green)",
                      border: "1px solid var(--green-border)",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <BillingActions
              hasStripeCustomer={profile.hasStripeCustomer}
              primaryLabel={action.primaryLabel}
              primaryAction={action.primaryAction}
              showPortal={action.showPortal}
            />

            <p
              style={{
                fontSize: 12,
                color: "var(--text3)",
                marginTop: 14,
                lineHeight: 1.6,
              }}
            >
              Payments and invoices handled by Stripe. By starting your trial
              you agree to our{" "}
              <Link href="/terms" style={{ color: "var(--text2)" }}>
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" style={{ color: "var(--text2)" }}>
                privacy policy
              </Link>
              .
            </p>
          </div>

          <div className="card">
            <div className="card-label">How billing works</div>
            <dl
              style={{
                margin: 0,
                display: "grid",
                gap: 12,
              }}
            >
              <BillingFact
                term="Trial"
                detail={`${TRIAL_DAYS} days free. Card required at signup; you’re only charged when the trial ends unless you cancel first.`}
              />
              <BillingFact
                term="Failed payment"
                detail="Stripe retries up to 3 times over ~7 days. Your account moves to read-only after the grace period."
              />
              <BillingFact
                term="Cancellation"
                detail="Cancel any time from “Manage billing.” You keep access until the end of the current billing period."
              />
              <BillingFact
                term="Refunds"
                detail="Handled case-by-case — please contact support if you need help."
              />
            </dl>
          </div>
        </main>
        <QuoteFooter />
      </div>
    </div>
  );
}

function BillingFact({ term, detail }: { term: string; detail: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 16,
        alignItems: "baseline",
      }}
    >
      <dt
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text3)",
        }}
      >
        {term}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--text)",
          lineHeight: 1.6,
        }}
      >
        {detail}
      </dd>
    </div>
  );
}
