import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { isTradefloAdminUser } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { materialsCatalogPatchSchema } from "@/lib/schemas/materials-catalog-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wrapRouteWithSentry } from "@/lib/observability/sentry-route";
import { z } from "zod";

export const runtime = "nodejs";

const uuidParamSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

async function handlePatch(request: Request, context: RouteContext) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  if (!(await isTradefloAdminUser(supabase, user))) {
    return jsonError("Forbidden", 403);
  }

  const { id: rawId } = await context.params;
  const idParsed = uuidParamSchema.safeParse(rawId);
  if (!idParsed.success) {
    return jsonError("Invalid id", 400, idParsed.error.issues);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = materialsCatalogPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const updateRow: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    updateRow.display_name = patch.display_name;
  }
  if (patch.base_retail_price !== undefined) {
    updateRow.base_retail_price = patch.base_retail_price;
  }
  if (patch.unit !== undefined) {
    updateRow.unit = patch.unit.trim() === "" ? null : patch.unit.trim();
  }
  if (patch.is_active !== undefined) {
    updateRow.is_active = patch.is_active;
  }
  if (patch.sort_order !== undefined) {
    updateRow.sort_order = patch.sort_order;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError("Server is not configured for admin catalog updates", 503);
  }

  const { error } = await admin
    .from("materials_catalog")
    .update(updateRow)
    .eq("id", idParsed.data);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ ok: true });
}

export const PATCH = wrapRouteWithSentry(
  "PATCH /api/admin/materials-catalog/[id]",
  "app",
  handlePatch,
);
