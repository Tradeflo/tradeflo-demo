import {
  UserRolesEditor,
  type AdminUserRoleRow,
} from "@/components/admin/UserRolesEditor";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "User roles — Admin",
};

export default async function AdminUsersPage() {
  let rows: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
  }[] = [];
  let error: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error: qErr } = await admin
      .from("user_info")
      .select("id, email, full_name, role")
      .order("created_at", { ascending: false })
      .limit(500);

    if (qErr) {
      error = qErr.message;
    } else {
      rows = (data ?? []) as typeof rows;
    }
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Admin client unavailable (configure service role)";
  }

  const normalized: AdminUserRoleRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    role: r.role === "admin" ? "admin" : "contractor",
  }));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        User roles
      </h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>
        <code style={{ fontSize: 13 }}>admin</code> unlocks{" "}
        <code style={{ fontSize: 13 }}>/admin</code> and skips billing write
        locks plus the AI quote daily cap while signed in. Optional{" "}
        <code style={{ fontSize: 13 }}>TRADEFLO_ADMIN_EMAILS</code> still works as
        bootstrap before a row here is promoted.
      </p>
      <p style={{ fontSize: 13, color: "#8a3520", marginBottom: 24 }}>
        Removing admin on your account (and not listing your email in{" "}
        <code style={{ fontSize: 12 }}>TRADEFLO_ADMIN_EMAILS</code>) ends operator
        access.
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
        </div>
      ) : null}

      <UserRolesEditor rows={normalized} />
    </div>
  );
}
