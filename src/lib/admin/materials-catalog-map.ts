/** Server-safe shaping of Supabase rows for MaterialsCatalogEditor props. */

export type CatalogAdminRow = {
  id: string;
  trade: string;
  material_key: string;
  display_name: string;
  unit: string | null;
  base_retail_price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
};

function numFromDb(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function mapDbRowsToCatalogAdmin(
  rows: Record<string, unknown>[],
): CatalogAdminRow[] {
  return rows.map((raw) => ({
    id: String(raw.id ?? ""),
    trade: String(raw.trade ?? ""),
    material_key: String(raw.material_key ?? ""),
    display_name: String(raw.display_name ?? ""),
    unit:
      raw.unit != null && String(raw.unit).trim()
        ? String(raw.unit).trim()
        : null,
    base_retail_price: numFromDb(raw.base_retail_price),
    currency:
      typeof raw.currency === "string" && raw.currency.trim()
        ? raw.currency.trim()
        : "CAD",
    is_active: Boolean(raw.is_active),
    sort_order:
      typeof raw.sort_order === "number"
        ? raw.sort_order
        : Number(raw.sort_order) || 0,
  }));
}
