import type { QuoteGenerateRequest } from "@/lib/schemas/quote-builder";
import type { MaterialsPricingContext } from "@/lib/quote-generation/materials-pricing-context";

export type BuildQuotePromptInput = Pick<
  QuoteGenerateRequest,
  | "mode"
  | "conversation"
  | "collectedSummary"
  | "job"
  | "formVoiceTranscript"
  | "workLogCount"
> & {
  workLogContext: string;
  sitePhotoCount: number;
  materialsPricing: MaterialsPricingContext;
};

export function buildQuoteGeneratePrompt(input: BuildQuotePromptInput): string {
  let prompt = "";
  if (input.mode === "chat") {
    prompt =
      "You are an expert estimator for trades businesses in Atlantic Canada. Generate an accurate quote based on this conversation.\n\nCONVERSATION:\n" +
      (input.conversation ?? "") +
      "\n\nSUMMARY:\n" +
      JSON.stringify(input.collectedSummary ?? {}) +
      "\n\n";
  } else {
    const d = {
      ...input.job,
      voiceNote: input.formVoiceTranscript ?? "",
    };
    prompt =
      "You are an expert estimator for trades businesses in Atlantic Canada. Generate an accurate quote for this job.\n\nJOB DETAILS:\n" +
      JSON.stringify(d) +
      "\n\n";
  }

  const ctx = input.workLogContext.trim();
  if (ctx.length > 0) {
    prompt +=
      "CONTRACTOR WORK HISTORY (extracted text from uploaded invoices/quotes; use as structured pricing context—SRS data flow only, not guaranteed calibration):\n" +
      ctx +
      "\n\n";
  } else if (input.workLogCount > 0) {
    prompt += `The contractor indicated ${input.workLogCount} work log file(s) in this session (text not loaded from storage). Prefer typical job patterns from the trade and region.\n\n`;
  } else {
    prompt += "Use standard Atlantic Canada market rates.\n\n";
  }

  if (input.sitePhotoCount > 0) {
    prompt += `The contractor has also provided ${input.sitePhotoCount} site photo(s). Use what you can see in the images to improve quote accuracy.\n\n`;
  }

  const mp = input.materialsPricing;
  const markupPct = mp.profileMarkupPercent;
  prompt += "MATERIAL PRICING (reference retail + optional profile markup):\n";
  prompt += `- Contractor trade (for catalog filter): ${mp.trade ?? "(not set — no catalog lookup)"}\n`;
  if (markupPct != null) {
    prompt += `- Contractor materials markup on file: ${markupPct}% (applied on top of reference retail below).\n`;
    prompt +=
      `- For each material line matched to reference data below: unit price = round to 2 decimals: (base_retail_price × (1 + markup/100)) per catalog unit; set "source" to "industry_average".\n`;
  } else {
    prompt +=
      `- No contractor materials markup stored on profile yet. For each material line matched to reference data below: use unit price = round(base_retail_price, 2) per catalog unit (no uplift); set "source" to "industry_average".\n`;
  }
  prompt += `- If no catalog row fits: estimate price from context and set "source" to "estimated".\n`;
  prompt +=
    `- Use "your_rate" for labour or when pricing clearly follows the contractor work history narrative (not catalogue retail).\n`;

  if (mp.catalog.length === 0) {
    prompt +=
      "- Reference catalog for this trade: (empty — client-maintained DB not populated yet). Use estimated material pricing.\n\n";
  } else {
    prompt +=
      (markupPct != null
        ? "- Reference retail rows (JSON). base_retail_price is before markup; apply markup above.\n"
        : "- Reference retail rows (JSON). Use base_retail_price as sell price when matched (see rules above).\n") +
      JSON.stringify(mp.catalog) +
      "\n\n";
  }

  prompt +=
    'Respond ONLY with valid JSON:\n{"lineItems":[{"description":"...","quantity":1,"unitPrice":0,"total":0,"source":"estimated"}],"total":0,"rationale":"Brief pricing explanation","notes":"Important conditions"}';

  return prompt;
}
