"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteFooter } from "@/components/quote-builder/QuoteFooter";
import "@/components/quote-builder/quote-builder.css";
import { onboardingBusinessBodySchema } from "@/lib/schemas/onboarding";
import type { OnboardingBusinessBody } from "@/lib/schemas/onboarding";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingProgress } from "./OnboardingProgress";

type OnboardingStatus = {
  completed: boolean;
  steps: {
    welcome: { completed: boolean };
    business: { completed: boolean };
    workLogs: { completed: boolean };
    ready: { completed: boolean };
  };
};

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

  const [business, setBusiness] = useState<OnboardingBusinessBody>({
    businessName: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
    province: "NB",
    tradeType: "",
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
      applyStepFromStatus(s);
    }
    return s;
  }, [fetchStatus, applyStepFromStatus]);

  const onSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessFieldErrors({});
    const parsed = onboardingBusinessBodySchema.safeParse(business);
    if (!parsed.success) {
      const fe: Partial<Record<keyof OnboardingBusinessBody, string>> = {};
      for (const iss of parsed.error.issues) {
        const k = iss.path[0];
        if (typeof k === "string" && k in business && !fe[k as keyof OnboardingBusinessBody]) {
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
