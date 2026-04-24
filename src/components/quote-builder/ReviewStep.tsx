"use client";

import type { QuoteBuilderModel } from "./useQuoteBuilderModel";
import { VoiceBar } from "./VoiceBar";

type ReviewStepProps = { model: QuoteBuilderModel };

export function ReviewStep({ model }: ReviewStepProps) {
  const {
    quoteLoading,
    loadingText,
    quoteError,
    lines,
    updateLine,
    removeLine,
    addLine,
    totalAmount,
    aiRationale,
    quoteNotes,
    setQuoteNotes,
    goTo,
    workLogs,
    editVoiceTranscript,
    setEditVoiceTranscript,
  } = model;

  return (
    <>
      <div
        className="card"
        id="quote-loading"
        style={{ display: quoteLoading ? "block" : "none" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "4px 0",
          }}
        >
          <div className="spinner" />
          <span style={{ fontSize: 15, color: "var(--text2)" }}>
            {loadingText}
          </span>
        </div>
      </div>

      <div
        id="quote-body"
        style={{ display: quoteLoading ? "none" : "block" }}
      >
        <div className="card">
          <div className="card-label">
            Line items
            {workLogs.length > 0 ? (
              <span className="badge badge-green" id="calib-badge">
                Work log calibrated
              </span>
            ) : null}
            <span className="badge badge-blue">AI generated</span>
          </div>
          <div className="ql-head">
            <span>Description</span>
            <span style={{ textAlign: "center" }}>Qty</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span />
          </div>
          <div id="line-items">
            {lines.map((line, idx) => (
              <div key={idx} className="ql">
                <input
                  value={line.description}
                  onChange={(e) =>
                    updateLine(idx, { description: e.target.value })
                  }
                />
                <input
                  type="number"
                  value={line.quantity}
                  style={{ textAlign: "center" }}
                  onChange={(e) =>
                    updateLine(idx, { quantity: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  value={line.unitPrice}
                  style={{ textAlign: "right" }}
                  onChange={(e) =>
                    updateLine(idx, { unitPrice: Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  className="ql-del"
                  aria-label="Remove line"
                  onClick={() => removeLine(idx)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn"
            id="btn-addline"
            style={{ fontSize: 13, padding: "9px 16px", marginTop: 8 }}
            onClick={addLine}
          >
            + Add line
          </button>
          <div className="total-bar">
            <span
              style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}
            >
              Estimated total
            </span>
            <span className="total-num">
              ${Math.round(totalAmount).toLocaleString()}
            </span>
          </div>
        </div>

        <div
          className={`ai-rationale${aiRationale ? " show" : ""}`}
          id="ai-rationale"
        >
          {aiRationale}
        </div>

        <div className="card kent-card">
          <div
            className="card-label"
            style={{
              borderBottomColor: "var(--amber-border)",
              color: "var(--amber)",
            }}
          >
            Supplier pricing — Kent Building Supplies
            <span className="badge badge-amber">Coming soon</span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--amber)",
              lineHeight: 1.6,
              marginBottom: 14,
              opacity: 0.9,
            }}
          >
            Live material pricing from Kent will be pulled automatically each
            day and applied directly to your quotes.
          </p>
          <table className="kent-table">
            <thead>
              <tr>
                <th>Material</th>
                <th style={{ textAlign: "right" }}>Unit</th>
                <th style={{ textAlign: "right" }}>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>James Hardie HardiePlank Siding</td>
                <td style={{ textAlign: "right", color: "var(--text3)" }}>
                  lin ft
                </td>
                <td>$4.87</td>
              </tr>
              <tr>
                <td>OSB Sheathing 7/16 in. 4x8</td>
                <td style={{ textAlign: "right", color: "var(--text3)" }}>
                  sheet
                </td>
                <td>$22.47</td>
              </tr>
              <tr>
                <td>Tyvek HomeWrap 9ft x 100ft</td>
                <td style={{ textAlign: "right", color: "var(--text3)" }}>
                  roll
                </td>
                <td>$87.50</td>
              </tr>
              <tr>
                <td>2x6 KD SPF Framing Lumber 12ft</td>
                <td style={{ textAlign: "right", color: "var(--text3)" }}>
                  each
                </td>
                <td>$11.47</td>
              </tr>
            </tbody>
          </table>
          <p
            style={{
              fontSize: 12,
              color: "var(--amber)",
              marginTop: 12,
              opacity: 0.75,
            }}
          >
            Pending supplier integration. Live sync applies automatically once
            partnership is confirmed.
          </p>
        </div>

        <div className="card">
          <div className="card-label">Notes on quote</div>
          <div className="field">
            <textarea
              id="quote-notes"
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-label">Edit with voice</div>
          <p className="help-text">
            Say something like &quot;Remove the scaffolding line&quot; or
            &quot;Change labour to $2,800&quot;
          </p>
          <VoiceBar
            idleLabel="Tap to record edit"
            onFinal={(text) => {
              setEditVoiceTranscript(
                `Edit received: "${text}" — in the live app this applies automatically via AI.`,
              );
            }}
          />
          <div
            className={`voice-transcript${editVoiceTranscript ? " show" : ""}`}
            id="edit-voice-transcript"
          >
            {editVoiceTranscript}
          </div>
        </div>

        <div className={`error-box${quoteError ? " show" : ""}`} id="quote-error">
          {quoteError}
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            id="btn-to-preview"
            onClick={() => goTo(2)}
          >
            Send to client for approval →
          </button>
          <button
            type="button"
            className="btn"
            id="btn-back-intake"
            onClick={() => goTo(0)}
          >
            Back
          </button>
        </div>
      </div>
    </>
  );
}
