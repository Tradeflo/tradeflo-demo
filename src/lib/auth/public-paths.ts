/** Paths that do not require an authenticated Supabase session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/terms",
  "/privacy",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
