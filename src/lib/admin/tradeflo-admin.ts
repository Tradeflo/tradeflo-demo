import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/schemas/user-role";

/** Optional bootstrap (comma-separated emails) until promoted in DB. */
export function parseTradefloAdminEmails(): Set<string> {
  const raw = process.env.TRADEFLO_ADMIN_EMAILS ?? "";
  const emails = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

export function isTradefloAdminBootstrapEmail(
  email: string | undefined | null,
): boolean {
  if (!email?.trim()) return false;
  return parseTradefloAdminEmails().has(email.trim().toLowerCase());
}

/** Used when role is already loaded with billing fields (one round-trip). */
export function bypassesLimitsFromAuthRow(
  role: unknown,
  email: string | undefined | null,
): boolean {
  if (isTradefloAdminBootstrapEmail(email)) return true;
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

/** Billing read-only + quote AI daily cap bypass (admin row or bootstrap email). */
export async function userBypassesSubscriptionLimits(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_info")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return bypassesLimitsFromAuthRow(data?.role, user.email);
}

/**
 * /admin APIs when signed in: TRADEFLO_ADMIN_EMAILS OR user_info.role = admin.
 */
export async function isTradefloAdminUser(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  return userBypassesSubscriptionLimits(supabase, user);
}
