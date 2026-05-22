import { randomBytes } from "crypto";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { billingMutationBlockedResponse } from "@/lib/billing/gate";
import { getPublicSiteOrigin } from "@/lib/env/public-site-origin";
import { getSessionUser } from "@/lib/api/session";
import { captureApiRouteError } from "@/lib/observability/sentry-api";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import {
  deliverSentQuoteNotifications,
  quoteDeliveryConfigError,
} from "@/lib/quote-delivery/deliver-quote";
import {
  quoteDeliveryConfigMessageForClient,
  quoteDeliveryFailureMessageForClient,
} from "@/lib/quote-delivery/public-messages";
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

function approvalPublicUrl(token: string): string | null {
  const base = getPublicSiteOrigin();
  if (!base) return null;
  return `${base}/approve/${token}`;
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

async function handlePost(request: Request, context: RouteContext) {
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
    captureApiRouteError({
      domain: "delivery",
      route: "/api/quotes/[id]/send",
      userId: user.id,
      error: quoteError,
      extra: { supabase_step: "load_quote" },
    });
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
    captureApiRouteError({
      domain: "delivery",
      route: "/api/quotes/[id]/send",
      userId: user.id,
      error: headError,
      extra: { supabase_step: "load_head_version" },
    });
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
    captureApiRouteError({
      domain: "delivery",
      route: "/api/quotes/[id]/send",
      userId: user.id,
      error: new Error("Quote delivery providers not configured"),
      extra: { reason: "missing_env_or_from" },
    });
    return jsonError(
      quoteDeliveryConfigMessageForClient(parsedPayload.delivery),
      503,
    );
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
    captureApiRouteError({
      domain: "delivery",
      route: "/api/quotes/[id]/send",
      userId: user.id,
      error: lockError,
      extra: { supabase_step: "lock_quote_draft" },
    });
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
    captureApiRouteError({
      domain: "delivery",
      route: "/api/quotes/[id]/send",
      userId: user.id,
      error: versionError,
      extra: { supabase_step: "mark_version_sent" },
    });
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

  const approvalLink = approvalPublicUrl(token);
  if (!approvalLink) {
    return jsonError("Set NEXT_PUBLIC_BASE_URL for approval links.", 500);
  }

  const deliver = await deliverSentQuoteNotifications({
    payload: finalPayload as QuoteDraftPayloadV1,
    approvalLink,
    contractorLabel,
    personalNoteForCustomer: note,
  });

  if (!deliver.ok) {
    captureApiRouteError({
      domain: "delivery",
      route: "/api/quotes/[id]/send",
      userId: user.id,
      error: new Error("Quote delivery failed after send"),
      extra: { quote_id: quoteId },
    });
    await rollbackQuoteToDraft({
      supabase,
      quoteId,
      userId: user.id,
      headVersionId: headVersion.id,
      draftSnapshot,
    });
    return jsonError(quoteDeliveryFailureMessageForClient(), 502);
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

export const POST = wrapRouteWithSentry(
  "POST /api/quotes/[id]/send",
  "delivery",
  handlePost,
);
