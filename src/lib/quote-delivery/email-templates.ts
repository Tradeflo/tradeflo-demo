import { escapeHtml } from "@/lib/quote-delivery/escape-html";

export type QuoteDeliveryEmailProps = {
  customerFirstName: string;
  contractorLabel: string;
  quoteNum: string;
  jobSummary: string;
  approvalLink: string;
  personalNote?: string;
};

export function quoteEmailSubject(props: QuoteDeliveryEmailProps): string {
  return `Quote ${props.quoteNum.trim() || "(draft)"} from ${props.contractorLabel.trim()}`;
}

export function quoteEmailHtml(props: QuoteDeliveryEmailProps): string {
  const name = escapeHtml(props.customerFirstName.trim() || "there");
  const from = escapeHtml(props.contractorLabel.trim() || "Your contractor");
  const qnum = escapeHtml(props.quoteNum.trim() || "");
  const job = escapeHtml(props.jobSummary.trim() || "(see link)");
  const link = escapeHtml(props.approvalLink.trim());
  const note = props.personalNote?.trim()
    ? `<p style="margin:16px 0 0;line-height:1.5">${escapeHtml(props.personalNote.trim())}</p>`
    : "";

  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${name},</p>
<p><strong>${from}</strong> has sent you a quote (${qnum ? `Quote #${qnum}` : "attached details"}).</p>
<p><strong>Job:</strong> ${job}</p>
${note}
<p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1a1916;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View &amp; respond to quote</a></p>
<p style="font-size:14px;color:#555">Or open this link: <a href="${link}">${link}</a></p>
<p style="font-size:14px;color:#555;margin-top:32px">This link takes you to a secure page — no login required.</p>
</body></html>`.trim();
}

export type QuoteSmsProps = Omit<QuoteDeliveryEmailProps, never>;

export function quoteSmsBody(props: QuoteSmsProps): string {
  const from = props.contractorLabel.trim() || "Contractor";
  const qnum = props.quoteNum.trim();
  const line = qnum ? `${from} sent you quote ${qnum}. ` : `${from} sent you a quote. `;
  return `${line}Open to review & approve: ${props.approvalLink.trim()}`.slice(
    0,
    1600,
  );
}
