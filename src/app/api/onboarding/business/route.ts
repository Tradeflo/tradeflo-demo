import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import { onboardingBusinessBodySchema } from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = onboardingBusinessBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, parsed.error.issues);
  }

  const b = parsed.data;
  const location = `${b.city.trim()}, ${b.province.trim()}`;

  const supabase = await createClient();
  const { error } = await supabase.from("user_info").upsert(
    {
      id: user.id,
      business_name: b.businessName.trim(),
      full_name: b.ownerName.trim(),
      phone: b.phone.trim(),
      email: b.email.trim(),
      location,
      trade: b.tradeType.trim(),
      hst_number: b.hstNumber?.trim() || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ success: true });
}
