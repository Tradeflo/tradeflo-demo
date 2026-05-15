/** North-America-focused E.164 for Twilio (+1 …). Returns null if unrecognized. */
export function normalizePhoneToE164NANP(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\+1\d{10}$/.test(t.replace(/\s/g, ""))) {
    return t.replace(/\s/g, "");
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (t.startsWith("+")) {
    const compact = "+" + digits;
    return compact.length >= 8 ? compact : null;
  }
  return null;
}
