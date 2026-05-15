import type { OnboardingBusinessBody } from "@/lib/schemas/onboarding";

/** Must match onboarding short codes (`db/onboarding.sql` / business route). */
const CA_PROVINCE_CODES = new Set([
  "NL",
  "PE",
  "NS",
  "NB",
  "QC",
  "ON",
  "MB",
  "SK",
  "AB",
  "BC",
  "YT",
  "NT",
  "NU",
]);

/** Reverse `city + ", " + province` saved in `user_info.location`. */
export function splitSavedLocation(location: string | null): {
  city: string;
  province: string;
} {
  const t = location?.trim() ?? "";
  if (!t) return { city: "", province: "NB" };

  const m = /^(.+),\s*([A-Za-z]{2})\s*$/.exec(t);
  if (m) {
    const code = m[2].toUpperCase();
    if (CA_PROVINCE_CODES.has(code)) {
      return { city: m[1].trim(), province: code };
    }
  }

  return { city: t, province: "NB" };
}

function parsedMaterialsMarkup(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export type UserInfoRowForBusinessPrefill = {
  business_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  trade: string | null;
  materials_markup_percent: unknown;
  hst_number: string | null;
};

/** Values to merge onto form defaults until the business step is complete. */
export function businessFormPrefillFromUserInfo(
  u: UserInfoRowForBusinessPrefill,
): Partial<OnboardingBusinessBody> {
  const out: Partial<OnboardingBusinessBody> = {};

  if (typeof u.business_name === "string" && u.business_name.trim())
    out.businessName = u.business_name.trim();

  if (typeof u.full_name === "string" && u.full_name.trim())
    out.ownerName = u.full_name.trim();

  if (typeof u.phone === "string" && u.phone.trim())
    out.phone = u.phone.trim();

  if (typeof u.email === "string" && u.email.trim()) out.email = u.email.trim();

  const { city, province } = splitSavedLocation(u.location);
  out.city = city;
  out.province = province;

  if (typeof u.trade === "string" && u.trade.trim())
    out.tradeType = u.trade.trim();

  const markup = parsedMaterialsMarkup(u.materials_markup_percent);
  if (markup !== undefined) out.materialsMarkupPercent = markup;

  const h = u.hst_number;
  if (typeof h === "string") out.hstNumber = h.trim() || "";

  return out;
}
