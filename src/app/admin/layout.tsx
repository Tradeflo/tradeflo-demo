import Link from "next/link";
import { requireTradefloAdminUser } from "@/lib/admin/require-tradeflo-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTradefloAdminUser();

  return (
    <div style={{ minHeight: "100vh", background: "#faf9f7" }}>
      <header
        style={{
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "#fff",
          padding: "12px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, letterSpacing: "0.02em" }}>
          Tradeflo admin
        </span>
        <nav style={{ display: "flex", gap: 20, fontSize: 14 }}>
          <Link href="/admin/users" style={{ color: "#1a1916" }}>
            User roles
          </Link>
          <Link href="/admin/catalog-gaps" style={{ color: "#1a1916" }}>
            Catalog gaps
          </Link>
          <Link href="/admin/materials" style={{ color: "#1a1916" }}>
            Materials catalog
          </Link>
          <Link href="/" style={{ color: "#6b6860" }}>
            Site
          </Link>
        </nav>
      </header>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        {children}
      </div>
    </div>
  );
}
