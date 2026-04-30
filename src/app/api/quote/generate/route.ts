import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api/session";
import { loadAggregatedWorkLogText } from "@/lib/onboarding/aggregated-work-log-text";
import { buildQuoteGeneratePrompt } from "@/lib/quote-generation/build-prompt";
import { runAnthropicQuoteGeneration } from "@/lib/quote-generation/run-anthropic-quote";
import { quoteGenerateRequestSchema } from "@/lib/schemas/quote-builder";
import { createClient } from "@/lib/supabase/server";
import {
  consumeQuoteAiGenerationSlot,
  QUOTE_AI_DAILY_LIMIT,
} from "@/lib/quote-ai-rate-limit";

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

  const supabase = await createClient();

  const slot = await consumeQuoteAiGenerationSlot(supabase, user.id);
  if (!slot.ok && slot.reason === "rpc") {
    return NextResponse.json(
      {
        error:
          "Could not verify AI usage limit. Apply db/quote_ai_rate_limit.sql in Supabase, or try again.",
        details: slot.message,
      },
      { status: 503 },
    );
  }
  if (!slot.ok && slot.reason === "limit") {
    return NextResponse.json(
      {
        error: `Daily limit of ${slot.limit} AI quote generations reached. Resets at midnight UTC.`,
        limit: slot.limit,
        remaining: 0,
      },
      { status: 429 },
    );
  }

  const workLogContext = await loadAggregatedWorkLogText(supabase, user.id);

  const prompt = buildQuoteGeneratePrompt({
    mode: input.mode,
    conversation: input.conversation,
    collectedSummary: input.collectedSummary,
    job: input.job,
    formVoiceTranscript: input.formVoiceTranscript,
    workLogCount: input.workLogCount,
    workLogContext,
    sitePhotoCount: input.sitePhotos.length,
  });

  try {
    const { lineItems, rationale, notes } = await runAnthropicQuoteGeneration({
      prompt,
      sitePhotos: input.sitePhotos,
    });

    return NextResponse.json({
      lineItems,
      rationale,
      notes,
      generationsRemaining: slot.remaining,
      dailyLimit: QUOTE_AI_DAILY_LIMIT,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
