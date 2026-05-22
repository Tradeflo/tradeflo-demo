import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { patchUserInfoOrInsert } from "@/lib/supabase/user-info";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { createClient } from "@/lib/supabase/server";

async function handlePost() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { error } = await patchUserInfoOrInsert(supabase, user.id, {
    onboarding_skip_work_logs: true,
  });

  if (error) {
    return jsonError(error, 500);
  }

  return jsonOk({ success: true });
}

export const POST = wrapRouteWithSentry(
  "POST /api/onboarding/skip-work-logs",
  "app",
  handlePost,
);
