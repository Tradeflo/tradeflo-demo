"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminUserRoleRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "contractor" | "admin";
};

export function UserRolesEditor({ rows }: { rows: AdminUserRoleRow[] }) {
  const router = useRouter();
  const [local, setLocal] = useState(
    rows.map((r) => ({
      ...r,
      draft: r.role,
      busy: false,
      msg: null as string | null,
    })),
  );

  async function saveRow(id: string, role: "contractor" | "admin") {
    setLocal((prev) =>
      prev.map((r) => (r.id === id ? { ...r, busy: true, msg: null } : r)),
    );
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
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
          : `Failed (${res.status})`;

      if (!res.ok) {
        setLocal((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, busy: false, msg: errorText } : r,
          ),
        );
        return;
      }

      setLocal((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                role,
                draft: role,
                busy: false,
                msg: null,
              }
            : r,
        ),
      );
      router.refresh();
    } catch {
      setLocal((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, busy: false, msg: "Network error" } : r,
        ),
      );
    }
  }

  function setDraft(id: string, v: "contractor" | "admin") {
    setLocal((prev) =>
      prev.map((r) => (r.id === id ? { ...r, draft: v, msg: null } : r)),
    );
  }

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
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Email</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Name</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }}>Role</th>
          <th style={{ padding: "10px 8px", fontWeight: 600 }} />
        </tr>
      </thead>
      <tbody>
        {local.map((r) => (
          <tr key={r.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <td style={{ padding: "10px 8px" }}>{r.email ?? "—"}</td>
            <td style={{ padding: "10px 8px" }}>{r.full_name ?? "—"}</td>
            <td style={{ padding: "10px 8px" }}>
              <select
                value={r.draft}
                disabled={r.busy}
                onChange={(e) =>
                  setDraft(r.id, e.target.value as "contractor" | "admin")
                }
                style={{ padding: 8, minWidth: 140 }}
              >
                <option value="contractor">contractor</option>
                <option value="admin">admin</option>
              </select>
            </td>
            <td style={{ padding: "10px 8px" }}>
              <button
                type="button"
                disabled={r.busy || r.draft === r.role}
                onClick={() => void saveRow(r.id, r.draft)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "#1a1916",
                  color: "#fff",
                  cursor: r.busy ? "wait" : "pointer",
                  opacity: r.draft === r.role ? 0.4 : 1,
                }}
              >
                {r.busy ? "Saving…" : "Save"}
              </button>
              {r.msg ? (
                <div style={{ fontSize: 12, color: "#b00020", marginTop: 6 }}>
                  {r.msg}
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
