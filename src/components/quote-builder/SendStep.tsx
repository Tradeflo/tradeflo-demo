"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { QuoteBuilderModel } from "./useQuoteBuilderModel";
import type { DeliveryOption } from "./types";

type SendStepProps = { model: QuoteBuilderModel };

export function SendStep({ model }: SendStepProps) {
  const {
    fname,
    cemail,
    cphone,
    delivery,
    setDelivery,
    personalNote,
    setPersonalNote,
    sentDone,
    resetFlow,
    sendQuote,
    isSending,
    sendError,
    goTo,
  } = model;

  const customerName = fname.trim() || "Your customer";

  if (sentDone) {
    return (
      <div id="sent-screen" className="success">
        <div className="success-ring">✓</div>
        <h2>Quote sent.</h2>
        <p id="sent-msg">
          {customerName} has received their quote. You will be notified when
          they respond.
        </p>
        <p className="help-text" style={{ marginTop: 12 }}>
          Need changes? Go back to review, edit line items, save draft, then
          send again from here.
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            id="btn-revise-after-send"
            onClick={() => goTo(1)}
          >
            Back to review & revise
          </button>
          <button
            type="button"
            className="btn btn-primary"
            id="btn-reset"
            onClick={() => void resetFlow()}
          >
            Start a new quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="send-screen">
      <div className="card">
        <div className="card-label">Approved — ready to send</div>
        <p className="help-text">Quote approved. Choose how to deliver it.</p>
        <RadioGroup
          value={delivery}
          onValueChange={(v) => setDelivery(v as DeliveryOption)}
          className="grid gap-0"
        >
          <Label
            htmlFor="del-email"
            className={`del-opt${delivery === "email" ? " sel" : ""}`}
          >
            <RadioGroupItem value="email" id="del-email" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="del-label">Email</div>
              <div className="del-sub" id="del-email-sub">
                {cemail || "Customer email"}
              </div>
            </div>
            <span className="badge badge-green">Auto-matched</span>
          </Label>
          <Label
            htmlFor="del-sms"
            className={`del-opt${delivery === "sms" ? " sel" : ""}`}
          >
            <RadioGroupItem value="sms" id="del-sms" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="del-label">SMS</div>
              <div className="del-sub" id="del-sms-sub">
                {cphone || "Customer phone"}
              </div>
            </div>
          </Label>
          <Label
            htmlFor="del-both"
            className={`del-opt${delivery === "both" ? " sel" : ""}`}
          >
            <RadioGroupItem value="both" id="del-both" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="del-label">Email + SMS</div>
              <div className="del-sub">
                Both — recommended for high-value jobs
              </div>
            </div>
          </Label>
        </RadioGroup>
      </div>
      <div className="card">
        <div className="card-label">Personal note (optional)</div>
        <div className="field">
          <Textarea
            id="personal-note"
            placeholder="e.g. Great speaking with you. Looking forward to getting started."
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
          />
        </div>
      </div>
      {sendError ? (
        <p className="text-sm text-destructive" role="alert">
          {sendError}
        </p>
      ) : null}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary btn-full"
          id="btn-send"
          disabled={isSending}
          onClick={() => void sendQuote()}
        >
          {isSending ? "Sending…" : "Send quote to customer →"}
        </button>
      </div>
    </div>
  );
}
