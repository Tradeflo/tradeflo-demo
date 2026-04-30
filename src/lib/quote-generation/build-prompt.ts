import type { QuoteGenerateRequest } from "@/lib/schemas/quote-builder";

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
  prompt +=
    'Respond ONLY with valid JSON:\n{"lineItems":[{"description":"...","quantity":1,"unitPrice":0,"total":0}],"total":0,"rationale":"Brief pricing explanation","notes":"Important conditions"}';

  return prompt;
}
