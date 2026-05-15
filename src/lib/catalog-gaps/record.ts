import { createAdminClient } from "@/lib/supabase/admin";
import type { GeneratedLineItem } from "@/lib/quote-generation/run-anthropic-quote";

/**
 * Persist estimated material lines after AI generation so admins can prioritize catalog entries.
 * No-op if service role is not configured or there are no matching lines.
 */
export async function recordMaterialsCatalogGaps(params: {
  userId: string;
  quoteId: string | null;
  contractorTrade: string | null;
  jobType: string | null;
  lines: GeneratedLineItem[];
}): Promise<void> {
  const estimatedMaterials = params.lines.filter(
    (l) =>
      (l.kind ?? "material") === "material" &&
      (l.source ?? "estimated") === "estimated",
  );
  if (estimatedMaterials.length === 0) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const rows = estimatedMaterials.map((l) => ({
    user_id: params.userId,
    quote_id: params.quoteId,
    contractor_trade: params.contractorTrade?.trim()
      ? params.contractorTrade.trim().slice(0, 120)
      : null,
    job_type: params.jobType?.trim()
      ? params.jobType.trim().slice(0, 500)
      : null,
    line_description: l.description.trim().slice(0, 2000),
    catalog_category: (() => {
      const c = l.catalogCategory?.trim();
      return c ? c.slice(0, 120) : null;
    })(),
  }));

  const { error } = await admin.from("materials_catalog_gaps").insert(rows);
  if (error) {
    console.error("[materials_catalog_gaps insert]", error.message);
  }
}
