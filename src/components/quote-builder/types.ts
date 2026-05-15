import type {
  QuoteLineKind,
  QuoteLineLaborUnit,
  QuoteLinePriceSource,
} from "@/lib/schemas/quote-builder";

export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Persisted quote line price origin (SRS M3). Omitted ⇒ `estimated`. */
  source?: QuoteLinePriceSource;
  /** Material vs labour row (M3). Omitted ⇒ material for legacy drafts. */
  kind?: QuoteLineKind;
  /** When kind is labour: hour | day | flat. */
  laborUnit?: QuoteLineLaborUnit;
  /** AI guess for estimated material rows (catalog gap prioritization). */
  catalogCategory?: string;
};

export type SitePhoto = {
  id: string;
  b64: string;
  mime: string;
  name: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type JobFormData = {
  jobType: string;
  propertyType: string;
  sqft: string;
  scope: string;
  address: string;
  startWin: string;
};

export type DeliveryOption = "email" | "sms" | "both";

/** Row after POST `/api/onboarding/work-logs/upload` (quote builder session). */
export type WorkLogUploadRow = {
  id: string;
  fileName: string;
  processingStatus: string;
};
