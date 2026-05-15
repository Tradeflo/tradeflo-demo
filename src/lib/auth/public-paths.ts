/** Paths that do not require an authenticated Supabase session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/terms",
  "/privacy",
  /** Customer quote approval link (SRS §4.4); no auth */
  "/approve",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
