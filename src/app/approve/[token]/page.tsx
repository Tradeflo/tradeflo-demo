import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveActions } from "@/components/approve/ApproveActions";
import { loadPublicApprovalByToken } from "@/lib/approval/public-by-token";

import "@/components/quote-builder/quote-builder.css";

export const metadata: Metadata = {
  title: "Review quote — Tradeflo AI",
  description: "Approve or request changes on your quote.",
};

type PageProps = { params: Promise<{ token: string }> };

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function ApproveQuotePage({ params }: PageProps) {
  const { token } = await params;
  const view = await loadPublicApprovalByToken(token);

  if (!view.ok) {
    if (view.reason === "misconfigured") {
      return (
        <div className="qb-app">
          <main className="main">
            <div className="card">
              <div className="card-label">Unavailable</div>
              <p className="help-text" style={{ marginBottom: 0 }}>
                This approval link cannot be loaded right now. Ask the
                contractor to resend the quote, or try again later.
              </p>
              {process.env.NODE_ENV === "development" ? (
                <p className="help-text" style={{ fontSize: 12 }}>
                  Dev: set <code>SUPABASE_SERVICE_ROLE_KEY</code> on the server
                  so token lookups work (service role bypasses RLS).
                </p>
              ) : null}
            </div>
          </main>
        </div>
      );
    }
    notFound();
  }

  const canAct =
    view.versionStatus === "sent" && !view.consumed;

  return (
    <div className="qb-app">
      <header className="header">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          <span className="logo-dot" />
          Tradeflo AI
        </Link>
        <div className="header-right">
          <span className="header-label">Quote review</span>
        </div>
      </header>

      <div className="app">
        <main className="main">
          <div className="card">
            <div className="card-label">Your quote</div>
            <p className="help-text" style={{ marginBottom: 8 }}>
              <strong>{view.quoteNum}</strong>
              {view.sentAt ? (
                <>
                  {" "}
                  · Sent{" "}
                  {new Date(view.sentAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </>
              ) : null}
            </p>
            <p className="help-text">
              For: <strong>{view.customerDisplay}</strong>
              <br />
              {view.jobType}
              {view.address?.trim() ? (
                <>
                  <br />
                  {view.address}
                </>
              ) : null}
            </p>
          </div>

          <div className="phone-wrap">
            <div className="phone">
              <div className="phone-notch" />
              <p
                id="preview-customer"
                style={{ fontSize: 14, marginBottom: 12, color: "var(--text2)" }}
              >
                {view.jobType}
              </p>
              <table className="pq-table">
                <tbody>
                  {view.lines.map((l, i) => (
                    <tr key={`${l.description}-${i}`}>
                      <td>{l.description}</td>
                      <td>{formatMoney(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phone-total">
                <span className="phone-total-label">Total</span>
                <span className="phone-total-num">
                  {formatMoney(view.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {view.quoteNotes?.trim() ? (
            <div className="card">
              <div className="card-label">Notes</div>
              <p className="help-text" style={{ marginBottom: 0 }}>
                {view.quoteNotes}
              </p>
            </div>
          ) : null}

          {view.personalNote?.trim() ? (
            <div className="card">
              <div className="card-label">Message from your contractor</div>
              <p className="help-text" style={{ marginBottom: 0 }}>
                {view.personalNote}
              </p>
            </div>
          ) : null}

          {!canAct && view.versionStatus === "approved" ? (
            <div className="qb-banner qb-banner-muted">
              This quote was already approved. Thank you.
            </div>
          ) : null}

          {!canAct && view.versionStatus === "changes_requested" ? (
            <div className="qb-banner qb-banner-muted">
              You’ve already requested changes. The contractor will follow up.
            </div>
          ) : null}

          {!canAct && view.consumed && view.versionStatus === "sent" ? (
            <div className="qb-banner qb-banner-muted">
              This link is no longer active.
            </div>
          ) : null}

          <ApproveActions token={view.token} canSubmit={canAct} />
        </main>
        <footer className="footer">
          <span>Powered by Tradeflo AI</span>
        </footer>
      </div>
    </div>
  );
}
