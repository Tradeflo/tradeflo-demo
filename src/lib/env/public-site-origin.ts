/**
 * Absolute site origin for redirects and public links (no trailing slash).
 * Uses `NEXT_PUBLIC_BASE_URL`, or the request URL origin when `request` is passed.
 */
export function getPublicSiteOrigin(request?: Request): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (fromEnv?.length) return fromEnv;
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      /* ignore */
    }
  }
  return null;
}
