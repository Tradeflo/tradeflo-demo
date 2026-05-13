/** First-run setup path (must match `src/app/onboarding`). */
export const ONBOARDING_PATH = "/onboarding";

/**
 * Choose redirect after login when `next` is the generic home path.
 * Explicit deep links (`next` not `/`) are always respected.
 */
export function destinationAfterAuth(
  requested: string,
  onboardingCompleted: boolean,
): string {
  const isGenericHome = requested === "/" || requested === "";
  if (!isGenericHome) {
    return requested;
  }
  if (!onboardingCompleted) {
    return ONBOARDING_PATH;
  }
  return "/";
}
