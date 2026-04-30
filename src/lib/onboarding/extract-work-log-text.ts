import * as XLSX from "xlsx";

const TEXT_CAP = 400_000;

export type WorkLogFileKind = "pdf" | "csv" | "txt" | "xlsx" | "xls";

export function workLogKindFromName(filename: string): WorkLogFileKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  return null;
}

export async function extractWorkLogText(
  buffer: Buffer,
  kind: WorkLogFileKind,
): Promise<{ text: string; error?: string }> {
  try {
    switch (kind) {
      case "txt":
      case "csv": {
        const text = buffer.toString("utf8").trim();
        return {
          text: text.slice(0, TEXT_CAP),
          ...(text.length === 0 ? { error: "No text in file." } : {}),
        };
      }
      case "xlsx":
      case "xls": {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const parts: string[] = [];
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          if (!sheet) continue;
          parts.push(XLSX.utils.sheet_to_csv(sheet));
        }
        const text = parts.join("\n\n").trim();
        return {
          text: text.slice(0, TEXT_CAP),
          ...(text.length === 0 ? { error: "No cells could be read." } : {}),
        };
      }
      case "pdf": {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        const raw = (data.text ?? "").trim();
        const text = raw.slice(0, TEXT_CAP);
        return {
          text,
          ...(text.length === 0 ? { error: "No extractable text in PDF." } : {}),
        };
      }
      default:
        return { text: "", error: "Unsupported file type." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed.";
    return { text: "", error: msg };
  }
}
