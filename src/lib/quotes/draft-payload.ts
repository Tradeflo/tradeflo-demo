import { z } from "zod";
import type { UIMessage } from "ai";
import type { DeliveryOption, JobFormData, LineItem, SitePhoto } from "@/components/quote-builder/types";

export const QUOTE_DRAFT_PAYLOAD_VERSION = 1 as const;

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

const sitePhotoSchema = z.object({
  id: z.string(),
  b64: z.string(),
  mime: z.string(),
  name: z.string(),
});

const jobFormSchema = z.object({
  jobType: z.string(),
  propertyType: z.string(),
  sqft: z.string(),
  scope: z.string(),
  address: z.string(),
  startWin: z.string(),
});

/** Stored under `quote_versions.payload` (JSON). */
export const quoteDraftPayloadV1Schema = z.object({
  v: z.literal(1),
  currentStep: z.number().int().min(0).max(20),
  currentMode: z.enum(["chat", "form"]),
  lines: z.array(lineItemSchema),
  sitePhotos: z.array(sitePhotoSchema),
  workLogNames: z.array(z.string()),
  collectedJobData: z.record(z.string(), z.unknown()),
  quoteReady: z.boolean(),
  quoteNum: z.string(),
  fname: z.string(),
  lname: z.string(),
  cemail: z.string(),
  cphone: z.string(),
  jobForm: jobFormSchema,
  quoteNotes: z.string(),
  personalNote: z.string(),
  changeText: z.string(),
  showChangeBox: z.boolean(),
  delivery: z.enum(["email", "sms", "both"]),
  sentDone: z.boolean(),
  aiRationale: z.string(),
  formVoiceTranscript: z.string(),
  editVoiceTranscript: z.string(),
  showChatBuildBtn: z.boolean(),
  chatSessionId: z.string(),
  chatMessages: z.array(z.unknown()),
});

export type QuoteDraftPayloadV1 = z.infer<typeof quoteDraftPayloadV1Schema>;

export const defaultQuoteDraftPayloadV1 = (): QuoteDraftPayloadV1 => ({
  v: 1,
  currentStep: 0,
  currentMode: "chat",
  lines: [],
  sitePhotos: [],
  workLogNames: [],
  collectedJobData: {},
  quoteReady: false,
  quoteNum: "QTE-" + Date.now().toString().slice(-6),
  fname: "",
  lname: "",
  cemail: "",
  cphone: "",
  jobForm: {
    jobType: "Exterior siding replacement",
    propertyType: "Residential",
    sqft: "",
    scope: "",
    address: "",
    startWin: "",
  },
  quoteNotes:
    "Quote valid for 30 days. Pricing assumes standard site access. Final scope confirmed on-site before work begins.",
  personalNote: "",
  changeText: "",
  showChangeBox: false,
  delivery: "email",
  sentDone: false,
  aiRationale: "",
  formVoiceTranscript: "",
  editVoiceTranscript: "",
  showChatBuildBtn: false,
  chatSessionId: "",
  chatMessages: [],
});

export function parseQuoteDraftPayload(raw: unknown): QuoteDraftPayloadV1 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultQuoteDraftPayloadV1();
  }
  const o = raw as Record<string, unknown>;
  const base = defaultQuoteDraftPayloadV1();
  const merged = { ...base, ...o, v: 1 as const };
  const parsed = quoteDraftPayloadV1Schema.safeParse(merged);
  if (parsed.success) return parsed.data;
  return base;
}

export function serializeChatMessages(messages: UIMessage[]): unknown[] {
  try {
    return JSON.parse(JSON.stringify(messages)) as unknown[];
  } catch {
    return [];
  }
}

export function toUiMessages(stored: unknown[]): UIMessage[] {
  if (!Array.isArray(stored) || stored.length === 0) return [];
  try {
    return JSON.parse(JSON.stringify(stored)) as UIMessage[];
  } catch {
    return [];
  }
}

export function buildDraftPayloadV1(input: {
  currentStep: number;
  currentMode: "chat" | "form";
  lines: LineItem[];
  sitePhotos: SitePhoto[];
  workLogNames: string[];
  collectedJobData: Record<string, unknown>;
  quoteReady: boolean;
  quoteNum: string;
  fname: string;
  lname: string;
  cemail: string;
  cphone: string;
  jobForm: JobFormData;
  quoteNotes: string;
  personalNote: string;
  changeText: string;
  showChangeBox: boolean;
  delivery: DeliveryOption;
  sentDone: boolean;
  aiRationale: string;
  formVoiceTranscript: string;
  editVoiceTranscript: string;
  showChatBuildBtn: boolean;
  chatSessionId: string;
  messages: UIMessage[];
}): QuoteDraftPayloadV1 {
  return {
    v: 1,
    currentStep: input.currentStep,
    currentMode: input.currentMode,
    lines: input.lines,
    sitePhotos: input.sitePhotos,
    workLogNames: input.workLogNames,
    collectedJobData: input.collectedJobData,
    quoteReady: input.quoteReady,
    quoteNum: input.quoteNum,
    fname: input.fname,
    lname: input.lname,
    cemail: input.cemail,
    cphone: input.cphone,
    jobForm: input.jobForm,
    quoteNotes: input.quoteNotes,
    personalNote: input.personalNote,
    changeText: input.changeText,
    showChangeBox: input.showChangeBox,
    delivery: input.delivery,
    sentDone: input.sentDone,
    aiRationale: input.aiRationale,
    formVoiceTranscript: input.formVoiceTranscript,
    editVoiceTranscript: input.editVoiceTranscript,
    showChatBuildBtn: input.showChatBuildBtn,
    chatSessionId: input.chatSessionId,
    chatMessages: serializeChatMessages(input.messages),
  };
}
