import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { onboardingReadyToMarkComplete } from "@/lib/onboarding/completion";
import { patchUserInfoOrInsert } from "@/lib/supabase/user-info";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();

  const { data: u, error: loadErr } = await supabase
    .from("user_info")
    .select(
      "business_name, full_name, phone, email, location, trade, materials_markup_percent, default_labour_rate, default_labour_rate_unit, onboarding_skip_work_logs",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (loadErr) {
    return jsonError(loadErr.message, 500);
  }

  const { count } = await supabase
    .from("work_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!onboardingReadyToMarkComplete(u ?? null, count ?? 0)) {
    return jsonError(
      "Complete your business profile and work logs before finishing setup.",
      400,
    );
  }

  const { error } = await patchUserInfoOrInsert(supabase, user.id, {
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  });

  if (error) {
    return jsonError(error, 500);
  }

  const { data: verify, error: verifyErr } = await supabase
    .from("user_info")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (verifyErr || verify?.onboarding_completed !== true) {
    console.error("[onboarding/complete] verify failed:", verifyErr, verify);
    return jsonError(
      verifyErr?.message ??
        "Could not save onboarding completion. Check user_info row and RLS.",
      500,
    );
  }

  return jsonOk({
    success: true,
    redirectTo: "/",
  });
}
