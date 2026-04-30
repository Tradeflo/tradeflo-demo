import type { QuoteDraftPayloadV1 } from "@/lib/quotes/draft-payload";
import { z } from "zod";

const customerEmailSchema = z.email();

/** `null` if OK; otherwise a human-readable validation message. */
export function quoteSendValidationError(d: QuoteDraftPayloadV1): string | null {
  if (!d.lines.length) {
    return "Add at least one line item before sending.";
  }
  const total = d.lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0);
  if (total <= 0) {
    return "Quote total must be greater than zero.";
  }

  const email = d.cemail.trim();
  const phone = d.cphone.trim();

  if (d.delivery === "email" || d.delivery === "both") {
    if (!email) {
      return "Customer email is required for email delivery.";
    }
    if (!customerEmailSchema.safeParse(email).success) {
      return "Enter a valid customer email.";
    }
  }
  if (d.delivery === "sms" || d.delivery === "both") {
    if (!phone) {
      return "Customer phone is required for SMS delivery.";
    }
  }

  return null;
}
