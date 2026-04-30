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
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildDraftPayloadV1,
  parseQuoteDraftPayload,
  toUiMessages,
} from "@/lib/quotes/draft-payload";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const router = useRouter();
  const searchParams = useSearchParams();
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

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

  const hydrateFromPayload = useCallback(
    (payloadRecord: Record<string, unknown>) => {
      const p = parseQuoteDraftPayload(payloadRecord);
      setCurrentStep(p.currentStep);
      setCurrentMode(p.currentMode);
      setLines(p.lines);
      setSitePhotos(p.sitePhotos);
      setWorkLogs([]);
      setCollectedJobData(p.collectedJobData);
      setQuoteReady(p.quoteReady);
      setQuoteNum(p.quoteNum);
      setFname(p.fname);
      setLname(p.lname);
      setCemail(p.cemail);
      setCphone(p.cphone);
      setJobForm(p.jobForm);
      setQuoteNotes(p.quoteNotes);
      setPersonalNote(p.personalNote);
      setChangeText(p.changeText);
      setShowChangeBox(p.showChangeBox);
      setDelivery(p.delivery);
      setSentDone(p.sentDone);
      setAiRationale(p.aiRationale);
      setFormVoiceTranscript(p.formVoiceTranscript);
      setEditVoiceTranscript(p.editVoiceTranscript);
      setShowChatBuildBtn(p.showChatBuildBtn);
      const sid = p.chatSessionId || generateId();
      setChatSessionId(sid);
      const msgs = toUiMessages(p.chatMessages);
      setMessages(msgs.length ? msgs : [...welcomeMessages]);
    },
    [setMessages],
  );

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    const qp = searchParams.get("quote");

    void (async () => {
      setIsHydrating(true);
      setPersistError(null);

      try {
        if (qp && UUID_RE.test(qp)) {
          const res = await fetch(`/api/quotes/${qp}`, {
            signal: ac.signal,
          });
          if (res.ok) {
            const body = (await res.json()) as {
              data?: {
                id: string;
                draft?: { payload?: Record<string, unknown> };
              };
            };
            if (!cancelled && body.data) {
              const pl = body.data.draft?.payload;
              hydrateFromPayload(
                pl && typeof pl === "object" && !Array.isArray(pl)
                  ? (pl as Record<string, unknown>)
                  : {},
              );
              setQuoteId(body.data.id);
              router.replace(`/?quote=${body.data.id}`);
              return;
            }
          }
        }

        const listRes = await fetch("/api/quotes", { signal: ac.signal });
        if (!listRes.ok) {
          const err = (await listRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error ?? "Could not load quotes");
        }
        const listBody = (await listRes.json()) as {
          data?: Array<{
            id: string;
            draft?: { payload?: Record<string, unknown> };
          }>;
        };
        const items = listBody.data ?? [];

        if (!cancelled && items.length > 0) {
          const d = items[0]!;
          const pl = d.draft?.payload;
          hydrateFromPayload(
            pl && typeof pl === "object" && !Array.isArray(pl)
              ? (pl as Record<string, unknown>)
              : {},
          );
          setQuoteId(d.id);
          router.replace(`/?quote=${d.id}`);
          return;
        }

        const postRes = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: ac.signal,
        });
        if (!postRes.ok) {
          const err = (await postRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error ?? "Could not create quote");
        }
        const postBody = (await postRes.json()) as { data?: { id: string } };
        if (!cancelled && postBody.data?.id) {
          hydrateFromPayload({});
          setQuoteId(postBody.data.id);
          router.replace(`/?quote=${postBody.data.id}`);
        }
      } catch (e) {
        if (cancelled || (e instanceof Error && e.name === "AbortError"))
          return;
        setPersistError(
          e instanceof Error
            ? e.message
            : "Could not sync quote with the server",
        );
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
    // Run once on mount so `router.replace(?quote=)` does not re-trigger a full bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSnapshot = useMemo(
    () =>
      buildDraftPayloadV1({
        currentStep,
        currentMode,
        lines,
        sitePhotos,
        workLogs,
        collectedJobData,
        quoteReady,
        quoteNum,
        fname,
        lname,
        cemail,
        cphone,
        jobForm,
        quoteNotes,
        personalNote,
        changeText,
        showChangeBox,
        delivery,
        sentDone,
        aiRationale,
        formVoiceTranscript,
        editVoiceTranscript,
        showChatBuildBtn,
        chatSessionId,
        messages,
      }),
    [
      currentStep,
      currentMode,
      lines,
      sitePhotos,
      workLogs,
      collectedJobData,
      quoteReady,
      quoteNum,
      fname,
      lname,
      cemail,
      cphone,
      jobForm,
      quoteNotes,
      personalNote,
      changeText,
      showChangeBox,
      delivery,
      sentDone,
      aiRationale,
      formVoiceTranscript,
      editVoiceTranscript,
      showChatBuildBtn,
      chatSessionId,
      messages,
    ],
  );

  const sendQuote = useCallback(async () => {
    if (!quoteId) {
      setSendError("No quote to send. Refresh the page and try again.");
      return;
    }
    setIsSending(true);
    setSendError(null);
    try {
      const flushRes = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: persistSnapshot as unknown as Record<string, unknown>,
        }),
      });
      if (!flushRes.ok) {
        const err = (await flushRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          typeof err.error === "string" ? err.error : "Could not save quote",
        );
      }

      const sendRes = await fetch(`/api/quotes/${quoteId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalNote }),
      });
      const sendBody = (await sendRes.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!sendRes.ok) {
        throw new Error(
          typeof sendBody.error === "string"
            ? sendBody.error
            : "Send failed",
        );
      }
      setSentDone(true);
    } catch (e) {
      setSendError(
        e instanceof Error ? e.message : "Could not send quote",
      );
    } finally {
      setIsSending(false);
    }
  }, [quoteId, persistSnapshot, personalNote]);

  const typing = chatStatus === "submitted" || chatStatus === "streaming";
  const chatDisabled = chatStatus !== "ready";
  const chatError = chatHookError?.message ?? "";

  const generateMutation = useMutation({
    mutationFn: async (body: QuoteGenerateRequest) => {
      const url = quoteId
        ? `/api/quotes/${quoteId}/generate`
        : "/api/quote/generate";
      const res = await fetch(url, {
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
    if (isHydrating || !quoteId || generateMutation.isPending) return;

    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/quotes/${quoteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: persistSnapshot as unknown as Record<string, unknown>,
            }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(
              typeof err.error === "string" ? err.error : "Save failed",
            );
          }
          setPersistError(null);
        } catch (e) {
          setPersistError(
            e instanceof Error ? e.message : "Could not save quote",
          );
        }
      })();
    }, 1000);

    return () => clearTimeout(t);
  }, [persistSnapshot, quoteId, isHydrating, generateMutation.isPending]);

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

  const resetFlow = useCallback(async () => {
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
    setPersonalNote("");
    setChangeText("");
    setShowChangeBox(false);
    setDelivery("email");
    setCurrentMode("chat");
    setFormError("");
    setQuoteError("");
    setSendError(null);
    clearChatError();
    const nextSid = generateId();
    setChatSessionId(nextSid);
    setMessages([...welcomeMessages]);
    goTo(0);

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Failed to create quote");
      }
      const body = (await res.json()) as { data?: { id: string } };
      if (body.data?.id) {
        setQuoteId(body.data.id);
        router.replace(`/?quote=${body.data.id}`);
      }
    } catch (e) {
      setPersistError(
        e instanceof Error ? e.message : "Failed to start a new quote",
      );
    }
  }, [goTo, clearChatError, router, setMessages]);

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
    quoteId,
    sendQuote,
    isSending,
    sendError,
    isHydrating,
    persistError,
  };
}

export type QuoteBuilderModel = ReturnType<typeof useQuoteBuilderModel>;
