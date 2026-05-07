/** Safe filename for Content-Disposition (ASCII, no path chars). */
export function quotePdfFilename(quoteNum: string, versionNumber: number): string {
  const base = quoteNum
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const q = base.length ? base : "quote";
  return `${q}-v${versionNumber}.pdf`;
}
