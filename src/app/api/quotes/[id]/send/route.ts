import { randomBytes } from "crypto";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { billingMutationBlockedResponse } from "@/lib/billing/gate";
import { getPublicSiteOrigin } from "@/lib/env/public-site-origin";
import { getSessionUser } from "@/lib/api/session";
import {
  deliverSentQuoteNotifications,
  quoteDeliveryConfigError,
} from "@/lib/quote-delivery/deliver-quote";
import type { QuoteDraftPayloadV1 } from "@/lib/quotes/draft-payload";
import { parseQuoteDraftPayload } from "@/lib/quotes/draft-payload";
import { quoteSendValidationError } from "@/lib/quotes/send-validation";
import {
  quoteIdParamSchema,
  quotesSendBodySchema,
} from "@/lib/schemas/quotes";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function newApprovalToken(): string {
  return randomBytes(32).toString("base64url");
}

function approvalPublicUrl(request: Request, token: string): string {
  const path = `/approve/${token}`;
  const base = getPublicSiteOrigin(request);
  if (base) {
    return `${base}${path}`;
  }
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}${path}`;
}

async function rollbackQuoteToDraft(params: {
  supabase: SupabaseClient;
  quoteId: string;
  userId: string;
  headVersionId: string;
  /** Draft-shaped payload prior to marking sent — `sentDone` forced false on save. */
  draftSnapshot: QuoteDraftPayloadV1;
}) {
  const { supabase, quoteId, userId, headVersionId, draftSnapshot } = params;

  await supabase
    .from("quote_versions")
    .update({
      status: "draft",
      sent_at: null,
      approval_token: null,
      payload: {
        ...draftSnapshot,
        sentDone: false,
      } as unknown as Record<string, unknown>,
    })
    .eq("id", headVersionId);

  await supabase
    .from("quotes")
    .update({ status: "draft" })
    .eq("id", quoteId)
    .eq("user_id", userId);
}

export async function POST(request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const billingBlock = await billingMutationBlockedResponse(user);
  if (billingBlock) return billingBlock;

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

  const headIsDraftForSend =
    headVersion.status === "draft" ||
    ((headVersion.status == null || headVersion.status === "") &&
      quote.status === "draft");

  if (!headIsDraftForSend) {
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

  const cfgErr = quoteDeliveryConfigError(parsedPayload.delivery);
  if (cfgErr) {
    return jsonError(cfgErr, 503);
  }

  const note =
    sendParsed.data.personalNote !== undefined
      ? sendParsed.data.personalNote
      : parsedPayload.personalNote;

  const { data: profile } = await supabase
    .from("user_info")
    .select("business_name, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const contractorLabel =
    (typeof profile?.business_name === "string"
      ? profile.business_name.trim()
      : "") ||
    (typeof profile?.full_name === "string"
      ? profile.full_name.trim()
      : "") ||
    "Tradeflo contractor";

  const draftSnapshot: QuoteDraftPayloadV1 = {
    ...parsedPayload,
    personalNote: note ?? parsedPayload.personalNote,
    sentDone: false,
  };

  const finalPayload = {
    ...parsedPayload,
    personalNote: note ?? parsedPayload.personalNote,
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

  const deliver = await deliverSentQuoteNotifications({
    payload: finalPayload as QuoteDraftPayloadV1,
    approvalLink,
    contractorLabel,
    personalNoteForCustomer: note,
  });

  if (!deliver.ok) {
    await rollbackQuoteToDraft({
      supabase,
      quoteId,
      userId: user.id,
      headVersionId: headVersion.id,
      draftSnapshot,
    });
    return jsonError(
      `Quote could not be delivered (${deliver.error}). The quote was rolled back to draft — fix delivery settings or try again.`,
      502,
    );
  }

  return jsonOk({
    data: {
      status: "sent" as const,
      sentAt,
      approvalLink,
      quoteVersionId: headVersion.id,
      versionNumber: headVersion.version_number,
      delivery: {
        email:
          parsedPayload.delivery === "email" ||
          parsedPayload.delivery === "both",
        sms:
          parsedPayload.delivery === "sms" ||
          parsedPayload.delivery === "both",
      },
    },
  });
}
