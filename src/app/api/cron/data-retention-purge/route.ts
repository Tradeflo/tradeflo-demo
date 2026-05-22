import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { runDataRetentionPurge } from "@/lib/data-retention/purge-cancelled-contractors";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function authorize(
  request: Request,
  configured: string,
): Promise<boolean> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return Boolean(token && token === configured);
}

async function handlePost(request: Request) {
  const configured = process.env.DATA_RETENTION_CRON_SECRET?.trim();
  if (!configured) {
    return Response.json(
      { error: "DATA_RETENTION_CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const ok = await authorize(request, configured);
  if (!ok) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await runDataRetentionPurge(admin, { limit: 25 });

    const status =
      result.candidates > 0 &&
      result.purgedUserIds.length === 0 &&
      result.errors.length > 0
        ? 500
        : 200;

    return Response.json(
      {
        ok: status === 200,
        ...result,
      },
      { status },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Purge failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

/** Netlify Cron / scheduler: Bearer `DATA_RETENTION_CRON_SECRET`. */
export const POST = wrapRouteWithSentry(
  "POST /api/cron/data-retention-purge",
  "app",
  handlePost,
);
