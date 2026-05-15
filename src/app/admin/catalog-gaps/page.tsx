import type { CatalogGapRollup } from "@/lib/catalog-gaps/rollups";
import { loadCatalogGapRollups } from "@/lib/catalog-gaps/rollups";

export const metadata = {
  title: "Catalog gaps — Admin",
};

export default async function AdminCatalogGapsPage() {
  let rollups: CatalogGapRollup[] = [];
  let loadError: string | null = null;
  try {
    rollups = await loadCatalogGapRollups(120);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load gaps";
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Estimated materials (catalog gaps)
      </h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>
        Rows appear when AI returns a{" "}
        <code style={{ fontSize: 13 }}>material</code> line with pricing source{" "}
        <code style={{ fontSize: 13 }}>estimated</code> (no reference catalog
        match). Grouped counts help prioritize new{" "}
        <code style={{ fontSize: 13 }}>materials_catalog</code> entries.
      </p>

      {loadError ? (
        <div
          style={{
            padding: 14,
            background: "#fff1f1",
            border: "1px solid #fcc",
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          <strong>Error.</strong> {loadError}. Apply{" "}
          <code style={{ fontSize: 13 }}>db/materials_catalog_gaps.sql</code>,
          confirm <code style={{ fontSize: 13 }}>SUPABASE_SERVICE_ROLE_KEY</code>
          , and regenerate a quote while logged in.
        </div>
      ) : rollups.length === 0 ? (
        <p style={{ fontSize: 14, color: "#666" }}>
          No gap records yet — generate a quote with at least one estimated
          material line.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            overflow: "hidden",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: "#f3f1ed", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", fontWeight: 600 }}>
                Hits
              </th>
              <th style={{ padding: "10px 12px", fontWeight: 600 }}>
                Last seen (UTC)
              </th>
              <th style={{ padding: "10px 12px", fontWeight: 600 }}>Trade</th>
              <th style={{ padding: "10px 12px", fontWeight: 600 }}>
                Category
              </th>
              <th style={{ padding: "10px 12px", fontWeight: 600 }}>
                Line description
              </th>
            </tr>
          </thead>
          <tbody>
            {rollups.map((r, i) => (
              <tr
                key={`${r.lineDescription}-${r.contractorTrade}-${r.catalogCategory}-${i}`}
                style={{
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                  {r.hitCount}
                </td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                  {r.lastSeen
                    ? new Date(r.lastSeen).toISOString().slice(0, 19).replace(
                        "T",
                        " ",
                      )
                    : "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "#444" }}>
                  {r.contractorTrade || (
                    <span style={{ opacity: 0.5 }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", color: "#444" }}>
                  {r.catalogCategory || (
                    <span style={{ opacity: 0.5 }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", color: "#1a1916" }}>
                  {r.lineDescription}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
