declare module "pdf-parse" {
  function pdf(buffer: Buffer): Promise<{ text?: string }>;
  export default pdf;
}

declare module "xlsx" {
  export function read(
    data: Buffer,
    opts: { type: "buffer" },
  ): {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  export const utils: {
    sheet_to_csv: (sheet: unknown) => string;
  };
}
