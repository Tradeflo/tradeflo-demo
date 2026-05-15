import type { QuoteDraftPayloadV1 } from "@/lib/quotes/draft-payload";
import type { QuoteDeliveryEmailProps } from "@/lib/quote-delivery/email-templates";
import { normalizePhoneToE164NANP } from "@/lib/quote-delivery/phone-e164";
import { sendQuoteDeliveredEmail } from "@/lib/quote-delivery/resend-send";
import { sendQuoteDeliveredSms } from "@/lib/quote-delivery/twilio-send";

function jobSummary(payload: QuoteDraftPayloadV1): string {
  const j = payload.jobForm;
  const bits = [
    j.jobType?.trim(),
    j.scope?.trim(),
    j.address?.trim(),
  ].filter(Boolean);
  return bits.length ? bits.join(" · ").slice(0, 280) : "See quote online";
}

export async function deliverSentQuoteNotifications(input: {
  payload: QuoteDraftPayloadV1;
  approvalLink: string;
  contractorLabel: string;
  personalNoteForCustomer?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { payload, approvalLink, contractorLabel } = input;
  const delivery = payload.delivery;
  const note =
    input.personalNoteForCustomer?.trim() || payload.personalNote?.trim();

  const templateBase: QuoteDeliveryEmailProps = {
    customerFirstName: payload.fname.trim(),
    contractorLabel,
    quoteNum: payload.quoteNum.trim(),
    jobSummary: jobSummary(payload),
    approvalLink,
    personalNote: note || undefined,
  };

  const failures: string[] = [];

  if (delivery === "email" || delivery === "both") {
    const to = payload.cemail.trim();
    const r = await sendQuoteDeliveredEmail(to, templateBase);
    if (!r.ok) failures.push(`Email: ${r.error}`);
  }

  if (delivery === "sms" || delivery === "both") {
    const e164 = normalizePhoneToE164NANP(payload.cphone);
    if (!e164) {
      failures.push("SMS: Customer phone could not be formatted for SMS.");
    } else {
      const r = await sendQuoteDeliveredSms(e164, templateBase);
      if (!r.ok) failures.push(`SMS: ${r.error}`);
    }
  }

  if (failures.length) {
    return { ok: false, error: failures.join(" ") };
  }
  return { ok: true };
}

/** Returns an error message if required provider env is missing, else null. */
export function quoteDeliveryConfigError(
  delivery: QuoteDraftPayloadV1["delivery"],
): string | null {
  if (delivery === "email" || delivery === "both") {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM?.trim();
    if (!key || !from) {
      return "Email delivery requires RESEND_API_KEY and RESEND_FROM.";
    }
  }
  if (delivery === "sms" || delivery === "both") {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const ms = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
    const phone = process.env.TWILIO_PHONE_NUMBER?.trim();
    if (!sid || !token || (!ms && !phone)) {
      return "SMS delivery requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.";
    }
  }
  return null;
}
