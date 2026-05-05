import { Resend } from "resend";
import type { QuoteDeliveryEmailProps } from "@/lib/quote-delivery/email-templates";
import {
  quoteEmailHtml,
  quoteEmailSubject,
} from "@/lib/quote-delivery/email-templates";

export function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendQuoteDeliveredEmail(
  toEmail: string,
  props: QuoteDeliveryEmailProps,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = getResendConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "Email delivery is not configured (RESEND_API_KEY and RESEND_FROM).",
    };
  }

  try {
    const resend = new Resend(cfg.apiKey);
    const { error } = await resend.emails.send({
      from: cfg.from,
      to: [toEmail.trim()],
      subject: quoteEmailSubject(props),
      html: quoteEmailHtml(props),
    });

    if (error) {
      return {
        ok: false,
        error:
          typeof error.message === "string"
            ? error.message
            : "Resend rejected the send request.",
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resend send failed.";
    return { ok: false, error: msg };
  }
}
