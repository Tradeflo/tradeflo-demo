import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api/session";
import {
  quoteAiResponseSchema,
  quoteGenerateRequestSchema,
} from "@/lib/schemas/quote-builder";

function buildPrompt(input: {
  mode: "chat" | "form";
  conversation?: string;
  collectedSummary?: Record<string, unknown>;
  job?: Record<string, string>;
  formVoiceTranscript?: string;
  workLogCount: number;
  sitePhotoCount: number;
}): string {
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

  const hasLogs = input.workLogCount > 0;
  prompt += hasLogs
    ? `The contractor has uploaded ${input.workLogCount} work log file(s). Calibrate pricing to their real rates.`
    : "Use standard Atlantic Canada market rates.";
  if (input.sitePhotoCount > 0) {
    prompt += ` The contractor has also provided ${input.sitePhotoCount} site photo(s). Use what you can see in the images to improve quote accuracy.`;
  }
  prompt +=
    '\n\nRespond ONLY with valid JSON:\n{"lineItems":[{"description":"...","quantity":1,"unitPrice":0,"total":0}],"total":0,"rationale":"Brief pricing explanation","notes":"Important conditions"}';

  return prompt;
}

export async function POST(req: Request) {
  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = quoteGenerateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.mode === "form" && !input.job) {
    return NextResponse.json(
      { error: "job is required for form mode" },
      { status: 400 },
    );
  }

  const prompt = buildPrompt({
    mode: input.mode,
    conversation: input.conversation,
    collectedSummary: input.collectedSummary,
    job: input.job,
    formVoiceTranscript: input.formVoiceTranscript,
    workLogCount: input.workLogCount,
    sitePhotoCount: input.sitePhotos.length,
  });

  const imageParts = input.sitePhotos.map((p) => ({
    type: "image" as const,
    image: `data:${p.mime};base64,${p.b64}`,
  }));

  try {
    const userContent =
      imageParts.length > 0
        ? [...imageParts, { type: "text" as const, text: prompt }]
        : prompt;

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      maxOutputTokens: 1000,
      messages: [{ role: "user", content: userContent }],
    });

    const clean = text.replace(/```json|```/g, "").trim();
    const raw = JSON.parse(clean) as unknown;
    const validated = quoteAiResponseSchema.safeParse(raw);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Model output did not match schema", issues: validated.error.issues },
        { status: 502 },
      );
    }

    const data = validated.data;
    const lineItems = data.lineItems.map((item) => {
      const q = item.quantity || 1;
      const u = item.unitPrice || 0;
      const t = item.total ?? q * u;
      return { ...item, quantity: q, unitPrice: u, total: t };
    });

    return NextResponse.json({
      lineItems,
      rationale: data.rationale,
      notes: data.notes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
