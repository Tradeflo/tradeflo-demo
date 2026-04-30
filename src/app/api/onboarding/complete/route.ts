import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { patchUserInfoOrInsert } from "@/lib/supabase/user-info";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { error } = await patchUserInfoOrInsert(supabase, user.id, {
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  });

  if (error) {
    return jsonError(error, 500);
  }

  return jsonOk({
    success: true,
    redirectTo: "/",
  });
}
