import { z } from "zod";

const draftPayloadSchema = z.record(z.string(), z.unknown());

export const createQuoteBodySchema = z
  .object({
    title: z.string().max(500).trim().optional(),
    payload: draftPayloadSchema.optional(),
  })
  .strict();

export type CreateQuoteBody = z.infer<typeof createQuoteBodySchema>;

export const patchQuoteBodySchema = z
  .object({
    title: z.string().max(500).trim().nullable().optional(),
    payload: draftPayloadSchema.optional(),
  })
  .strict()
  .refine(
    (b) => b.title !== undefined || b.payload !== undefined,
    { message: "Provide at least one of: title, payload" },
  );

export type PatchQuoteBody = z.infer<typeof patchQuoteBodySchema>;

export const quoteIdParamSchema = z.string().uuid();

export const quotesSendBodySchema = z
  .object({
    personalNote: z.string().max(2000).optional(),
  })
  .strict();

export type QuotesSendBody = z.infer<typeof quotesSendBodySchema>;
