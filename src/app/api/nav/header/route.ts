import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";

export type HeaderNavVariant = "admin" | "contractor";

/** Authenticated navbar: admin dashboard vs billing (contractors). */
export async function GET() {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_info")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const nav: HeaderNavVariant = bypassesLimitsFromAuthRow(
    data?.role,
    user.email,
  )
    ? "admin"
    : "contractor";

  return jsonOk({ nav });
}
