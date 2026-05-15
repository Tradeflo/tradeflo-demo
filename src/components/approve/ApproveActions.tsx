"use client";

import { useState } from "react";

type Props = {
  token: string;
  canSubmit: boolean;
};

export function ApproveActions({ token, canSubmit }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<
    "approve" | "request_changes" | null
  >(null);

  async function submit(action: "approve" | "request_changes") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/approve/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(action === "request_changes" && message.trim()
              ? { message: message.trim() }
              : {}),
          }),
        },
      );

      let parsed: { error?: string } = {};
      try {
        parsed = (await res.json()) as { error?: string };
      } catch {
        /* ignore */
      }

      if (!res.ok) {
        throw new Error(
          typeof parsed.error === "string" && parsed.error
            ? parsed.error
            : `Request failed (${res.status})`,
        );
      }

      setDone(action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done === "approve") {
    return (
      <div className="success" role="status">
        <div className="success-ring">✓</div>
        <h2>Thank you</h2>
        <p>You approved this quote. The contractor has been notified.</p>
      </div>
    );
  }

  if (done === "request_changes") {
    return (
      <div className="success" role="status">
        <div className="success-ring">✓</div>
        <h2>Thanks for the feedback</h2>
        <p>
          Your change request was sent. The contractor will follow up with an
          updated quote.
        </p>
      </div>
    );
  }

  if (!canSubmit) return null;

  return (
    <div className="approval-grid">
      {error ? (
        <div
          className="error-box show"
          role="alert"
          style={{ gridColumn: "1 / -1", marginBottom: 0 }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        className="appr appr-yes"
        disabled={busy}
        onClick={() => void submit("approve")}
      >
        {busy ? "Working…" : "Approve quote"}
      </button>
      <button
        type="button"
        className="appr appr-no"
        disabled={busy}
        onClick={() => void submit("request_changes")}
      >
        Request changes
      </button>

      <div style={{ gridColumn: "1 / -1" }} className="field">
        <label htmlFor="cust-msg">
          Optional note if requesting changes
        </label>
        <textarea
          id="cust-msg"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe what you’d like adjusted…"
          disabled={busy}
        />
      </div>
    </div>
  );
}
