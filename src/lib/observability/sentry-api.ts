import * as Sentry from "@sentry/nextjs";
import { emitStructuredApiLog } from "@/lib/observability/structured-log";

export type SentryApiDomain = "ai" | "billing" | "delivery" | "app";

/**
 * Report unexpected API failures to Sentry with stable tags for triage.
 * Do not pass secrets, raw request bodies, or provider tokens in `extra`.
 * Configure failure notifications in Sentry (alert rules → email/Slack).
 */
export function captureApiRouteError(params: {
  domain: SentryApiDomain;
  route: string;
  userId?: string | null;
  error: unknown;
  extra?: Record<string, string | number | boolean | undefined | null>;
}): void {
  emitStructuredApiLog({
    level: "error",
    action: `${params.domain} ${params.route}`,
    userId: params.userId,
    error: params.error,
    detail: params.extra,
  });

  const fallback =
    typeof params.error === "string"
      ? params.error
      : params.error != null &&
          typeof params.error === "object" &&
          "message" in params.error &&
          typeof (params.error as { message?: unknown }).message === "string"
        ? (params.error as { message: string }).message
        : "Unknown error";

  const err =
    params.error instanceof Error ? params.error : new Error(fallback);

  Sentry.withScope((scope) => {
    scope.setTag("api_domain", params.domain);
    scope.setTag("api_route", params.route);
    if (params.userId) {
      scope.setUser({ id: params.userId });
    }
    if (params.extra) {
      for (const [k, v] of Object.entries(params.extra)) {
        if (v !== undefined && v !== null) {
          scope.setExtra(k, v);
        }
      }
    }
    Sentry.captureException(err);
  });
}
