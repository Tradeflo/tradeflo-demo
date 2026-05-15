import { MaterialsCatalogCreateForm } from "@/components/admin/MaterialsCatalogCreateForm";
import { MaterialsCatalogEditor } from "@/components/admin/MaterialsCatalogEditor";
import { mapDbRowsToCatalogAdmin } from "@/lib/admin/materials-catalog-map";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Materials catalog — Admin",
};

export default async function AdminMaterialsPage() {
  let rows: Record<string, unknown>[] = [];
  let error: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error: qErr } = await admin
      .from("materials_catalog")
      .select(
        "id, trade, material_key, display_name, unit, base_retail_price, currency, is_active, sort_order",
      )
      .order("trade", { ascending: true })
      .order("sort_order", { ascending: true })
      .limit(500);

    if (qErr) {
      error = qErr.message;
    } else {
      rows = (data ?? []) as Record<string, unknown>[];
    }
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Admin client unavailable (configure service role)";
  }

  const catalogRows = mapDbRowsToCatalogAdmin(rows);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Materials catalog
      </h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 20 }}>
        Reference retail rows per trade drive AI pricing when markup rules apply.
        Contractors only receive active rows matching their profile trade.
      </p>

      {error ? (
        <div
          style={{
            padding: 14,
            background: "#fff1f1",
            border: "1px solid #fcc",
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          <strong>Error.</strong> {error}
          {/does not exist|42P01/i.test(error) ? (
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              Create the table once:{" "}
              <code style={{ fontSize: 13 }}>db/materials_catalog.sql</code> in
              the Supabase SQL editor, then refresh this page.
            </p>
          ) : null}
        </div>
      ) : null}

      {!error ? (
        <>
          <MaterialsCatalogCreateForm />
          {catalogRows.length === 0 ? (
            <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
              No rows yet. Use the form above to add your first SKU, or import
              with SQL when you bulk seed.
            </p>
          ) : (
            <MaterialsCatalogEditor rows={catalogRows} />
          )}
        </>
      ) : null}
    </div>
  );
}
