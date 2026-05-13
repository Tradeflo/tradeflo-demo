import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";

function businessStepComplete(u: {
  business_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  trade: string | null;
} | null): boolean {
  if (!u) return false;
  return Boolean(
    u.business_name?.trim() &&
      u.full_name?.trim() &&
      u.phone?.trim() &&
      u.email?.trim() &&
      u.location?.trim() &&
      u.trade?.trim(),
  );
}

export async function GET() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { data: u } = await supabase
    .from("user_info")
    .select(
      "business_name, full_name, phone, email, location, trade, onboarding_skip_work_logs, onboarding_completed",
    )
    .eq("id", user.id)
    .maybeSingle();

  const { count } = await supabase
    .from("work_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const businessDone = businessStepComplete(u ?? null);
  /** Any stored upload counts; extraction can be `failed` but step is still done (user engaged). */
  const workLogsDone =
    Boolean(u?.onboarding_skip_work_logs) || (count ?? 0) > 0;
  const completed = Boolean(u?.onboarding_completed);

  return jsonOk({
    completed,
    steps: {
      welcome: { completed: true },
      business: { completed: businessDone },
      workLogs: { completed: workLogsDone },
      ready: { completed },
    },
  });
}
