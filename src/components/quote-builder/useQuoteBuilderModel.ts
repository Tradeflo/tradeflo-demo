"use client";

import { useChat } from "@ai-sdk/react";
import { useMutation } from "@tanstack/react-query";
import {
  DefaultChatTransport,
  generateId,
  type UIMessage,
} from "ai";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QuoteGenerateRequest } from "@/lib/schemas/quote-builder";
import { getTextFromUIMessage } from "@/lib/ui-message";
import { compressImage } from "./image-utils";
import type {
  DeliveryOption,
  JobFormData,
  LineItem,
  SitePhoto,
} from "./types";

const WELCOME_TEXT =
  "Hi! Tell me about the job — what are you quoting?";

const LOADING_MESSAGES = [
  "Building your quote...",
  "Pricing materials and labour...",
  "Applying your rates...",
  "Almost done...",
];

function conversationFromMessages(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const t = getTextFromUIMessage(m);
      if (!t.trim()) return null;
      const label = m.role === "user" ? "Contractor" : "AI";
      return `${label}: ${t}`;
    })
    .filter(Boolean)
    .join("\n");
}

const welcomeMessages: UIMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    parts: [{ type: "text", text: WELCOME_TEXT }],
  },
];

export function useQuoteBuilderModel() {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentMode, setCurrentMode] = useState<"chat" | "form">("chat");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [workLogs, setWorkLogs] = useState<File[]>([]);
  const [collectedJobData, setCollectedJobData] = useState<
    Record<string, unknown>
  >({});
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoteNum, setQuoteNum] = useState(
    () => "QTE-" + Date.now().toString().slice(-6),
  );

  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [cemail, setCemail] = useState("");
  const [cphone, setCphone] = useState("");

  const [jobForm, setJobForm] = useState<JobFormData>({
    jobType: "Exterior siding replacement",
    propertyType: "Residential",
    sqft: "",
    scope: "",
    address: "",
    startWin: "",
  });

  const [quoteNotes, setQuoteNotes] = useState(
    "Quote valid for 30 days. Pricing assumes standard site access. Final scope confirmed on-site before work begins.",
  );
  const [personalNote, setPersonalNote] = useState("");
  const [changeText, setChangeText] = useState("");
  const [showChangeBox, setShowChangeBox] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryOption>("email");
  const [sentDone, setSentDone] = useState(false);

  const [loadingText, setLoadingText] = useState(LOADING_MESSAGES[0]);
  const [quoteError, setQuoteError] = useState("");
  const [formError, setFormError] = useState("");
  const [showChatBuildBtn, setShowChatBuildBtn] = useState(false);
  const [aiRationale, setAiRationale] = useState("");

  const [formVoiceTranscript, setFormVoiceTranscript] = useState("");
  const [editVoiceTranscript, setEditVoiceTranscript] = useState("");

  const [chatSessionId, setChatSessionId] = useState(() => generateId());

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const goTo = useCallback((n: number) => {
    setCurrentStep(n);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const {
    messages,
    sendMessage,
    status: chatStatus,
    setMessages,
    error: chatHookError,
    clearError: clearChatError,
  } = useChat({
    id: chatSessionId,
    messages: welcomeMessages,
    transport,
    onFinish: ({ message }) => {
      const text = getTextFromUIMessage(message);
      if (!text.includes("READY_TO_QUOTE")) return;

      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          setCollectedJobData(JSON.parse(match[0]) as Record<string, unknown>);
        } catch {
          setCollectedJobData({});
        }
      } else {
        setCollectedJobData({});
      }
      setShowChatBuildBtn(true);
      setQuoteReady(true);

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            parts: [
              {
                type: "text",
                text: "I have everything I need — your quote is ready to build.",
              },
            ],
          };
        }
        return next;
      });
    },
  });

  const typing = chatStatus === "submitted" || chatStatus === "streaming";
  const chatDisabled = chatStatus !== "ready";
  const chatError = chatHookError?.message ?? "";

  const generateMutation = useMutation({
    mutationFn: async (body: QuoteGenerateRequest) => {
      const res = await fetch("/api/quote/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | { lineItems: LineItem[]; rationale?: string; notes?: string }
        | { error: string; issues?: unknown };
      if (!res.ok) {
        const msg =
          "error" in data
            ? data.error
            : "Quote generation failed";
        throw new Error(msg);
      }
      if (!("lineItems" in data)) {
        throw new Error("Invalid response");
      }
      return data;
    },
    onSuccess: (data) => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      const nextLines = data.lineItems.map((item) => {
        const q = item.quantity ?? 1;
        const u = item.unitPrice ?? 0;
        const t = item.total ?? q * u;
        return {
          description: item.description,
          quantity: q,
          unitPrice: u,
          total: t,
        };
      });
      setLines(nextLines);

      if (data.rationale) setAiRationale("💡 " + data.rationale);
      if (data.notes) {
        setQuoteNotes((prev) => data.notes + "\n\n" + prev);
      }
    },
    onError: (err) => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setQuoteError(
        "Could not generate quote: " +
          (err instanceof Error ? err.message : "Unknown error") +
          ". Please try again.",
      );
      setLines([
        { description: "Materials", quantity: 1, unitPrice: 0, total: 0 },
        { description: "Labour", quantity: 1, unitPrice: 0, total: 0 },
      ]);
    },
  });

  useEffect(() => {
    if (!generateMutation.isPending) {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      return;
    }

    let li = 0;
    setLoadingText(LOADING_MESSAGES[0] ?? "Building your quote...");
    loadingIntervalRef.current = setInterval(() => {
      li = (li + 1) % LOADING_MESSAGES.length;
      setLoadingText(LOADING_MESSAGES[li] ?? LOADING_MESSAGES[0]);
    }, 1400);

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    };
  }, [generateMutation.isPending]);

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, []);

  const buildQuote = useCallback(
    (isChat: boolean, formJob?: JobFormData) => {
      if (!isChat && !formJob) return;

      goTo(1);
      setQuoteError("");
      setAiRationale("");

      if (!isChat && formJob) {
        setCollectedJobData({
          ...formJob,
          voiceNote: formVoiceTranscript,
        });
      }

      const sitePayload = sitePhotos.map((p) => ({
        b64: p.b64,
        mime: p.mime,
      }));

      const body: QuoteGenerateRequest = isChat
        ? {
            mode: "chat",
            conversation: conversationFromMessages(messages),
            collectedSummary: collectedJobData,
            sitePhotos: sitePayload,
            workLogCount: workLogs.length,
          }
        : {
            mode: "form",
            job: formJob!,
            formVoiceTranscript: formVoiceTranscript || undefined,
            sitePhotos: sitePayload,
            workLogCount: workLogs.length,
          };

      generateMutation.mutate(body);
    },
    [
      goTo,
      messages,
      collectedJobData,
      sitePhotos,
      workLogs,
      formVoiceTranscript,
      generateMutation,
    ],
  );

  const updateLine = useCallback(
    (index: number, patch: Partial<LineItem>) => {
      setLines((prev) => {
        const next = [...prev];
        const row = { ...next[index], ...patch };
        if ("quantity" in patch || "unitPrice" in patch) {
          row.total = row.quantity * row.unitPrice;
        }
        next[index] = row;
        return next;
      });
    },
    [],
  );

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { description: "New item", quantity: 1, unitPrice: 0, total: 0 },
    ]);
  }, []);

  const totalAmount = useMemo(
    () =>
      lines.reduce(
        (s, l) => s + (l.total || l.quantity * l.unitPrice),
        0,
      ),
    [lines],
  );

  const handleWorkLogs = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setWorkLogs((prev) => [...prev, ...Array.from(files)]);
  }, []);

  const removeWorkLog = useCallback((name: string) => {
    setWorkLogs((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleSitePhotos = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach((file) => {
      compressImage(file, (b64, mime) => {
        setSitePhotos((p) => {
          if (p.length >= 4) return p;
          return [
            ...p,
            { id: crypto.randomUUID(), b64, mime, name: file.name },
          ];
        });
      });
    });
  }, []);

  const removePhoto = useCallback((id: string) => {
    setSitePhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const resetFlow = useCallback(() => {
    setLines([]);
    setWorkLogs([]);
    setSitePhotos([]);
    setCollectedJobData({});
    setQuoteReady(false);
    setQuoteNum("QTE-" + Date.now().toString().slice(-6));
    setSentDone(false);
    setShowChatBuildBtn(false);
    setFname("");
    setLname("");
    setCemail("");
    setCphone("");
    setJobForm({
      jobType: "Exterior siding replacement",
      propertyType: "Residential",
      sqft: "",
      scope: "",
      address: "",
      startWin: "",
    });
    setFormVoiceTranscript("");
    setEditVoiceTranscript("");
    setAiRationale("");
    setQuoteNotes(
      "Quote valid for 30 days. Pricing assumes standard site access. Final scope confirmed on-site before work begins.",
    );
    setCurrentMode("chat");
    setFormError("");
    setQuoteError("");
    clearChatError();
    setChatSessionId(generateId());
    goTo(0);
  }, [goTo, clearChatError]);

  return {
    currentStep,
    goTo,
    currentMode,
    setCurrentMode,
    lines,
    setLines,
    sitePhotos,
    workLogs,
    messages,
    collectedJobData,
    quoteReady,
    quoteNum,
    fname,
    setFname,
    lname,
    setLname,
    cemail,
    setCemail,
    cphone,
    setCphone,
    jobForm,
    setJobForm,
    quoteNotes,
    setQuoteNotes,
    personalNote,
    setPersonalNote,
    changeText,
    setChangeText,
    showChangeBox,
    setShowChangeBox,
    delivery,
    setDelivery,
    sentDone,
    setSentDone,
    quoteLoading: generateMutation.isPending,
    loadingText,
    quoteError,
    chatError,
    clearChatError,
    formError,
    setFormError,
    showChatBuildBtn,
    chatDisabled,
    typing,
    chatStatus,
    aiRationale,
    formVoiceTranscript,
    setFormVoiceTranscript,
    editVoiceTranscript,
    setEditVoiceTranscript,
    sendMessage,
    buildQuote,
    updateLine,
    removeLine,
    addLine,
    totalAmount,
    handleWorkLogs,
    removeWorkLog,
    handleSitePhotos,
    removePhoto,
    resetFlow,
  };
}

export type QuoteBuilderModel = ReturnType<typeof useQuoteBuilderModel>;
