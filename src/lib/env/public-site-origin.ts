/**
 * Absolute site origin for redirects and public links (no trailing slash).
 * Requires `NEXT_PUBLIC_BASE_URL` in env.
 */
export function getPublicSiteOrigin(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  return fromEnv?.length ? fromEnv : null;
}
