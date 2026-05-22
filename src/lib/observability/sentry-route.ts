import type { SentryApiDomain } from "@/lib/observability/sentry-api";
import { captureApiRouteError } from "@/lib/observability/sentry-api";

/** Catch unexpected thrown errors from App Router handlers and tag them in Sentry. */
export function wrapRouteWithSentry<A extends unknown[]>(
  routeLabel: string,
  domain: SentryApiDomain,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      captureApiRouteError({
        domain,
        route: routeLabel,
        error,
        extra: { source: "unhandled_route_throw" },
      });
      throw error;
    }
  };
}
