import type { QuoteRow, QuoteVersionRow } from "@/types/quote";

type VersionSlice = Pick<
  QuoteVersionRow,
  "id" | "version_number" | "status" | "payload" | "updated_at"
>;

export type QuoteWithVersionRows = QuoteRow & {
  quote_versions: VersionSlice[] | null;
};

function asRecordPayload(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function formatQuoteResponse(row: QuoteWithVersionRows) {
  const current = row.quote_versions?.find(
    (v) => v.version_number === row.current_version,
  );

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    draft: current
      ? {
          versionId: current.id,
          versionNumber: current.version_number,
          status: current.status,
          payload: asRecordPayload(current.payload),
          updatedAt: current.updated_at,
        }
      : {
          versionNumber: row.current_version,
          status: "draft" as const,
          payload: {} as Record<string, unknown>,
          updatedAt: row.updated_at,
        },
  };
}
