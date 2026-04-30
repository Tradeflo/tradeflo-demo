import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { formatQuoteResponse } from "@/lib/api/quotes-format";
import type { QuoteWithVersionRows } from "@/lib/api/quotes-format";
import { getSessionUser } from "@/lib/api/session";
import { loadAggregatedWorkLogText } from "@/lib/onboarding/aggregated-work-log-text";
import { parseQuoteDraftPayload } from "@/lib/quotes/draft-payload";
import { buildQuoteGeneratePrompt } from "@/lib/quote-generation/build-prompt";
import { runAnthropicQuoteGeneration } from "@/lib/quote-generation/run-anthropic-quote";
import {
  consumeQuoteAiGenerationSlot,
  QUOTE_AI_DAILY_LIMIT,
} from "@/lib/quote-ai-rate-limit";
import {
  quoteGenerateRequestSchema,
} from "@/lib/schemas/quote-builder";
import { quoteIdParamSchema } from "@/lib/schemas/quotes";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("ANTHROPIC_API_KEY is not configured", 500);
  }

  const { id } = await context.params;
  const idParsed = quoteIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return jsonError("Invalid quote id", 400, idParsed.error.issues);
  }
  const quoteId = idParsed.data;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = quoteGenerateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const input = parsed.data;
  if (input.mode === "form" && !input.job) {
    return jsonError("job is required for form mode", 400);
  }

  const supabase = await createClient();

  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select("id, status, current_version")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quoteErr) {
    return jsonError(quoteErr.message, 500);
  }
  if (!quote) {
    return jsonError("Not found", 404);
  }

  const { data: headVersion, error: headErr } = await supabase
    .from("quote_versions")
    .select("id, version_number, status, payload")
    .eq("quote_id", quoteId)
    .eq("version_number", quote.current_version)
    .maybeSingle();

  if (headErr) {
    return jsonError(headErr.message, 500);
  }
  if (!headVersion) {
    return jsonError("Quote version not found", 404);
  }

  const headStatus = headVersion.status ?? "draft";
  if (headStatus !== "draft") {
    return jsonError(
      "AI can only update a draft version. Start a new revision or use a draft quote.",
      409,
    );
  }

  const slot = await consumeQuoteAiGenerationSlot(supabase, user.id);
  if (!slot.ok && slot.reason === "rpc") {
    return jsonError(
      "Could not verify AI usage limit. Apply db/quote_ai_rate_limit.sql in Supabase, or try again.",
      503,
      slot.message,
    );
  }
  if (!slot.ok && slot.reason === "limit") {
    return jsonError(
      `Daily limit of ${slot.limit} AI quote generations reached. Resets at midnight UTC.`,
      429,
      { limit: slot.limit, remaining: 0 },
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

  let result: Awaited<ReturnType<typeof runAnthropicQuoteGeneration>>;
  try {
    result = await runAnthropicQuoteGeneration({
      prompt,
      sitePhotos: input.sitePhotos,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return jsonError(msg, 502);
  }

  const parsedPayload = parseQuoteDraftPayload(headVersion.payload);
  const nextPayload = {
    ...parsedPayload,
    lines: result.lineItems,
    quoteReady: true,
    aiRationale: result.rationale
      ? `💡 ${result.rationale}`
      : parsedPayload.aiRationale,
    quoteNotes: result.notes
      ? `${result.notes}\n\n${parsedPayload.quoteNotes}`
      : parsedPayload.quoteNotes,
  };

  const { error: saveErr } = await supabase
    .from("quote_versions")
    .update({
      payload: nextPayload as unknown as Record<string, unknown>,
    })
    .eq("id", headVersion.id);

  if (saveErr) {
    return jsonError(saveErr.message, 500);
  }

  if (quote.status !== "draft") {
    await supabase
      .from("quotes")
      .update({ status: "draft" })
      .eq("id", quoteId)
      .eq("user_id", user.id);
  }

  const { data: full, error: reloadErr } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, status, payload, updated_at)",
    )
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .single();

  if (reloadErr || !full) {
    return jsonOk({
      lineItems: result.lineItems,
      rationale: result.rationale,
      notes: result.notes,
      generationsRemaining: slot.remaining,
      dailyLimit: QUOTE_AI_DAILY_LIMIT,
    });
  }

  return jsonOk({
    data: formatQuoteResponse(full as QuoteWithVersionRows),
    lineItems: result.lineItems,
    rationale: result.rationale,
    notes: result.notes,
    generationsRemaining: slot.remaining,
    dailyLimit: QUOTE_AI_DAILY_LIMIT,
  });
}
