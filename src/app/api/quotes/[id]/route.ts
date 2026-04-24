import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { formatQuoteResponse } from "@/lib/api/quotes-format";
import type { QuoteWithVersionRows } from "@/lib/api/quotes-format";
import { getSessionUser } from "@/lib/api/session";
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
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, payload, updated_at)",
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
  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("id, status, current_version")
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return jsonError(fetchError.message, 500);
  }
  if (!quote) {
    return jsonError("Not found", 404);
  }
  if (quote.status !== "draft") {
    return jsonError("Only draft quotes can be edited", 409);
  }

  const { title, payload } = parsed.data;

  if (title !== undefined) {
    const normalizedTitle =
      title === null || title.trim() === "" ? null : title.trim();
    const { error: titleError } = await supabase
      .from("quotes")
      .update({ title: normalizedTitle })
      .eq("id", idParsed.data)
      .eq("user_id", user.id);

    if (titleError) {
      return jsonError(titleError.message, 500);
    }
  }

  if (payload !== undefined) {
    const { error: payloadError } = await supabase
      .from("quote_versions")
      .update({ payload })
      .eq("quote_id", idParsed.data)
      .eq("version_number", quote.current_version);

    if (payloadError) {
      return jsonError(payloadError.message, 500);
    }
  }

  const { data: full, error: reloadError } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, payload, updated_at)",
    )
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .single();

  if (reloadError || !full) {
    return jsonError(reloadError?.message ?? "Failed to load quote", 500);
  }

  return jsonOk({ data: formatQuoteResponse(full as QuoteWithVersionRows) });
}
