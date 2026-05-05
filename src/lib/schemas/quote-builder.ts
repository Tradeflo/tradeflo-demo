import { z } from "zod";

export const customerSchema = z.object({
  fname: z.string().min(1, "First name is required"),
  lname: z.string().min(1, "Last name is required"),
  cemail: z.string().email("Valid email required"),
  cphone: z.string().min(1, "Phone is required"),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

export const jobFormSchema = z.object({
  jobType: z.string().min(1),
  propertyType: z.string().min(1),
  sqft: z.string(),
  scope: z.string(),
  address: z.string(),
  startWin: z.string(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const sitePhotoInputSchema = z.object({
  b64: z.string(),
  mime: z.string(),
});

export const quoteGenerateRequestSchema = z.object({
  mode: z.enum(["chat", "form"]),
  conversation: z.string().optional(),
  collectedSummary: z.record(z.string(), z.unknown()).optional(),
  job: jobFormSchema.optional(),
  formVoiceTranscript: z.string().optional(),
  sitePhotos: z.array(sitePhotoInputSchema).default([]),
  workLogCount: z.number().int().min(0).default(0),
});

export type QuoteGenerateRequest = z.infer<typeof quoteGenerateRequestSchema>;

/** SRS M3: how each line unit price was chosen (persisted + AI schema). */
export const QUOTE_LINE_PRICE_SOURCE_VALUES = [
  "industry_average",
  "estimated",
  "your_rate",
] as const satisfies readonly [string, ...string[]];

export type QuoteLinePriceSource =
  (typeof QUOTE_LINE_PRICE_SOURCE_VALUES)[number];

export const quoteLinePriceSourceSchema = z.enum(
  QUOTE_LINE_PRICE_SOURCE_VALUES,
);

export const quoteLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  source: quoteLinePriceSourceSchema.optional().default("estimated"),
});

export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;

export const quoteAiResponseSchema = z.object({
  lineItems: z.array(quoteLineItemSchema),
  total: z.number().optional(),
  rationale: z.string().optional(),
  notes: z.string().optional(),
});

export type QuoteAiResponse = z.infer<typeof quoteAiResponseSchema>;
