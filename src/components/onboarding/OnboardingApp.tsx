"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { QuoteFooter } from "@/components/quote-builder/QuoteFooter";
import "@/components/quote-builder/quote-builder.css";
import { onboardingBusinessBodySchema } from "@/lib/schemas/onboarding";
import type { OnboardingBusinessBody } from "@/lib/schemas/onboarding";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingProgress } from "./OnboardingProgress";

/** Business step draft: markup + labour rate empty until user sets values. */
type OnboardingBusinessFormValues = Omit<
  OnboardingBusinessBody,
  "materialsMarkupPercent" | "defaultLabourRate" | "defaultLabourRateUnit"
> & {
  materialsMarkupPercent: number | "";
  defaultLabourRate: number | "";
  defaultLabourRateUnit: OnboardingBusinessBody["defaultLabourRateUnit"] | "";
};

type OnboardingStatus = {
  completed: boolean;
  steps: {
    welcome: { completed: boolean };
    business: { completed: boolean };
    workLogs: { completed: boolean };
    ready: { completed: boolean };
  };
  /** Server snapshot for the business step when still incomplete (`null` when done). */
  businessPrefill: Partial<OnboardingBusinessBody> | null;
};

function mergeBusinessPrefillIntoState(
  prefill: Partial<OnboardingBusinessBody> | null | undefined,
  setBusiness: Dispatch<SetStateAction<OnboardingBusinessFormValues>>,
) {
  if (!prefill || Object.keys(prefill).length === 0) return;
  setBusiness((prev) => ({
    ...prev,
    ...prefill,
    materialsMarkupPercent:
      typeof prefill.materialsMarkupPercent === "number"
        ? prefill.materialsMarkupPercent
        : prev.materialsMarkupPercent,
    defaultLabourRate:
      typeof prefill.defaultLabourRate === "number"
        ? prefill.defaultLabourRate
        : prev.defaultLabourRate,
    defaultLabourRateUnit:
      prefill.defaultLabourRateUnit ?? prev.defaultLabourRateUnit,
  }));
}

const PROVINCES = [
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "QC", label: "Quebec" },
  { value: "ON", label: "Ontario" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
] as const;

const TYPICAL_MATERIAL_MARKUPS = [20, 25, 30, 35, 40] as const;

function typicalMarkupPct(
  n: number,
): n is (typeof TYPICAL_MATERIAL_MARKUPS)[number] {
  return (TYPICAL_MATERIAL_MARKUPS as readonly number[]).includes(n);
}

function materialsMarkupSelectValue(markup: number | ""): string {
  if (markup === "") return "";
  if (typicalMarkupPct(markup)) return String(markup);
  return "custom";
}

type UploadRow = {
  id: string;
  fileName: string;
  processingStatus: string;
};

