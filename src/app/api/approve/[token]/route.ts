import {
  jsonError,
  jsonOk,
} from "@/lib/api/responses";
import {
  consumeApprovalToken,
  loadPublicApprovalByToken,
} from "@/lib/approval/public-by-token";
import { approveActionBodySchema } from "@/lib/schemas/approval";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

/** Public: quote preview for customer approval link (SRS §4.4). */
export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const data = await loadPublicApprovalByToken(token);
  if (!data.ok) {
    if (data.reason === "misconfigured") {
      return jsonError(
        "Approvals are temporarily unavailable (server configuration).",
        503,
      );
    }
    return jsonError("Not found", 404);
  }

  return jsonOk({ data });
}

/** Public: single-use approve or request-changes (SRS §4.4). */
export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = approveActionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const result = await consumeApprovalToken({
    token,
    action: parsed.data.action,
    message: parsed.data.message,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonOk({ ok: true });
}
