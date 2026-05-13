export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
