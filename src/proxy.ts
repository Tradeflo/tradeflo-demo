import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/public-paths";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { contractorNeedsBillingSubscriptionRedirect } from "@/lib/billing/subscription-access";
import { contractorNeedsOnboardingRedirect } from "@/lib/onboarding/completion";
import { emitStructuredApiLog } from "@/lib/observability/structured-log";
import { updateSession } from "@/lib/supabase/proxy";

function redirectPreservingSessionCookies(
  sessionResponse: NextResponse,
  url: URL,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  const forwarded =
    typeof sessionResponse.headers.getSetCookie === "function"
      ? sessionResponse.headers.getSetCookie()
      : [];
  if (forwarded.length > 0) {
    for (const cookie of forwarded) {
      redirectResponse.headers.append("Set-Cookie", cookie);
    }
    return redirectResponse;
  }
  for (const { name, value } of sessionResponse.cookies.getAll()) {
    redirectResponse.cookies.set(name, value);
  }
  return redirectResponse;
}

function isBillingPath(pathname: string): boolean {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

/** Next.js 16+ uses `proxy.ts` instead of deprecated `middleware.ts`. */
export async function proxy(request: NextRequest) {
  try {
    const { response, user, supabase } = await updateSession(request);
    const { pathname } = request.nextUrl;

    // API routes: no HTML redirect (breaks fetch); handlers return 401 where needed.
    if (pathname.startsWith("/api/")) {
      return response;
    }

    if (user && (pathname === "/login" || pathname === "/signup")) {
      const next = request.nextUrl.searchParams.get("next");
      const dest = safeNextPath(next);
      return redirectPreservingSessionCookies(
        response,
        new URL(dest, request.url),
      );
    }

    if (!isPublicPath(pathname) && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const returnTo =
        pathname + (request.nextUrl.search || "");
      url.searchParams.set("next", returnTo);
      return redirectPreservingSessionCookies(response, url);
    }

    if (
      user &&
      !isPublicPath(pathname) &&
      !isOnboardingPath(pathname) &&
      (await contractorNeedsOnboardingRedirect(supabase, user))
    ) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return redirectPreservingSessionCookies(response, onboardingUrl);
    }

    if (
      user &&
      !isPublicPath(pathname) &&
      !isBillingPath(pathname) &&
      (await contractorNeedsBillingSubscriptionRedirect(supabase, user))
    ) {
      const billingUrl = request.nextUrl.clone();
      billingUrl.pathname = "/billing";
      billingUrl.search = "";
      return redirectPreservingSessionCookies(response, billingUrl);
    }

    return response;
  } catch (error) {
    emitStructuredApiLog({
      level: "error",
      action: "proxy",
      error,
      detail: { pathname: request.nextUrl.pathname },
    });
    Sentry.captureException(error);
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
