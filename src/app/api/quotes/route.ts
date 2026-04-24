import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { formatQuoteResponse } from "@/lib/api/quotes-format";
import type { QuoteWithVersionRows } from "@/lib/api/quotes-format";
import { getSessionUser } from "@/lib/api/session";
import { createQuoteBodySchema } from "@/lib/schemas/quotes";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, payload, updated_at)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  const rows = (data ?? []) as QuoteWithVersionRows[];
  return jsonOk({
    data: rows.map((row) => formatQuoteResponse(row)),
  });
}

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = createQuoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const { title, payload } = parsed.data;
  const supabase = await createClient();
  const titleOrNull =
    title !== undefined && title.trim() !== "" ? title.trim() : null;

  const { data: quote, error: insertQuoteError } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      title: titleOrNull,
    })
    .select("id, user_id, status, title, current_version, created_at, updated_at")
    .single();

  if (insertQuoteError || !quote) {
    return jsonError(insertQuoteError?.message ?? "Failed to create quote", 500);
  }

  const draftPayload = payload ?? {};

  const { error: versionError } = await supabase.from("quote_versions").insert({
    quote_id: quote.id,
    version_number: quote.current_version,
    payload: draftPayload,
  });

  if (versionError) {
    await supabase.from("quotes").delete().eq("id", quote.id);
    return jsonError(versionError.message, 500);
  }

  const { data: full, error: fetchError } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, title, current_version, created_at, updated_at, quote_versions(id, version_number, payload, updated_at)",
    )
    .eq("id", quote.id)
    .single();

  if (fetchError || !full) {
    return jsonOk({
      data: {
        id: quote.id,
        title: quote.title,
        status: quote.status,
        currentVersion: quote.current_version,
        createdAt: quote.created_at,
        updatedAt: quote.updated_at,
        draft: {
          versionNumber: quote.current_version,
          payload: draftPayload,
          updatedAt: quote.updated_at,
        },
      },
    });
  }

  return jsonOk({
    data: formatQuoteResponse(full as QuoteWithVersionRows),
  });
}
