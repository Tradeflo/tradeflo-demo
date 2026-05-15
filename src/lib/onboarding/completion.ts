import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";

export type UserInfoRowForOnboardingCompletion = {
  role?: unknown;
  business_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  trade: string | null;
  materials_markup_percent: unknown;
  default_labour_rate: unknown;
  default_labour_rate_unit: string | null;
  onboarding_skip_work_logs: boolean | null;
  onboarding_completed: boolean | null;
};

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

function profileDefaultLabourRecorded(
  default_labour_rate: unknown,
  default_labour_rate_unit: unknown,
): boolean {
  const unit =
    typeof default_labour_rate_unit === "string"
      ? default_labour_rate_unit.trim()
      : "";
  if (unit !== "hour" && unit !== "day" && unit !== "flat") return false;
  if (default_labour_rate == null) return false;
  let n: number;
  if (typeof default_labour_rate === "number") {
    n = default_labour_rate;
  } else if (
    typeof default_labour_rate === "string" &&
    default_labour_rate.trim() !== ""
  ) {
    n = Number(default_labour_rate);
  } else {
    return false;
  }
  return Number.isFinite(n) && n > 0;
}

/** Mirrors `/api/onboarding/status` business gate (SRS §4.12). */
export function businessStepComplete(
  u: Pick<
    UserInfoRowForOnboardingCompletion,
    | "business_name"
    | "full_name"
    | "phone"
    | "email"
    | "location"
    | "trade"
    | "materials_markup_percent"
    | "default_labour_rate"
    | "default_labour_rate_unit"
  > | null,
): boolean {
  if (!u) return false;
  return Boolean(
    u.business_name?.trim() &&
    u.full_name?.trim() &&
    u.phone?.trim() &&
    u.email?.trim() &&
    u.location?.trim() &&
    u.trade?.trim() &&
    profileMaterialsMarkupRecorded(u.materials_markup_percent) &&
    profileDefaultLabourRecorded(
      u.default_labour_rate,
      u.default_labour_rate_unit,
    ),
  );
}

/**
 * Same completion rule as GET `/api/onboarding/status`:
 * marked complete flag plus business step plus work logs (or explicit skip).
 */
export function computeOnboardingCompleted(
  u: UserInfoRowForOnboardingCompletion | null,
  workLogCount: number,
): boolean {
  const businessDone = businessStepComplete(u);
  const workLogsDone =
    Boolean(u?.onboarding_skip_work_logs) || workLogCount > 0;
  const markedComplete = Boolean(u?.onboarding_completed);
  return markedComplete && businessDone && workLogsDone;
}

/** Fields needed to validate profile + work-log steps before setting completion flag. */
export type UserInfoRowForOnboardingPrefinish = Pick<
  UserInfoRowForOnboardingCompletion,
  | "business_name"
  | "full_name"
  | "phone"
  | "email"
  | "location"
  | "trade"
  | "materials_markup_percent"
  | "default_labour_rate"
  | "default_labour_rate_unit"
  | "onboarding_skip_work_logs"
>;

/**
 * Business + work-log gates satisfied (before setting `onboarding_completed`).
 */
export function onboardingReadyToMarkComplete(
  u: UserInfoRowForOnboardingPrefinish | null,
  workLogCount: number,
): boolean {
  const businessDone = businessStepComplete(u);
  const workLogsDone =
    Boolean(u?.onboarding_skip_work_logs) || workLogCount > 0;
  return businessDone && workLogsDone;
}

/**
 * HTML navigation: contractors must satisfy full onboarding (same as GET `/api/onboarding/status` `completed`).
 * Admins / bootstrap emails skip; transient DB errors do not force onboarding.
 */
export async function contractorNeedsOnboardingRedirect(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_info")
    .select(
      "role, business_name, full_name, phone, email, location, trade, materials_markup_percent, default_labour_rate, default_labour_rate_unit, onboarding_skip_work_logs, onboarding_completed",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) return false;

  if (bypassesLimitsFromAuthRow(data?.role, user.email)) return false;

  const { count } = await supabase
    .from("work_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return !computeOnboardingCompleted(data ?? null, count ?? 0);
}
