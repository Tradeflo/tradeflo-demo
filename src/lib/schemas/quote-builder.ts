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

/** Material vs labour rows in quote_versions.payload.lines (M3). */
export const QUOTE_LINE_KIND_VALUES = ["material", "labor"] as const satisfies readonly [
  string,
  ...string[],
];

export type QuoteLineKind = (typeof QUOTE_LINE_KIND_VALUES)[number];

export const quoteLineKindSchema = z.enum(QUOTE_LINE_KIND_VALUES);

/** How labour quantity is counted when kind === "labor". */
export const QUOTE_LINE_LABOR_UNIT_VALUES = ["hour", "day", "flat"] as const satisfies readonly [
  string,
  ...string[],
];

export type QuoteLineLaborUnit = (typeof QUOTE_LINE_LABOR_UNIT_VALUES)[number];

export const quoteLineLaborUnitSchema = z.enum(QUOTE_LINE_LABOR_UNIT_VALUES);

export const quoteLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  source: quoteLinePriceSourceSchema.optional().default("estimated"),
  /** Defaults to material for drafts saved before this field existed. */
  kind: quoteLineKindSchema.optional().default("material"),
  /** Meaningful when kind is labor (defaults to hour if omitted downstream). */
  laborUnit: quoteLineLaborUnitSchema.optional(),
  /** When source is estimated (material): short category for catalog prioritization (M3). */
  catalogCategory: z.string().max(120).optional(),
});

export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;

/** Normalize persisted/API line items: default kind, labour unit for labor rows. */
export function normalizeQuoteLineItem(item: {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source?: QuoteLinePriceSource;
  kind?: QuoteLineKind;
  laborUnit?: QuoteLineLaborUnit;
  catalogCategory?: string;
}): QuoteLineItem {
  const kind = item.kind ?? "material";
  const source = item.source ?? "estimated";
  const cat =
    kind === "material" &&
    typeof item.catalogCategory === "string" &&
    item.catalogCategory.trim()
      ? item.catalogCategory.trim().slice(0, 120)
      : undefined;
  if (kind === "labor") {
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      source,
      kind: "labor",
      laborUnit: item.laborUnit ?? "hour",
    };
  }
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    source,
    kind: "material",
    ...(cat ? { catalogCategory: cat } : {}),
  };
}

export const quoteAiResponseSchema = z.object({
  lineItems: z.array(quoteLineItemSchema),
  total: z.number().optional(),
  rationale: z.string().optional(),
  notes: z.string().optional(),
});

export type QuoteAiResponse = z.infer<typeof quoteAiResponseSchema>;
