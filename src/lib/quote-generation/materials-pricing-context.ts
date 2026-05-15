import type { SupabaseClient } from "@supabase/supabase-js";

export type MaterialsCatalogPromptRow = {
  material_key: string;
  display_name: string;
  unit: string | null;
  base_retail_price: number;
  currency: string;
};

export type MaterialsPricingContext = {
  /** From profile; null if not saved yet (no implied markup %). */
  profileMarkupPercent: number | null;
  /** `user_info.trade`, used as `materials_catalog.trade` filter. */
  trade: string | null;
  catalog: MaterialsCatalogPromptRow[];
};

export async function loadMaterialsPricingContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<MaterialsPricingContext> {
  const { data: row } = await supabase
    .from("user_info")
    .select("trade, materials_markup_percent")
    .eq("id", userId)
    .maybeSingle();

  const tradeRaw = row?.trade;
  const trade =
    typeof tradeRaw === "string" && tradeRaw.trim()
      ? tradeRaw.trim()
      : null;

  let profileMarkupPercent: number | null = null;
  const rawMp = row?.materials_markup_percent;
  if (typeof rawMp === "number" && Number.isFinite(rawMp)) {
    profileMarkupPercent = rawMp;
  } else if (typeof rawMp === "string" && rawMp.trim()) {
    const n = Number(rawMp);
    if (Number.isFinite(n)) profileMarkupPercent = n;
  }

  let catalog: MaterialsCatalogPromptRow[] = [];
  if (trade) {
    const { data: rows } = await supabase
      .from("materials_catalog")
      .select("material_key, display_name, unit, base_retail_price, currency")
      .eq("trade", trade)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(500);

    catalog = (rows ?? []).map((r) => {
      const item = r as Record<string, unknown>;
      const base = item.base_retail_price;
      const baseNum =
        typeof base === "number"
          ? base
          : typeof base === "string"
            ? Number(base)
            : NaN;
      return {
        material_key: String(item.material_key ?? ""),
        display_name: String(item.display_name ?? ""),
        unit:
          item.unit != null && String(item.unit).trim()
            ? String(item.unit).trim()
            : null,
        base_retail_price: Number.isFinite(baseNum) ? baseNum : 0,
        currency:
          typeof item.currency === "string" && item.currency.trim()
            ? item.currency.trim()
            : "CAD",
      };
    });
  }

  return {
    profileMarkupPercent,
    trade,
    catalog,
  };
}
