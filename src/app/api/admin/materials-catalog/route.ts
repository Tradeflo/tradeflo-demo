import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { isTradefloAdminUser } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { materialsCatalogCreateSchema } from "@/lib/schemas/materials-catalog-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  if (!(await isTradefloAdminUser(supabase, user))) {
    return jsonError("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = materialsCatalogCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const row = parsed.data;
  const description =
    row.description?.trim() === "" ? null : row.description?.trim() ?? null;
  const unit =
    row.unit === undefined || row.unit.trim() === ""
      ? null
      : row.unit.trim();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError("Server is not configured for admin catalog updates", 503);
  }

  const { data, error } = await admin
    .from("materials_catalog")
    .insert({
      trade: row.trade,
      material_key: row.material_key,
      display_name: row.display_name,
      description,
      unit,
      base_retail_price: row.base_retail_price,
      currency: row.currency,
      sort_order: row.sort_order,
      is_active: row.is_active,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (
      error.code === "23505" ||
      /duplicate|unique/i.test(error.message ?? "")
    ) {
      return jsonError(
        "A row with this trade and material key already exists.",
        409,
      );
    }
    if (error.code === "42P01" || /does not exist/i.test(error.message ?? "")) {
      return jsonError(
        "Table materials_catalog is missing. Run db/materials_catalog.sql in Supabase first.",
        503,
      );
    }
    return jsonError(error.message, 500);
  }

  if (!data?.id) {
    return jsonError("Insert did not return an id", 500);
  }

  return jsonOk({ id: data.id }, { status: 201 });
}
