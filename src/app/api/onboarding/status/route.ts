import { jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { businessFormPrefillFromUserInfo } from "@/lib/onboarding/business-prefill";
import type { OnboardingBusinessBody } from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/server";

function profileMaterialsMarkupRecorded(materials_markup_percent: unknown) {
  if (materials_markup_percent == null) return false;
  if (
    typeof materials_markup_percent === "number" &&
    Number.isFinite(materials_markup_percent)
  ) {
    return true;
  }
  if (
    typeof materials_markup_percent === "string" &&
    materials_markup_percent.trim() !== ""
  ) {
    return Number.isFinite(Number(materials_markup_percent));
  }
  return false;
}

function businessStepComplete(u: {
  business_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  trade: string | null;
  materials_markup_percent: unknown;
} | null): boolean {
  if (!u) return false;
  return Boolean(
    u.business_name?.trim() &&
      u.full_name?.trim() &&
      u.phone?.trim() &&
      u.email?.trim() &&
      u.location?.trim() &&
      u.trade?.trim() &&
      profileMaterialsMarkupRecorded(u.materials_markup_percent),
  );
}

export async function GET() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { data: u } = await supabase
    .from("user_info")
    .select(
      "business_name, full_name, phone, email, location, trade, materials_markup_percent, hst_number, onboarding_skip_work_logs, onboarding_completed",
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
  const markedComplete = Boolean(u?.onboarding_completed);
  /** User can leave onboarding only when DB flag set and all gated steps satisfy (handles legacy rows missing markup). */
  const completed = markedComplete && businessDone && workLogsDone;

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
