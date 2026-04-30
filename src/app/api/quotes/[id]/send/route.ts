import { randomBytes } from "crypto";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { parseQuoteDraftPayload } from "@/lib/quotes/draft-payload";
import { quoteSendValidationError } from "@/lib/quotes/send-validation";
import {
  quoteIdParamSchema,
  quotesSendBodySchema,
} from "@/lib/schemas/quotes";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

function newApprovalToken(): string {
  return randomBytes(32).toString("base64url");
}

function approvalPublicUrl(request: Request, token: string): string {
  const path = `/approve/${token}`;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}${path}`;
  }
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}${path}`;
}

export async function POST(request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const idParsed = quoteIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return jsonError("Invalid quote id", 400, idParsed.error.issues);
  }
  const quoteId = idParsed.data;

  let body: unknown = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw);
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const sendParsed = quotesSendBodySchema.safeParse(body);
  if (!sendParsed.success) {
    return jsonError("Validation failed", 400, sendParsed.error.issues);
  }

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status, current_version")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quoteError) {
    return jsonError(quoteError.message, 500);
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

  if (headVersion.status !== "draft") {
    return jsonError(
      "Only a draft version can be sent. Start a new revision to send again.",
      409,
    );
  }

  const parsedPayload = parseQuoteDraftPayload(headVersion.payload);
  const validation = quoteSendValidationError(parsedPayload);
  if (validation) {
    return jsonError(validation, 400);
  }

  const note =
    sendParsed.data.personalNote !== undefined
      ? sendParsed.data.personalNote
      : parsedPayload.personalNote;

  const finalPayload = {
    ...parsedPayload,
    personalNote: note,
    sentDone: true,
  };

  const token = newApprovalToken();
  const sentAt = new Date().toISOString();

  const { data: lockedRows, error: lockError } = await supabase
    .from("quotes")
    .update({ status: "sent" })
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("id");

  if (lockError) {
    return jsonError(lockError.message, 500);
  }
  if (!lockedRows?.length) {
    return jsonError(
      "Quote is no longer a draft. Refresh and try again.",
      409,
    );
  }

  const { data: sentVersionRows, error: versionError } = await supabase
    .from("quote_versions")
    .update({
      payload: finalPayload as unknown as Record<string, unknown>,
      status: "sent",
      sent_at: sentAt,
      approval_token: token,
    })
    .eq("id", headVersion.id)
    .eq("status", "draft")
    .select("id, version_number");

  if (versionError) {
    await supabase
      .from("quotes")
      .update({ status: "draft" })
      .eq("id", quoteId)
      .eq("user_id", user.id);
    return jsonError(versionError.message, 500);
  }

  if (!sentVersionRows?.length) {
    await supabase
      .from("quotes")
      .update({ status: "draft" })
      .eq("id", quoteId)
      .eq("user_id", user.id);
    return jsonError(
      "Could not send this version (it may have been updated). Refresh and try again.",
      409,
    );
  }

  const approvalLink = approvalPublicUrl(request, token);

  return jsonOk({
    data: {
      status: "sent" as const,
      sentAt,
      approvalLink,
      quoteVersionId: headVersion.id,
      versionNumber: headVersion.version_number,
    },
  });
}
