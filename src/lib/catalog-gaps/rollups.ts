import { createAdminClient } from "@/lib/supabase/admin";

export type CatalogGapRollup = {
  lineDescription: string;
  contractorTrade: string;
  catalogCategory: string;
  hitCount: number;
  lastSeen: string;
};

type GapRow = {
  line_description: string;
  contractor_trade: string | null;
  catalog_category: string | null;
  created_at: string;
};

/**
 * Aggregate recent gap rows in memory (MVP; replace with SQL rollup if volume grows).
 */
export async function loadCatalogGapRollups(
  limit = 80,
): Promise<CatalogGapRollup[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("materials_catalog_gaps")
    .select(
      "line_description, contractor_trade, catalog_category, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(8000);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<
    string,
    {
      count: number;
      lastSeen: string;
      lineDescription: string;
      contractorTrade: string;
      catalogCategory: string;
    }
  >();

  for (const r of (data ?? []) as GapRow[]) {
    const desc = String(r.line_description ?? "").trim();
    if (!desc) continue;
    const trade = String(r.contractor_trade ?? "").trim();
    const cat = String(r.catalog_category ?? "").trim();
    const key = JSON.stringify([
      trade.toLowerCase(),
      desc.toLowerCase(),
      cat.toLowerCase(),
    ]);
    const created = r.created_at ?? "";
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        count: 1,
        lastSeen: created,
        lineDescription: desc,
        contractorTrade: trade,
        catalogCategory: cat,
      });
    } else {
      existing.count += 1;
      if (created > existing.lastSeen) {
        existing.lastSeen = created;
      }
    }
  }

  return [...map.values()]
    .sort(
      (a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen),
    )
    .map((v) => ({
      lineDescription: v.lineDescription,
      contractorTrade: v.contractorTrade,
      catalogCategory: v.catalogCategory,
      hitCount: v.count,
      lastSeen: v.lastSeen,
    }))
    .slice(0, limit);
}
