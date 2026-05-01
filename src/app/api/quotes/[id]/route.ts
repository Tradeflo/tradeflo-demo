import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { formatQuoteResponse } from "@/lib/api/quotes-format";
import type { QuoteWithVersionRows } from "@/lib/api/quotes-format";
import { getSessionUser } from "@/lib/api/session";
import { parseQuoteDraftPayload } from "@/lib/quotes/draft-payload";
import { patchQuoteBodySchema, quoteIdParamSchema } from "@/lib/schemas/quotes";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const idParsed = quoteIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return jsonError("Invalid quote id", 400, idParsed.error.issues);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, status, payload, updated_at)",
    )
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 500);
  }
  if (!data) {
    return jsonError("Not found", 404);
  }

  return jsonOk({ data: formatQuoteResponse(data as QuoteWithVersionRows) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const idParsed = quoteIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return jsonError("Invalid quote id", 400, idParsed.error.issues);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = patchQuoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const supabase = await createClient();
  const quoteId = idParsed.data;

  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("id, status, current_version")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return jsonError(fetchError.message, 500);
  }
  if (!quote) {
    return jsonError("Not found", 404);
  }

  const { data: headVersion, error: headError } = await supabase
    .from("quote_versions")
    .select("id, version_number, status, payload")
    .eq("quote_id", quoteId)
    .eq("version_number", quote.current_version)
    .maybeSingle();

  if (headError) {
    return jsonError(headError.message, 500);
  }
  if (!headVersion) {
    return jsonError("Quote version not found", 404);
  }

  const headIsDraft =
    headVersion.status === "draft" ||
    ((headVersion.status == null || headVersion.status === "") &&
      quote.status === "draft");

  const { title, payload } = parsed.data;

  if (title !== undefined) {
    const normalizedTitle =
      title === null || title.trim() === "" ? null : title.trim();
    const { error: titleError } = await supabase
      .from("quotes")
      .update({ title: normalizedTitle })
      .eq("id", quoteId)
      .eq("user_id", user.id);

    if (titleError) {
      return jsonError(titleError.message, 500);
    }
  }

  if (payload !== undefined) {
    if (headIsDraft) {
      const { error: payloadError } = await supabase
        .from("quote_versions")
        .update({ payload })
        .eq("id", headVersion.id);

      if (payloadError) {
        return jsonError(payloadError.message, 500);
      }

      if (quote.status !== "draft") {
        const { error: syncError } = await supabase
          .from("quotes")
          .update({ status: "draft" })
          .eq("id", quoteId)
          .eq("user_id", user.id);

        if (syncError) {
          return jsonError(syncError.message, 500);
        }
      }
    } else {
      const nextVersion = quote.current_version + 1;
      const parsedIncoming = parseQuoteDraftPayload(payload);
      const draftPayload = { ...parsedIncoming, sentDone: false };
      const { data: inserted, error: insertError } = await supabase
        .from("quote_versions")
        .insert({
          quote_id: quoteId,
          version_number: nextVersion,
          status: "draft",
          payload: draftPayload as unknown as Record<string, unknown>,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        return jsonError(
          insertError?.message ?? "Failed to create draft version",
          500,
        );
      }

      const { error: bumpError } = await supabase
        .from("quotes")
        .update({ current_version: nextVersion, status: "draft" })
        .eq("id", quoteId)
        .eq("user_id", user.id);

      if (bumpError) {
        await supabase.from("quote_versions").delete().eq("id", inserted.id);
        return jsonError(bumpError.message, 500);
      }
    }
  }

  const { data: full, error: reloadError } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, status, payload, updated_at)",
    )
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .single();

  if (reloadError || !full) {
    return jsonError(reloadError?.message ?? "Failed to load quote", 500);
  }

  return jsonOk({ data: formatQuoteResponse(full as QuoteWithVersionRows) });
}
