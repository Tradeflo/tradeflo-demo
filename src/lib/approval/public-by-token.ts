import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseQuoteDraftPayload } from "@/lib/quotes/draft-payload";

export type PublicApprovalLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type PublicApprovalView =
  | {
      ok: true;
      token: string;
      /** Version row status after any customer action. */
      versionStatus: "sent" | "approved" | "changes_requested";
      consumed: boolean;
      quoteNum: string;
      customerDisplay: string;
      jobType: string;
      address: string;
      lines: PublicApprovalLine[];
      grandTotal: number;
      quoteNotes: string;
      personalNote: string;
      sentAt: string | null;
      customerMessage: string | null;
    }
  | { ok: false; reason: "not_found" | "misconfigured" };

function sumLines(lines: PublicApprovalLine[]): number {
  return lines.reduce((s, l) => s + (Number.isFinite(l.total) ? l.total : 0), 0);
}

/** Load quote snapshot for a sent version by approval token (service role). */
export async function loadPublicApprovalByToken(
  rawToken: string,
): Promise<PublicApprovalView> {
  const token = decodeURIComponent(rawToken).trim();
  if (!token) {
    return { ok: false, reason: "not_found" };
  }

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: "misconfigured" };
  }

  const { data: version, error } = await admin
    .from("quote_versions")
    .select(
      "id, quote_id, version_number, status, sent_at, approval_token, approval_token_consumed_at, approval_customer_message, payload",
    )
    .eq("approval_token", token)
    .maybeSingle();

  if (error || !version) {
    return { ok: false, reason: "not_found" };
  }

  const status =
    typeof version.status === "string" ? version.status : "sent";
  const payload = parseQuoteDraftPayload(version.payload);
  const consumed =
    version.approval_token_consumed_at != null &&
    String(version.approval_token_consumed_at).trim() !== "";

  const lines: PublicApprovalLine[] = (payload.lines ?? []).map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    total: l.total,
  }));

  const customerDisplay =
    `${payload.fname} ${payload.lname}`.trim() || "Customer";

  return {
    ok: true,
    token,
    versionStatus: status as "sent" | "approved" | "changes_requested",
    consumed,
    quoteNum: payload.quoteNum,
    customerDisplay,
    jobType: payload.jobForm.jobType,
    address: payload.jobForm.address,
    lines,
    grandTotal: sumLines(lines),
    quoteNotes: payload.quoteNotes,
    personalNote: payload.personalNote,
    sentAt: version.sent_at ?? null,
    customerMessage:
      typeof version.approval_customer_message === "string"
        ? version.approval_customer_message
        : null,
  };
}

export async function consumeApprovalToken(params: {
  token: string;
  action: "approve" | "request_changes";
  message?: string;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      status: 404 | 409 | 410 | 500;
      error: string;
    }
> {
  const token = decodeURIComponent(params.token).trim();
  if (!token) {
    return { ok: false, status: 404, error: "Invalid link" };
  }

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Server is not configured for approvals",
    };
  }

  const { data: version, error: findErr } = await admin
    .from("quote_versions")
    .select(
      "id, quote_id, version_number, status, approval_token_consumed_at",
    )
    .eq("approval_token", token)
    .maybeSingle();

  if (findErr || !version) {
    return { ok: false, status: 404, error: "This quote link is invalid or expired." };
  }

  const consumed =
    version.approval_token_consumed_at != null &&
    String(version.approval_token_consumed_at).trim() !== "";

  if (consumed) {
    return {
      ok: false,
      status: 410,
      error: "This link was already used. Contact the contractor if you need help.",
    };
  }

  const vStatus = typeof version.status === "string" ? version.status : "";
  if (vStatus !== "sent") {
    return {
      ok: false,
      status: 409,
      error: "This quote is no longer awaiting a response.",
    };
  }

  const nextStatus =
    params.action === "approve" ? "approved" : "changes_requested";
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status: nextStatus,
    approval_token_consumed_at: now,
  };

  if (params.action === "request_changes" && params.message?.trim()) {
    patch.approval_customer_message = params.message.trim();
  }

  const { error: upErr } = await admin
    .from("quote_versions")
    .update(patch)
    .eq("id", version.id)
    .eq("approval_token", token);

  if (upErr) {
    return { ok: false, status: 500, error: upErr.message };
  }

  const { data: quoteRow } = await admin
    .from("quotes")
    .select("current_version")
    .eq("id", version.quote_id as string)
    .maybeSingle();

  const currentVersion =
    quoteRow && typeof quoteRow.current_version === "number"
      ? quoteRow.current_version
      : null;

  if (
    currentVersion != null &&
    version.version_number === currentVersion
  ) {
    await admin
      .from("quotes")
      .update({ status: nextStatus })
      .eq("id", version.quote_id as string);
  }

  return { ok: true };
}
