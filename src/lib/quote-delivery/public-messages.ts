import type { QuoteDraftPayloadV1 } from "@/lib/quotes/draft-payload";

/**
 * Client-safe copy when send fails after DB was marked sent — never expose vendor errors.
 */
export function quoteDeliveryFailureMessageForClient(): string {
  return (
    "We couldn't deliver the quote. It was returned to draft. " +
    "Check the customer's email and phone, confirm this app's email and text settings with your administrator, then try again."
  );
}

/** Replace env-var-heavy preflight errors (503) with contractor-friendly text. */
export function quoteDeliveryConfigMessageForClient(
  delivery: QuoteDraftPayloadV1["delivery"],
): string {
  if (delivery === "email") {
    return (
      "Email sending isn't configured for this app yet. " +
      "Ask your administrator to finish email delivery setup, then try again."
    );
  }
  if (delivery === "sms") {
    return (
      "Text messaging isn't configured for this app yet. " +
      "Ask your administrator to finish SMS setup, then try again."
    );
  }
  return (
    "Email and text sending aren't fully configured for this app yet. " +
    "Ask your administrator to finish delivery setup, then try again."
  );
}
