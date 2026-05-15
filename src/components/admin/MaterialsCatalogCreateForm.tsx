"use client";

import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  useState,
} from "react";

/** Add a row to materials_catalog (matches quote AI trade → catalog filter). */
export function MaterialsCatalogCreateForm() {
  const router = useRouter();
  const [trade, setTrade] = useState("");
  const [materialKey, setMaterialKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const p = Number(price);
    const sort = Number.parseInt(sortOrder, 10);
    if (!trade.trim()) {
      setError("Trade is required (must match contractor profile trade exactly).");
      return;
    }
    if (!materialKey.trim()) {
      setError("Material key is required.");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setError("Base retail price must be a non‑negative number.");
      return;
    }
    if (!Number.isFinite(sort) || sort < 0) {
      setError("Sort order must be a non‑negative integer.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/materials-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade: trade.trim(),
          material_key: materialKey.trim(),
          display_name: displayName.trim(),
          description: description.trim() || "",
          unit: unit.trim(),
          base_retail_price: p,
          currency: currency.trim().toUpperCase() || "CAD",
          sort_order: sort,
          is_active: isActive,
        }),
      });

      let bodyJson: unknown;
      try {
        bodyJson = await res.json();
      } catch {
        bodyJson = null;
      }

      const errMsg =
        bodyJson &&
        typeof bodyJson === "object" &&
        "error" in bodyJson &&
        typeof (bodyJson as { error: unknown }).error === "string"
          ? (bodyJson as { error: string }).error
          : `Request failed (${res.status})`;

      if (!res.ok) {
        setError(errMsg);
        return;
      }

      setSuccess("Saved. Reloading table…");
      setMaterialKey("");
      setDisplayName("");
      setDescription("");
      setUnit("");
      setPrice("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle: CSSProperties = {
    width: "100%",
    maxWidth: 360,
    padding: "10px 12px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: "#444",
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: "20px 22px",
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        Add catalog row
      </h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Contractors only see catalog rows whose{" "}
        <code style={{ fontSize: 12 }}>trade</code> matches{" "}
        <code style={{ fontSize: 12 }}>user_info.trade</code> and{" "}
        <code style={{ fontSize: 12 }}>is_active</code>.
      </p>

      <form onSubmit={(e) => void submit(e)} style={{ maxWidth: 520 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="mc-trade" style={labelStyle}>
              Trade{" "}
              <span style={{ fontWeight: 400, opacity: 0.75 }}>
                (e.g. Siding Contractor)
              </span>
            </label>
            <input
              id="mc-trade"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              disabled={busy}
              style={fieldStyle}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="mc-key" style={labelStyle}>
              Material key <span style={{ fontWeight: 400 }}>(unique per trade)</span>
            </label>
            <input
              id="mc-key"
              value={materialKey}
              onChange={(e) => setMaterialKey(e.target.value)}
              disabled={busy}
              style={fieldStyle}
              placeholder="e.g. hardie_trim_piece"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="mc-display" style={labelStyle}>
              Display name
            </label>
            <input
              id="mc-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={busy}
              style={fieldStyle}
              required
            />
          </div>
          <div>
            <label htmlFor="mc-desc" style={labelStyle}>
              Description <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="mc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              style={{ ...fieldStyle, maxWidth: "100%" }}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              maxWidth: 420,
            }}
          >
            <div>
              <label htmlFor="mc-unit" style={labelStyle}>
                Unit <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="mc-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={busy}
                style={{ ...fieldStyle, maxWidth: "100%" }}
                placeholder='e.g. "each", "sheet"'
              />
            </div>
            <div>
              <label htmlFor="mc-currency" style={labelStyle}>
                Currency
              </label>
              <input
                id="mc-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={busy}
                style={{ ...fieldStyle, maxWidth: "100%" }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="mc-price" style={labelStyle}>
              Base retail price
            </label>
            <input
              id="mc-price"
              type="number"
              step="0.01"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={busy}
              style={{ ...fieldStyle, maxWidth: 200 }}
              required
            />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
            }}
          >
            <div>
              <label htmlFor="mc-sort" style={labelStyle}>
                Sort order
              </label>
              <input
                id="mc-sort"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={busy}
                style={{ ...fieldStyle, maxWidth: 100 }}
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                marginTop: 22,
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={busy}
              />
              Active (visible to contractors)
            </label>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              borderRadius: 8,
              border: "none",
              background: "#1a1916",
              color: "#fff",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Saving…" : "Add row"}
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            style={{ marginTop: 14, fontSize: 13, color: "#b00020" }}
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" style={{ marginTop: 10, fontSize: 13, color: "#1a6630" }}>
            {success}
          </p>
        ) : null}
      </form>
    </div>
  );
}
