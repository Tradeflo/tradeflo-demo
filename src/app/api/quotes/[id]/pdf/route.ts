import { jsonError, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { quotePdfFilename } from "@/lib/pdf/quote-pdf-filename";
import { renderSentQuotePdf } from "@/lib/pdf/render-sent-quote-pdf";
import { captureApiRouteError } from "@/lib/observability/sentry-api";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { parseQuoteDraftPayload } from "@/lib/quotes/draft-payload";
import { quoteIdParamSchema } from "@/lib/schemas/quotes";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type VersionRow = {
  id: string;
  version_number: number;
  status: string;
  payload: unknown;
  sent_at: string | null;
};

function isExportableSentVersion(row: VersionRow): boolean {
  if (row.sent_at != null && String(row.sent_at).trim() !== "") {
    return true;
  }
  return ["sent", "approved", "changes_requested"].includes(row.status);
}

/** Prefer the immutable snapshot that was delivered (`sent_at` set). */
function pickDefaultExportVersion(versions: VersionRow[]): VersionRow | null {
  const sent = versions.filter(isExportableSentVersion);
  if (sent.length === 0) return null;
  sent.sort((a, b) => b.version_number - a.version_number);
  return sent[0] ?? null;
}

async function handleGet(request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const idParsed = quoteIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return jsonError("Invalid quote id", 400, idParsed.error.issues);
  }
  const quoteId = idParsed.data;

  const url = new URL(request.url);
  const versionRaw = url.searchParams.get("version");
  let versionNumber: number | null = null;
  if (versionRaw != null && versionRaw.trim() !== "") {
    const n = Number(versionRaw);
    if (!Number.isInteger(n) || n < 1) {
      return jsonError("Invalid version query (use positive integer)", 400);
    }
    versionNumber = n;
  }

  const supabase = await createClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, title, current_version")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quoteError) {
    return jsonError(quoteError.message, 500);
  }
  if (!quote) {
    return jsonError("Not found", 404);
  }

  const { data: versions, error: verError } = await supabase
    .from("quote_versions")
    .select("id, version_number, status, payload, sent_at")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: true });

  if (verError) {
    return jsonError(verError.message, 500);
  }
  if (!versions?.length) {
    return jsonError("Quote version not found", 404);
  }

  const rows = versions as VersionRow[];

  let chosen: VersionRow | null = null;
  if (versionNumber != null) {
    chosen = rows.find((r) => r.version_number === versionNumber) ?? null;
    if (!chosen) {
      return jsonError("Version not found", 404);
    }
    if (!isExportableSentVersion(chosen)) {
      return jsonError(
        "PDF is only available for sent quote versions. This version has not been sent.",
        409,
      );
    }
  } else {
    chosen = pickDefaultExportVersion(rows);
    if (!chosen) {
      return jsonError(
        "Send the quote before exporting a PDF. No sent version was found.",
        409,
      );
    }
  }

  const payload = parseQuoteDraftPayload(chosen.payload);

  try {
    const buffer = await renderSentQuotePdf(payload, {
      quoteTitle: typeof quote.title === "string" ? quote.title : null,
      versionNumber: chosen.version_number,
      sentAt: chosen.sent_at,
    });

    const filename = quotePdfFilename(payload.quoteNum, chosen.version_number);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    captureApiRouteError({
      domain: "app",
      route: "GET /api/quotes/[id]/pdf",
      userId: user.id,
      error: e,
      extra: { step: "pdf_render" },
    });
    const message = e instanceof Error ? e.message : "PDF render failed";
    return jsonError(message, 500);
  }
}

export const GET = wrapRouteWithSentry(
  "GET /api/quotes/[id]/pdf",
  "app",
  handleGet,
);