export function OnboardingApp() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [step, setStep] = useState(0);

  const [business, setBusiness] = useState<OnboardingBusinessFormValues>({
    businessName: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
    province: "NB",
    tradeType: "",
    materialsMarkupPercent: "",
    defaultLabourRate: "",
    defaultLabourRateUnit: "",
    hstNumber: "",
  });
  const [businessFieldErrors, setBusinessFieldErrors] = useState<
    Partial<Record<keyof OnboardingBusinessBody, string>>
  >({});
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/onboarding/status", {
      credentials: "include",
    });
    if (res.status === 401) {
      router.replace("/login?next=/onboarding");
      return null;
    }
    const data = (await res.json().catch(() => ({}))) as
      | OnboardingStatus
      | { error?: string };
    if (!res.ok) {
      throw new Error(
        "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not load onboarding status",
      );
    }
    return data as OnboardingStatus;
  }, [router]);

  const applyStepFromStatus = useCallback((s: OnboardingStatus) => {
    if (s.completed) {
      router.replace("/");
      return;
    }
    if (!s.steps.business.completed) setStep(0);
    else if (!s.steps.workLogs.completed) setStep(1);
    else setStep(2);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchStatus();
        if (cancelled || !s) return;
        setStatus(s);
        mergeBusinessPrefillIntoState(s.businessPrefill, setBusiness);
        applyStepFromStatus(s);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchStatus, applyStepFromStatus]);

  const refreshStatus = useCallback(async () => {
    const s = await fetchStatus();
    if (s) {
      setStatus(s);
      mergeBusinessPrefillIntoState(s.businessPrefill, setBusiness);
      applyStepFromStatus(s);
    }
    return s;
  }, [fetchStatus, applyStepFromStatus]);

  const onSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessFieldErrors({});
    if (business.materialsMarkupPercent === "") {
      setBusinessFieldErrors({
        materialsMarkupPercent:
          "Choose a quick-pick markup or enter a percentage (0–500).",
      });
      return;
    }
    if (business.defaultLabourRate === "") {
      setBusinessFieldErrors({
        defaultLabourRate:
          "Enter your default labour rate in CAD (greater than zero).",
      });
      return;
    }
    if (business.defaultLabourRateUnit === "") {
      setBusinessFieldErrors({
        defaultLabourRateUnit:
          "Choose how this labour rate is counted (per hour, per day, or flat).",
      });
      return;
    }
    const labourUnit = business.defaultLabourRateUnit;
    const payload: OnboardingBusinessBody = {
      ...business,
      materialsMarkupPercent: business.materialsMarkupPercent,
      defaultLabourRate: business.defaultLabourRate,
      defaultLabourRateUnit: labourUnit,
    };
    const parsed = onboardingBusinessBodySchema.safeParse(payload);
    if (!parsed.success) {
      const fe: Partial<Record<keyof OnboardingBusinessBody, string>> = {};
      for (const iss of parsed.error.issues) {
        const k = iss.path[0];
        if (typeof k === "string" && k in payload && !fe[k as keyof OnboardingBusinessBody]) {
          fe[k as keyof OnboardingBusinessBody] = iss.message;
        }
      }
      setBusinessFieldErrors(fe);
      return;
    }

    setSavingBusiness(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...parsed.data };
      if (!parsed.data.hstNumber?.trim()) delete body.hstNumber;

      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save",
        );
      }
      const s = await refreshStatus();
      if (s?.steps.workLogs.completed) {
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingBusiness(false);
    }
  };

  const onWorkLogChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = "";
    if (!picked.length) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of picked) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/onboarding/work-logs/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const raw = (await res.json().catch(() => (null))) as
          | { error?: string; workLog?: unknown }
          | null;
        const wl = raw?.workLog as Record<string, unknown> | undefined;
        if (!res.ok) {
          throw new Error(
            typeof raw?.error === "string"
              ? raw.error
              : `Upload failed: ${file.name}`,
          );
        }
        if (!wl || wl.id == null) {
          throw new Error(
            "Upload succeeded but the server returned an unexpected response. Please refresh and try again.",
          );
        }
        const id = String(wl.id);
        const fileName =
          typeof wl.fileName === "string"
            ? wl.fileName
            : typeof wl.file_name === "string"
              ? wl.file_name
              : file.name;
        const processingStatus =
          typeof wl.processingStatus === "string"
            ? wl.processingStatus
            : typeof wl.processing_status === "string"
              ? wl.processing_status
              : "complete";
        setUploads((prev) => [...prev, { id, fileName, processingStatus }]);
      }
      // Refresh status data without auto-navigating to the next step.
      // The user should stay on this screen to upload more files or click "Continue".
      const s = await fetchStatus();
      if (s) setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSkipWorkLogs = async () => {
    setSkipping(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/skip-work-logs", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not skip",
        );
      }
      await refreshStatus();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not skip");
    } finally {
      setSkipping(false);
    }
  };

  const onFinish = async () => {
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not complete setup",
        );
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete setup");
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="qb-app">
        <OnboardingHeader />
        <div className="app">
          <main className="main">
            <div className="qb-banner qb-banner-muted" aria-busy="true">
              Loading…
            </div>
          </main>
          <QuoteFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="qb-app">
      {error ? (
        <div className="qb-banner qb-banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <OnboardingHeader />
      <div className="app">
        <main className="main">
          <OnboardingProgress currentStep={step} />

          {step === 0 ? (
            <form onSubmit={onSaveBusiness}>
              <div className="card">
                <div className="card-label">Business profile</div>
                <p className="help-text">
                  We use this to personalize quotes and keep your account
                  organized. All fields are required except HST number.
                </p>

                <div className="field">
                  <label htmlFor="ob-business">Business name</label>
                  <input
                    id="ob-business"
                    value={business.businessName}
                    onChange={(e) =>
                      setBusiness((b) => ({
                        ...b,
                        businessName: e.target.value,
                      }))
                    }
                    autoComplete="organization"
                  />
                  {businessFieldErrors.businessName ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--red)",
                        marginTop: 6,
                      }}
                    >
                      {businessFieldErrors.businessName}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="ob-owner">Owner / contact name</label>
                  <input
                    id="ob-owner"
                    value={business.ownerName}
                    onChange={(e) =>
                      setBusiness((b) => ({ ...b, ownerName: e.target.value }))
                    }
                    autoComplete="name"
                  />
                  {businessFieldErrors.ownerName ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--red)",
                        marginTop: 6,
                      }}
                    >
                      {businessFieldErrors.ownerName}
                    </p>
                  ) : null}
                </div>

                <div className="row2">
                  <div className="field">
                    <label htmlFor="ob-phone">Phone</label>
                    <input
                      id="ob-phone"
                      value={business.phone}
                      onChange={(e) =>
                        setBusiness((b) => ({ ...b, phone: e.target.value }))
                      }
                      autoComplete="tel"
                    />
                    {businessFieldErrors.phone ? (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--red)",
                          marginTop: 6,
                        }}
                      >
                        {businessFieldErrors.phone}
                      </p>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor="ob-email">Email</label>
                    <input
                      id="ob-email"
                      type="email"
                      value={business.email}
                      onChange={(e) =>
                        setBusiness((b) => ({ ...b, email: e.target.value }))
                      }
                      autoComplete="email"
                    />
                    {businessFieldErrors.email ? (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--red)",
                          marginTop: 6,
                        }}
                      >
                        {businessFieldErrors.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="row2">
                  <div className="field">
                    <label htmlFor="ob-city">City</label>
                    <input
                      id="ob-city"
                      value={business.city}
                      onChange={(e) =>
                        setBusiness((b) => ({ ...b, city: e.target.value }))
                      }
                      autoComplete="address-level2"
                    />
                    {businessFieldErrors.city ? (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--red)",
                          marginTop: 6,
                        }}
                      >
                        {businessFieldErrors.city}
                      </p>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor="ob-province">Province / territory</label>
                    <select
                      id="ob-province"
                      value={business.province}
                      onChange={(e) =>
                        setBusiness((b) => ({
                          ...b,
                          province: e.target.value,
                        }))
                      }
                    >
                      {PROVINCES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {businessFieldErrors.province ? (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--red)",
                          marginTop: 6,
                        }}
                      >
                        {businessFieldErrors.province}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="ob-trade">Trade type</label>
                  <input
                    id="ob-trade"
                    value={business.tradeType}
                    onChange={(e) =>
                      setBusiness((b) => ({ ...b, tradeType: e.target.value }))
                    }
                    placeholder="e.g. Electrical — residential"
                  />
                  {businessFieldErrors.tradeType ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--red)",
                        marginTop: 6,
                      }}
                    >
                      {businessFieldErrors.tradeType}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="ob-markup-select">
                    Default materials markup
                  </label>
                  <p
                    className="help-text"
                    style={{ marginTop: 4, marginBottom: 8 }}
                  >
                    Typical values are 20%–40%, or choose Custom for any other rate.
                    This is saved to your profile and applied automatically on
                    material line items whenever you generate a quote.
                  </p>
                  <select
                    id="ob-markup-select"
                    value={materialsMarkupSelectValue(business.materialsMarkupPercent)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBusinessFieldErrors((fe) => {
                        const next = { ...fe };
                        delete next.materialsMarkupPercent;
                        return next;
                      });
                      setBusiness((b) => {
                        if (v === "") {
                          return { ...b, materialsMarkupPercent: "" };
                        }
                        if (v === "custom") {
                          return {
                            ...b,
                            materialsMarkupPercent:
                              b.materialsMarkupPercent === ""
                                ? ""
                                : b.materialsMarkupPercent,
                          };
                        }
                        return {
                          ...b,
                          materialsMarkupPercent: Number(v),
                        };
                      });
                    }}
                  >
                    <option value="">Select markup…</option>
                    {TYPICAL_MATERIAL_MARKUPS.map((pct) => (
                      <option key={pct} value={String(pct)}>
                        {pct}%
                      </option>
                    ))}
                    <option value="custom">Custom…</option>
                  </select>
                  {materialsMarkupSelectValue(business.materialsMarkupPercent) ===
                  "custom" ? (
                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor="ob-markup-custom">Custom (%)</label>
                      <input
                        id="ob-markup-custom"
                        type="number"
                        min={0}
                        max={500}
                        step={0.5}
                        value={
                          business.materialsMarkupPercent === ""
                            ? ""
                            : business.materialsMarkupPercent
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setBusiness((b) => ({
                              ...b,
                              materialsMarkupPercent: "",
                            }));
                            return;
                          }
                          const n = parseFloat(raw);
                          setBusiness((b) => ({
                            ...b,
                            materialsMarkupPercent: Number.isFinite(n)
                              ? n
                              : "",
                          }));
                        }}
                        autoComplete="off"
                      />
                    </div>
                  ) : null}
                  {businessFieldErrors.materialsMarkupPercent ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--red)",
                        marginTop: 6,
                      }}
                    >
                      {businessFieldErrors.materialsMarkupPercent}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Default labour rate
                  </span>
                  <p
                    className="help-text"
                    style={{ marginTop: 4, marginBottom: 8 }}
                  >
                    Your usual labour price in CAD and how you count it (per
                    hour, per day, or as a flat job rate). Stored on your
                    profile and used when pricing labour line items on quotes.
                  </p>
                  <div className="row2">
                    <div className="field">
                      <label htmlFor="ob-labour-rate">Amount (CAD)</label>
                      <input
                        id="ob-labour-rate"
                        type="number"
                        min={0}
                        step={0.01}
                        inputMode="decimal"
                        value={
                          business.defaultLabourRate === ""
                            ? ""
                            : business.defaultLabourRate
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setBusiness((b) => ({
                              ...b,
                              defaultLabourRate: "",
                            }));
                            return;
                          }
                          const n = parseFloat(raw);
                          setBusiness((b) => ({
                            ...b,
                            defaultLabourRate: Number.isFinite(n) ? n : "",
                          }));
                        }}
                        autoComplete="off"
                      />
                      {businessFieldErrors.defaultLabourRate ? (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--red)",
                            marginTop: 6,
                          }}
                        >
                          {businessFieldErrors.defaultLabourRate}
                        </p>
                      ) : null}
                    </div>
                    <div className="field">
                      <label htmlFor="ob-labour-unit">Unit</label>
                      <select
                        id="ob-labour-unit"
                        value={business.defaultLabourRateUnit}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBusinessFieldErrors((fe) => {
                            const next = { ...fe };
                            delete next.defaultLabourRateUnit;
                            return next;
                          });
                          setBusiness((b) => ({
                            ...b,
                            defaultLabourRateUnit:
                              v === ""
                                ? ""
                                : (v as OnboardingBusinessBody["defaultLabourRateUnit"]),
                          }));
                        }}
                      >
                        <option value="">Select unit…</option>
                        <option value="hour">Per hour</option>
                        <option value="day">Per day</option>
                        <option value="flat">Flat rate</option>
                      </select>
                      {businessFieldErrors.defaultLabourRateUnit ? (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--red)",
                            marginTop: 6,
                          }}
                        >
                          {businessFieldErrors.defaultLabourRateUnit}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="ob-hst">HST number (optional)</label>
                  <input
                    id="ob-hst"
                    value={business.hstNumber ?? ""}
                    onChange={(e) =>
                      setBusiness((b) => ({ ...b, hstNumber: e.target.value }))
                    }
                    autoComplete="off"
                  />
                  {businessFieldErrors.hstNumber ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--red)",
                        marginTop: 6,
                      }}
                    >
                      {businessFieldErrors.hstNumber}
                    </p>
                  ) : null}
                </div>

                <div className="btn-row">
                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={savingBusiness}
                  >
                    {savingBusiness ? "Saving…" : "Continue"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {step === 1 ? (
            <div className="card">
              <div className="card-label">Work history</div>
              <p className="help-text">
                Upload past invoices, quotes, or spreadsheets (PDF, Excel,
                CSV, TXT). We extract text so AI can align pricing with your real
                jobs — or skip if you prefer to start fresh.
              </p>

              <label
                className={`worklog-zone${uploads.length > 0 ? " loaded" : ""}${uploading ? " is-busy" : ""}`}
                style={
                  uploading
                    ? { opacity: 0.85, pointerEvents: "none" }
                    : undefined
                }
              >
                <input
                  type="file"
                  className="worklog-zone-input"
                  accept=".pdf,.csv,.txt,.xlsx,.xls,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  multiple
                  onChange={(e) => void onWorkLogChange(e)}
                  disabled={uploading}
                  aria-label="Choose work log files to upload"
                />
                <div
                  style={{
                    fontSize: 18,
                    marginBottom: 6,
                    color: uploads.length ? "var(--green)" : "var(--text3)",
                  }}
                >
                  {uploads.length ? "✓" : "↑"}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--text2)",
                    fontWeight: 500,
                  }}
                >
                  {uploading ? "Uploading…" : "Upload work logs"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text3)",
                    marginTop: 3,
                  }}
                >
                  PDF, .xlsx, .xls, .csv, or .txt · max 10 MB per file
                </div>
              </label>

              {uploads.length > 0 ? (
                <div className="wl-list show" style={{ marginTop: 12 }}>
                  {uploads.map((u) => (
                    <div key={u.id} className="wl-item">
                      <span>
                        {u.fileName}
                        {u.processingStatus === "complete" ? (
                          <span className="badge badge-green" style={{ marginLeft: 8 }}>
                            Ready
                          </span>
                        ) : u.processingStatus === "failed" ? (
                          <span className="badge badge-amber" style={{ marginLeft: 8 }}>
                            No text extracted
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="btn-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setStep(0)}
                  disabled={uploading || skipping}
                >
                  Back
                </button>
                {uploads.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setStep(2)}
                    disabled={uploading}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void onSkipWorkLogs()}
                    disabled={uploading || skipping}
                  >
                    {skipping ? "Skipping…" : "Skip for now"}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="card">
              <div className="card-label">You&apos;re ready</div>
              <p className="help-text">
                Your profile is saved
                {status?.steps.workLogs.completed
                  ? ", and uploaded work history will inform new quotes."
                  : "."}
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => void onFinish()}
                  disabled={finishing}
                >
                  {finishing ? "Opening builder…" : "Go to quote builder"}
                </button>
              </div>
            </div>
          ) : null}
        </main>
        <QuoteFooter />
      </div>
    </div>
  );
}
