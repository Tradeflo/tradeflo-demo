import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/schemas/user-role";

/** Used when role is already loaded with billing fields (one round-trip). */
export function bypassesLimitsFromAuthRow(role: unknown): boolean {
  return role === "admin";
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRole | null> {
  const { data } = await supabase
    .from("user_info")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const r = data?.role;
  return r === "admin" || r === "contractor" ? r : null;
}

export async function isTradefloAdminDb(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const r = await getUserRole(supabase, userId);
  return r === "admin";
}

/** Billing read-only + quote AI daily cap bypass (admin role). */
export async function userBypassesSubscriptionLimits(
  supabase: SupabaseClient,
  user: Pick<User, "id">,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_info")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return bypassesLimitsFromAuthRow(data?.role);
}

/**
 * /admin APIs when signed in: user_info.role = admin.
 */
export async function isTradefloAdminUser(
  supabase: SupabaseClient,
  user: Pick<User, "id">,
): Promise<boolean> {
  return userBypassesSubscriptionLimits(supabase, user);
}
