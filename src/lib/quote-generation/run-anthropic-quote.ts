import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  quoteAiResponseSchema,
  sitePhotoInputSchema,
} from "@/lib/schemas/quote-builder";
import type { z } from "zod";

export type SitePhotoInput = z.infer<typeof sitePhotoInputSchema>;

export type GeneratedLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export async function runAnthropicQuoteGeneration(input: {
  prompt: string;
  sitePhotos: SitePhotoInput[];
}): Promise<{
  lineItems: GeneratedLineItem[];
  rationale?: string;
  notes?: string;
}> {
  const imageParts = input.sitePhotos.map((p) => ({
    type: "image" as const,
    image: `data:${p.mime};base64,${p.b64}`,
  }));

  const userContent =
    imageParts.length > 0
      ? [...imageParts, { type: "text" as const, text: input.prompt }]
      : input.prompt;

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxOutputTokens: 1000,
    messages: [{ role: "user", content: userContent }],
  });

  const clean = text.replace(/```json|```/g, "").trim();
  const raw = JSON.parse(clean) as unknown;
  const validated = quoteAiResponseSchema.safeParse(raw);
  if (!validated.success) {
    const msg = validated.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Model output did not match schema: ${msg}`);
  }

  const data = validated.data;
  const lineItems = data.lineItems.map((item) => {
    const q = item.quantity || 1;
    const u = item.unitPrice || 0;
    const t = item.total ?? q * u;
    return {
      description: item.description,
      quantity: q,
      unitPrice: u,
      total: t,
    };
  });

  return {
    lineItems,
    rationale: data.rationale,
    notes: data.notes,
  };
}
