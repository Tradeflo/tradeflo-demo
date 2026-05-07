import PDFDocument from "pdfkit";
import type { QuoteDraftPayloadV1 } from "@/lib/quotes/draft-payload";

export type SentQuotePdfMeta = {
  quoteTitle: string | null;
  versionNumber: number;
  sentAt: string | null;
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function safeSingleLine(s: string, max = 500): string {
  const t = s.replace(/[\r\n\t]+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Customer-facing PDF: line items and totals only (no internal `source` labels).
 * Matches SRS §4.10: Tradeflo branding + quote data from sent version payload.
 */
export function renderSentQuotePdf(
  payload: QuoteDraftPayloadV1,
  meta: SentQuotePdfMeta,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageInnerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    let y = doc.y;

    const ensureSpace = (need: number) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (y + need > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    };

    // Branding
    doc.fillColor("#0f172a").fontSize(22).font("Helvetica-Bold");
    doc.text("Tradeflo", left, y, { width: pageInnerWidth });
    y = doc.y + 4;
    doc.font("Helvetica").fontSize(9).fillColor("#64748b");
    doc.text("Quote document", left, y, { width: pageInnerWidth });
    y = doc.y + 16;

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16);
    doc.text(`Quote ${safeSingleLine(payload.quoteNum || "—", 80)}`, left, y, {
      width: pageInnerWidth,
    });
    y = doc.y + 6;

    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    if (meta.quoteTitle) {
      doc.text(safeSingleLine(meta.quoteTitle, 200), left, y, {
        width: pageInnerWidth,
      });
      y = doc.y + 4;
    }
    doc.text(`Version ${meta.versionNumber}`, left, y, { width: pageInnerWidth });
    y = doc.y + 2;
    if (meta.sentAt) {
      const d = new Date(meta.sentAt);
      const label = Number.isNaN(d.getTime())
        ? meta.sentAt
        : d.toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
      doc.text(`Sent ${label}`, left, y, { width: pageInnerWidth });
      y = doc.y + 14;
    } else {
      y = doc.y + 12;
    }

    // Customer
    ensureSpace(80);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Customer", left, y);
    y = doc.y + 4;
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    const customerName = `${payload.fname} ${payload.lname}`.trim();
    doc.text(safeSingleLine(customerName || "—", 200), left, y, {
      width: pageInnerWidth,
    });
    y = doc.y + 2;
    if (payload.cemail) {
      doc.text(safeSingleLine(payload.cemail, 200), left, y, {
        width: pageInnerWidth,
      });
      y = doc.y + 2;
    }
    if (payload.cphone) {
      doc.text(safeSingleLine(payload.cphone, 40), left, y, {
        width: pageInnerWidth,
      });
      y = doc.y + 12;
    } else {
      y = doc.y + 10;
    }

    // Job
    ensureSpace(100);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Job", left, y);
    y = doc.y + 4;
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    const jf = payload.jobForm;
    doc.text(
      `${safeSingleLine(jf.jobType, 120)} · ${safeSingleLine(jf.propertyType, 80)}`,
      left,
      y,
      { width: pageInnerWidth },
    );
    y = doc.y + 2;
    if (jf.address?.trim()) {
      doc.text(safeSingleLine(jf.address, 200), left, y, { width: pageInnerWidth });
      y = doc.y + 2;
    }
    if (jf.scope?.trim()) {
      doc.text(safeSingleLine(jf.scope, 800), left, y, {
        width: pageInnerWidth,
        align: "left",
      });
      y = doc.y + 12;
    } else {
      y = doc.y + 10;
    }

    // Line items
    ensureSpace(60);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Line items", left, y);
    y = doc.y + 8;

    const colDesc = left;
    const colQty = left + pageInnerWidth * 0.52;
    const colUnit = left + pageInnerWidth * 0.64;
    const colTotal = left + pageInnerWidth * 0.82;
    const descWidth = colQty - colDesc - 8;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b");
    doc.text("Description", colDesc, y, { width: descWidth });
    doc.text("Qty", colQty, y, { width: 36, align: "right" });
    doc.text("Unit", colUnit, y, { width: 56, align: "right" });
    doc.text("Total", colTotal, y, { width: 72, align: "right" });
    y = doc.y + 6;
    doc.moveTo(left, y).lineTo(left + pageInnerWidth, y).strokeColor("#e2e8f0").stroke();
    y += 8;

    let subtotal = 0;
    doc.font("Helvetica").fontSize(9).fillColor("#334155");

    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    for (const line of lines) {
      const desc = safeSingleLine(line.description, 2000);
      const qty = line.quantity;
      const unit = line.unitPrice;
      const total = line.total;
      subtotal += Number.isFinite(total) ? total : 0;

      ensureSpace(36);
      const rowStart = y;
      doc.text(desc, colDesc, y, { width: descWidth, align: "left" });
      const afterDescY = doc.y;
      doc.text(String(qty), colQty, rowStart, { width: 36, align: "right" });
      doc.text(formatMoney(unit), colUnit, rowStart, { width: 56, align: "right" });
      doc.text(formatMoney(total), colTotal, rowStart, { width: 72, align: "right" });
      y = Math.max(afterDescY, rowStart + 14) + 4;
    }

    if (lines.length === 0) {
      doc.fillColor("#94a3b8").text("No line items.", colDesc, y, { width: descWidth });
      y = doc.y + 8;
    }

    ensureSpace(40);
    y += 8;
    doc.moveTo(left, y).lineTo(left + pageInnerWidth, y).strokeColor("#e2e8f0").stroke();
    y += 10;

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a");
    doc.text("Total", colUnit, y, { width: 56, align: "right" });
    doc.text(formatMoney(subtotal), colTotal, y, { width: 72, align: "right" });
    y = doc.y + 16;

    const notes: string[] = [];
    if (payload.quoteNotes?.trim()) notes.push(payload.quoteNotes.trim());
    if (payload.personalNote?.trim()) notes.push(payload.personalNote.trim());

    if (notes.length > 0) {
      ensureSpace(60);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Notes", left, y);
      y = doc.y + 4;
      doc.font("Helvetica").fontSize(9).fillColor("#334155");
      for (const n of notes) {
        ensureSpace(40);
        doc.text(n, left, y, { width: pageInnerWidth, align: "left" });
        y = doc.y + 8;
      }
    }

    doc.end();
  });
}
