import twilio from "twilio";
import type { QuoteSmsProps } from "@/lib/quote-delivery/email-templates";
import { quoteSmsBody } from "@/lib/quote-delivery/email-templates";

export function getTwilioConfig():
  | {
      accountSid: string;
      authToken: string;
      messagingServiceSid?: string;
      fromPhone?: string;
    }
  | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid =
    process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || undefined;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim() || undefined;
  if (!accountSid || !authToken) return null;
  if (!messagingServiceSid && !fromPhone) return null;
  return { accountSid, authToken, messagingServiceSid, fromPhone };
}

export async function sendQuoteDeliveredSms(
  toE164: string,
  props: QuoteSmsProps,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = getTwilioConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "SMS delivery is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER).",
    };
  }

  try {
    const client = twilio(cfg.accountSid, cfg.authToken);
    const body = quoteSmsBody(props);

    if (cfg.messagingServiceSid) {
      await client.messages.create({
        messagingServiceSid: cfg.messagingServiceSid,
        to: toE164,
        body,
      });
    } else if (cfg.fromPhone) {
      await client.messages.create({
        from: cfg.fromPhone,
        to: toE164,
        body,
      });
    }

    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Twilio could not send the message.";
    return { ok: false, error: msg };
  }
}
