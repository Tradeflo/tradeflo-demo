"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogAdminRow } from "@/lib/admin/materials-catalog-map";

export type { CatalogAdminRow };

function MaterialRowEditor({
  row,
}: {
  row: CatalogAdminRow;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(row.display_name);
  const [unit, setUnit] = useState(row.unit ?? "");
  const [price, setPrice] = useState(String(row.base_retail_price));
  const [active, setActive] = useState(row.is_active);
  const [order, setOrder] = useState(String(row.sort_order));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const p = Number(price);
    const so = Number.parseInt(order, 10);
    if (!displayName.trim()) {
      setMsg("Display name required.");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setMsg("Invalid price.");
      return;
    }
    if (!Number.isFinite(so)) {
      setMsg("Invalid sort order.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/materials-catalog/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          unit: unit.trim() === "" ? "" : unit.trim(),
          base_retail_price: p,
          is_active: active,
          sort_order: so,
        }),
      });

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const errorText =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Save failed (${res.status})`;

      if (!res.ok) {
        setMsg(errorText);
        return;
      }
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <div style={{ fontWeight: 600, fontSize: 12 }}>
          {row.trade}.{row.material_key}
        </div>
        <label style={{ display: "block", marginTop: 8, fontSize: 11 }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={busy}
          />{" "}
          Active
        </label>
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <input
          style={{ width: "100%", maxWidth: 280, padding: 8 }}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
        />
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <input
          style={{ width: "100%", maxWidth: 100, padding: 8 }}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="unit"
          disabled={busy}
        />
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <input
          type="number"
          step="0.01"
          min={0}
          style={{ width: 100, padding: 8 }}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={busy}
        />
        <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>
          {row.currency}
        </span>
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <input
          type="number"
          style={{ width: 72, padding: 8 }}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          disabled={busy}
        />
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#1a1916",
            color: "#fff",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {msg ? (
          <div style={{ fontSize: 12, color: "#b00020", marginTop: 6 }}>
            {msg}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export function MaterialsCatalogEditor({ rows }: { rows: CatalogAdminRow[] }) {
  return (
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
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Key</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Display</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Unit</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Price</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Sort</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <MaterialRowEditor key={r.id} row={r} />
        ))}
      </tbody>
    </table>
  );
}
