import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/public-paths";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { updateSession } from "@/lib/supabase/proxy";

/** Next.js 16+ uses `proxy.ts` instead of deprecated `middleware.ts`. */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // API routes: no HTML redirect (breaks fetch); handlers return 401 where needed.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const next = request.nextUrl.searchParams.get("next");
    const dest = safeNextPath(next);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (!isPublicPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const returnTo =
      pathname + (request.nextUrl.search || "");
    url.searchParams.set("next", returnTo);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
