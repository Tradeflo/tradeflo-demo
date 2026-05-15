import { jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { businessFormPrefillFromUserInfo } from "@/lib/onboarding/business-prefill";
import {
  businessStepComplete,
  computeOnboardingCompleted,
} from "@/lib/onboarding/completion";
import type { OnboardingBusinessBody } from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { data: u } = await supabase
    .from("user_info")
    .select(
      "business_name, full_name, phone, email, location, trade, materials_markup_percent, default_labour_rate, default_labour_rate_unit, hst_number, onboarding_skip_work_logs, onboarding_completed",
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
  /** User can leave onboarding only when DB flag set and all gated steps satisfy (handles legacy rows missing markup or labour defaults). */
  const completed = computeOnboardingCompleted(u ?? null, count ?? 0);

  let businessPrefill: Partial<OnboardingBusinessBody> | null = null;
  if (!businessDone && u) {
    businessPrefill = businessFormPrefillFromUserInfo({
      business_name: u.business_name ?? null,
      full_name: u.full_name ?? null,
      phone: u.phone ?? null,
      email: u.email ?? null,
      location: u.location ?? null,
      trade: u.trade ?? null,
      materials_markup_percent: u.materials_markup_percent ?? null,
      default_labour_rate: u.default_labour_rate ?? null,
      default_labour_rate_unit: u.default_labour_rate_unit ?? null,
      hst_number: u.hst_number ?? null,
    });
  }

  return jsonOk({
    completed,
    steps: {
      welcome: { completed: true },
      business: { completed: businessDone },
      workLogs: { completed: workLogsDone },
      ready: { completed },
    },
    businessPrefill,
  });
}
