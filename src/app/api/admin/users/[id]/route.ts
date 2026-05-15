import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { isTradefloAdminUser } from "@/lib/admin/tradeflo-admin";
import { getSessionUser } from "@/lib/api/session";
import { userRoleSchema } from "@/lib/schemas/user-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const uuidParamSchema = z.string().uuid();

const patchBodySchema = z
  .object({
    role: userRoleSchema,
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError("Server is not configured for admin user updates", 503);
  }

  const { error } = await admin
    .from("user_info")
    .update({ role: parsed.data.role })
    .eq("id", idParsed.data);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ ok: true });
}
