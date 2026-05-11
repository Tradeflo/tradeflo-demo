"use client";

import { useState } from "react";

type Action = "checkout" | "portal";

type Props = {
  hasStripeCustomer: boolean;
  primaryLabel: string;
  primaryAction: Action;
  showPortal: boolean;
};

async function startStripeFlow(action: Action): Promise<string> {
  const res = await fetch(`/api/billing/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  let parsed: { url?: unknown; error?: unknown } = {};
  try {
    parsed = (await res.json()) as { url?: unknown; error?: unknown };
  } catch {}

  if (!res.ok) {
    const msg =
      typeof parsed.error === "string" && parsed.error.trim()
        ? parsed.error
        : `Could not start ${action} (HTTP ${res.status})`;
    throw new Error(msg);
  }
  if (typeof parsed.url !== "string" || !parsed.url) {
    throw new Error("No redirect URL returned by server");
  }
  return parsed.url;
}

export function BillingActions({
  hasStripeCustomer,
  primaryLabel,
  primaryAction,
  showPortal,
}: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: Action) {
    setError(null);
    setBusy(action);
    try {
      const url = await startStripeFlow(action);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
      setBusy(null);
    }
  }

  return (
    <>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handle(primaryAction)}
          disabled={busy != null}
          aria-busy={busy === primaryAction || undefined}
        >
          {busy === primaryAction ? <span className="spinner" /> : null}
          <span>{busy === primaryAction ? "Redirecting…" : primaryLabel}</span>
        </button>

        {showPortal && hasStripeCustomer ? (
          <button
            type="button"
            className="btn"
            onClick={() => void handle("portal")}
            disabled={busy != null}
            aria-busy={busy === "portal" || undefined}
          >
            {busy === "portal" ? <span className="spinner" /> : null}
            <span>{busy === "portal" ? "Redirecting…" : "Manage billing"}</span>
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          className="error-box show"
          role="alert"
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          {error}
        </div>
      ) : null}
    </>
  );
}
