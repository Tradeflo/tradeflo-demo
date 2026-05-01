import { randomUUID } from "crypto";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/api/session";
import {
  extractWorkLogText,
  workLogKindFromName,
} from "@/lib/onboarding/extract-work-log-text";
import { patchUserInfoOrInsert } from "@/lib/supabase/user-info";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "work-logs";
const MAX_BYTES = 10 * 1024 * 1024;

function safeFileSegment(name: string): string {
  const base = name.replace(/[/\\]/g, "").replace(/[^\w.\-() ]+/g, "_");
  return (base || "upload").slice(0, 180);
}

/** When `FormData` yields a Blob without a filename (some runtimes), infer extension for parsing. */
function fileNameFromBlob(blob: Blob): string {
  const m = (blob.type || "").toLowerCase();
  if (m.includes("pdf")) return "upload.pdf";
  if (m === "text/csv" || m.includes("csv")) return "upload.csv";
  if (
    m.includes("spreadsheet") ||
    m === "application/vnd.ms-excel" ||
    m.includes("spreadsheetml")
  ) {
    return "upload.xlsx";
  }
  if (m.startsWith("text/")) return "upload.txt";
  return "upload.pdf";
}

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }

  const raw = form.get("file");
  if (raw == null || typeof raw !== "object") {
    return jsonError('Missing file field "file"', 400);
  }
  if (!(raw instanceof Blob)) {
    return jsonError('Missing file field "file"', 400);
  }

  if (raw.size > MAX_BYTES) {
    return jsonError("File too large (max 10MB)", 400);
  }

  const displayName =
    raw instanceof File && raw.name?.trim()
      ? raw.name.trim()
      : fileNameFromBlob(raw);

  const kind = workLogKindFromName(displayName);
  if (!kind) {
    return jsonError(
      "Unsupported type. Use PDF, CSV, Excel (.xlsx, .xls), or TXT.",
      400,
    );
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const { text, error: extractMessage } = await extractWorkLogText(buffer, kind);
  const statusOk = text.length > 0;
  const processingStatus = statusOk ? "complete" : "failed";
  const processingError = statusOk
    ? null
    : (extractMessage ?? "No text could be extracted.");

  const supabase = await createClient();
  const storagePath = `${user.id}/${randomUUID()}_${safeFileSegment(displayName)}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: raw.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) {
    return jsonError(
      uploadErr.message ||
        "Storage upload failed. Ensure bucket work-logs exists and policies are applied (db/onboarding.sql).",
      500,
    );
  }

  const { data: row, error: insErr } = await supabase
    .from("work_logs")
    .insert({
      user_id: user.id,
      file_name: displayName,
      storage_path: storagePath,
      file_size_bytes: raw.size,
      file_type: kind,
      processing_status: processingStatus,
      raw_text: statusOk ? text : null,
      processing_error: processingError,
      processed_at: new Date().toISOString(),
    })
    .select("id, file_name, file_size_bytes, processing_status")
    .single();

  if (insErr || !row) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return jsonError(insErr?.message ?? "Failed to save work log", 500);
  }

  void patchUserInfoOrInsert(supabase, user.id, { work_logs_uploaded: true });

  const r = row as Record<string, unknown>;
  const id = r.id as string;
  const fileName = (r.file_name ?? r.fileName) as string;
  const fileSize = (r.file_size_bytes ?? r.fileSize) as number;
  const rowStatus = (r.processing_status ?? r.processingStatus) as
    | string
    | undefined;

  return jsonOk({
    success: true,
    workLog: {
      id,
      fileName,
      fileSize,
      processingStatus: rowStatus ?? processingStatus,
    },
  });
}
