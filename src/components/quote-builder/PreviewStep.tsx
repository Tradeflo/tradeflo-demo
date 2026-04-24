"use client";

import type { QuoteBuilderModel } from "./useQuoteBuilderModel";

type PreviewStepProps = { model: QuoteBuilderModel };

export function PreviewStep({ model }: PreviewStepProps) {
  const {
    fname,
    lname,
    collectedJobData,
    quoteNum,
    quoteNotes,
    lines,
    totalAmount,
    goTo,
    showChangeBox,
    setShowChangeBox,
    changeText,
    setChangeText,
  } = model;

  const name = `${fname} ${lname}`.trim() || "Customer";
  const job =
    (collectedJobData.jobType as string) ||
    (collectedJobData.jobSummary as string) ||
    "Job quote";

  return (
    <>
      <p className="help-text">
        This is exactly what your client sees on their phone. One tap to
        approve and it goes straight to them.
      </p>
      <div className="phone-wrap">
        <div className="phone">
          <div className="phone-notch" />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--text3)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Quote ready
            </span>
            <span className="badge badge-amber">Pending approval</span>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 2,
            }}
          >
            Your Business
          </div>
          <div
            style={{ fontSize: 12, color: "var(--text3)" }}
            id="preview-ref"
          >
            Quote #{quoteNum}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text2)",
              margin: "12px 0 16px",
              padding: 12,
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              lineHeight: 1.6,
              border: "1px solid var(--border)",
            }}
            id="preview-customer"
          >
            For: {name}
            <br />
            {job}
          </div>
          <table className="pq-table" id="pq-table">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>
                    $
                    {Math.round(
                      l.total || l.quantity * l.unitPrice,
                    ).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="phone-total">
            <span className="phone-total-label">Total estimate</span>
            <span className="phone-total-num" id="pq-total">
              ${Math.round(totalAmount).toLocaleString()}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text3)",
              marginBottom: 16,
              lineHeight: 1.6,
            }}
            id="preview-notes"
          >
            {quoteNotes}
          </div>
          <div className="approval-grid">
            <button
              type="button"
              className="appr appr-yes"
              id="btn-approve"
              onClick={() => goTo(3)}
            >
              Approve & send
            </button>
            <button
              type="button"
              className="appr appr-no"
              id="btn-req-change"
              onClick={() => setShowChangeBox((v) => !v)}
            >
              Request changes
            </button>
          </div>
        </div>
      </div>
      {showChangeBox ? (
        <div id="change-box">
          <div className="card">
            <div className="card-label">Client change request</div>
            <div className="field">
              <textarea
                id="change-text"
                placeholder="Describe what needs to change..."
                value={changeText}
                onChange={(e) => setChangeText(e.target.value)}
              />
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                id="btn-sub-change"
                onClick={() => {
                  alert(
                    "Change request submitted. In the live app this notifies the contractor and triggers a revised quote.",
                  );
                  setShowChangeBox(false);
                }}
              >
                Submit change request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
