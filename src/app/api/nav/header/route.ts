import { bypassesLimitsFromAuthRow } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { createClient } from "@/lib/supabase/server";

export type HeaderNavVariant = "admin" | "contractor";

/** Authenticated navbar: admin dashboard vs billing (contractors). */
async function handleGet() {
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

export const GET = wrapRouteWithSentry(
  "GET /api/nav/header",
  "app",
  handleGet,
);
