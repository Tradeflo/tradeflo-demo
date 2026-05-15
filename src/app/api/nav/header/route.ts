import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { billingBlocksMutations } from "@/lib/billing/gate";
import { createClient } from "@/lib/supabase/server";

export type HeaderNavVariant = "admin" | "contractor";

/** Navbar targets + billing write lock (matches PATCH quote / billing gate). */
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

  const billingWriteBlocked = await billingBlocksMutations(user);

  return jsonOk({ nav, billingWriteBlocked });
}
