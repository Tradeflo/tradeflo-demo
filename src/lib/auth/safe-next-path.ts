/**
 * Prevent open redirects: only same-origin relative paths are allowed.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (next == null || typeof next !== "string") return "/";

  let t = next.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return "/";
  }

  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  if (t.includes("\0") || t.includes("\n") || t.includes("\r")) return "/";

  const pathOnly = t.split("?")[0] ?? "";
  if (pathOnly.includes("//")) return "/";

  return t;
}
