"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  customerSchema,
  jobFormSchema,
  type CustomerFormValues,
  type JobFormValues,
} from "@/lib/schemas/quote-builder";
import { getTextFromUIMessage } from "@/lib/ui-message";
import type { QuoteBuilderModel } from "./useQuoteBuilderModel";
import { VoiceBar } from "./VoiceBar";

const JOB_TYPES = [
  "Exterior siding replacement",
  "Roofing — asphalt shingles",
  "Roofing — metal",
  "Deck build",
  "Foundation repair",
  "Window & door install",
  "Plumbing — residential service",
  "Electrical — panel upgrade",
  "Basement renovation",
  "Kitchen renovation",
  "Bathroom renovation",
  "Custom",
] as const;

type IntakeStepProps = { model: QuoteBuilderModel };

export function IntakeStep({ model }: IntakeStepProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const wlInputRef = useRef<HTMLInputElement>(null);
  const [chatInput, setChatInput] = useState("");

  const {
    currentMode,
    setCurrentMode,
    fname,
    setFname,
    lname,
    setLname,
    cemail,
    setCemail,
    cphone,
    setCphone,
    jobForm,
    messages,
    chatDisabled,
    typing,
    chatError,
    clearChatError,
    showChatBuildBtn,
    sendMessage,
    buildQuote,
    sitePhotos,
    handleSitePhotos,
    removePhoto,
    workLogs,
    handleWorkLogs,
    removeWorkLog,
    formVoiceTranscript,
    setFormVoiceTranscript,
    quoteNum,
    setFormError,
    setJobForm,
  } = model;

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fname,
      lname,
      cemail,
      cphone,
    },
  });

  const jobFormMethods = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      jobType: jobForm.jobType,
      propertyType: jobForm.propertyType,
      sqft: jobForm.sqft,
      scope: jobForm.scope,
      address: jobForm.address,
      startWin: jobForm.startWin,
    },
  });

  useEffect(() => {
    customerForm.reset({
      fname,
      lname,
      cemail,
      cphone,
    });
  }, [quoteNum, fname, lname, cemail, cphone, customerForm]);

  useEffect(() => {
    jobFormMethods.reset({
      jobType: jobForm.jobType,
      propertyType: jobForm.propertyType,
      sqft: jobForm.sqft,
      scope: jobForm.scope,
      address: jobForm.address,
      startWin: jobForm.startWin,
    });
  }, [quoteNum, jobForm, jobFormMethods]);

  const syncCustomerToModel = (v: CustomerFormValues) => {
    setFname(v.fname);
    setLname(v.lname);
    setCemail(v.cemail);
    setCphone(v.cphone);
  };

  const submitChatMessage = async (textRaw?: string) => {
    const text = (textRaw ?? chatInput).trim();
    if (!text) return;
    setChatInput("");
    clearChatError();
    await sendMessage({ text });
  };

  const onBuildFromChat = async () => {
    setFormError("");
    const ok = await customerForm.trigger();
    if (!ok) {
      setFormError("Please complete customer details before building the quote.");
      return;
    }
    const v = customerForm.getValues();
    syncCustomerToModel(v);
    buildQuote(true);
  };

  const onGenerateFromForm = async () => {
    setFormError("");
    const cOk = await customerForm.trigger();
    const jOk = await jobFormMethods.trigger();
    if (!cOk || !jOk) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    const cv = customerForm.getValues();
    const jv = jobFormMethods.getValues();
    syncCustomerToModel(cv);
    setJobForm({
      jobType: jv.jobType,
      propertyType: jv.propertyType,
      sqft: jv.sqft,
      scope: jv.scope,
      address: jv.address,
      startWin: jv.startWin,
    });
    buildQuote(false, {
      jobType: jv.jobType,
      propertyType: jv.propertyType,
      sqft: jv.sqft,
      scope: jv.scope,
      address: jv.address,
      startWin: jv.startWin,
    });
  };

  return (
    <>
      <div className="card">
        <div className="card-label">Customer details</div>
        <div className="row2">
          <Field
            className="field"
            data-invalid={!!customerForm.formState.errors.fname}
          >
            <FieldLabel htmlFor="qb-fname">First name</FieldLabel>
            <Input
              id="qb-fname"
              placeholder="First name"
              aria-invalid={!!customerForm.formState.errors.fname}
              {...customerForm.register("fname")}
            />
            <FieldError errors={[customerForm.formState.errors.fname]} />
          </Field>
          <Field
            className="field"
            data-invalid={!!customerForm.formState.errors.lname}
          >
            <FieldLabel htmlFor="qb-lname">Last name</FieldLabel>
            <Input
              id="qb-lname"
              placeholder="Last name"
              aria-invalid={!!customerForm.formState.errors.lname}
              {...customerForm.register("lname")}
            />
            <FieldError errors={[customerForm.formState.errors.lname]} />
          </Field>
        </div>
        <div className="row2">
          <Field
            className="field"
            data-invalid={!!customerForm.formState.errors.cemail}
          >
            <FieldLabel htmlFor="qb-email">Email</FieldLabel>
            <Input
              id="qb-email"
              type="email"
              placeholder="customer@email.com"
              aria-invalid={!!customerForm.formState.errors.cemail}
              {...customerForm.register("cemail")}
            />
            <FieldError errors={[customerForm.formState.errors.cemail]} />
          </Field>
          <Field
            className="field"
            data-invalid={!!customerForm.formState.errors.cphone}
          >
            <FieldLabel htmlFor="qb-phone">Phone</FieldLabel>
            <Input
              id="qb-phone"
              placeholder="902-555-0000"
              aria-invalid={!!customerForm.formState.errors.cphone}
              {...customerForm.register("cphone")}
            />
            <FieldError errors={[customerForm.formState.errors.cphone]} />
          </Field>
        </div>
      </div>

      <Tabs
        value={currentMode}
        onValueChange={(v) => setCurrentMode(v as "chat" | "form")}
        className="w-full"
      >
        <TabsList variant="line" className="mb-3 w-full">
          <TabsTrigger value="chat" className="gap-1">
            <span aria-hidden>🎤</span> Chat with AI
            <span className="mode-new-badge">NEW</span>
          </TabsTrigger>
          <TabsTrigger value="form" className="gap-1">
            <span aria-hidden>📋</span> Quick form
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0">
          <div id="chat-mode">
            <div className="chat-wrap">
              <div className="chat-messages" id="chat-messages">
                {messages.map((m) => {
                  const content = getTextFromUIMessage(m);
                  if (!content.trim()) return null;
                  return (
                    <div
                      key={m.id}
                      className={`msg ${m.role === "assistant" ? "ai" : "user"}`}
                    >
                      <div className="msg-avatar">
                        {m.role === "assistant" ? "AI" : "You"}
                      </div>
                      <div className="msg-bubble">{content}</div>
                    </div>
                  );
                })}
                {typing ? (
                  <div className="typing-indicator">
                    <div className="msg-avatar">AI</div>
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="chat-input-area">
                <VoiceBar
                  idleLabel="Tap to speak your answer"
                  onFinal={(text) => {
                    setChatInput(text);
                    void submitChatMessage(text);
                  }}
                />
                <div className="chat-input-row" style={{ marginTop: 10 }}>
                  <Textarea
                    className="chat-input min-h-[44px] resize-none"
                    rows={1}
                    placeholder="Or type here..."
                    value={chatInput}
                    disabled={chatDisabled}
                    onChange={(e) => setChatInput(e.target.value)}
                    onInput={(e) => {
                      const t = e.target as HTMLTextAreaElement;
                      t.style.height = "auto";
                      t.style.height = Math.min(t.scrollHeight, 110) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitChatMessage();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="chat-send h-auto shrink-0 rounded-xl"
                    disabled={chatDisabled}
                    onClick={() => void submitChatMessage()}
                    aria-label="Send message"
                  >
                    ↑
                  </Button>
                </div>
              </div>
            </div>
            {chatError ? (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertDescription>{chatError}</AlertDescription>
              </Alert>
            ) : null}
            {model.formError && currentMode === "chat" ? (
              <div className={`error-box show`}>{model.formError}</div>
            ) : null}
            {showChatBuildBtn ? (
              <Button
                type="button"
                className="btn btn-primary btn-full mt-2 w-full rounded-xl"
                onClick={() => void onBuildFromChat()}
              >
                Build quote from this conversation →
              </Button>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="form" className="mt-0">
          <div id="form-mode">
            <div className="card">
              <div className="card-label">Job details</div>
              <Field
                className="field"
                data-invalid={!!jobFormMethods.formState.errors.jobType}
              >
                <FieldLabel htmlFor="qb-jobtype">Job type</FieldLabel>
                <Controller
                  name="jobType"
                  control={jobFormMethods.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="qb-jobtype"
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="Job type" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_TYPES.map((j) => (
                            <SelectItem key={j} value={j}>
                              {j}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError errors={[fieldState.error]} />
                    </>
                  )}
                />
              </Field>
              <div className="row2">
                <Field
                  className="field"
                  data-invalid={!!jobFormMethods.formState.errors.propertyType}
                >
                  <FieldLabel htmlFor="qb-proptype">Property type</FieldLabel>
                  <Controller
                    name="propertyType"
                    control={jobFormMethods.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="qb-proptype"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue placeholder="Property" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Residential">
                              Residential
                            </SelectItem>
                            <SelectItem value="Commercial">
                              Commercial
                            </SelectItem>
                            <SelectItem value="Multi-unit">Multi-unit</SelectItem>
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </>
                    )}
                  />
                </Field>
                <Field
                  className="field"
                  data-invalid={!!jobFormMethods.formState.errors.sqft}
                >
                  <FieldLabel htmlFor="qb-sqft">Approx. sq ft</FieldLabel>
                  <Input
                    id="qb-sqft"
                    placeholder="e.g. 1,400"
                    aria-invalid={!!jobFormMethods.formState.errors.sqft}
                    {...jobFormMethods.register("sqft")}
                  />
                  <FieldError errors={[jobFormMethods.formState.errors.sqft]} />
                </Field>
              </div>
              <Field
                className="field"
                data-invalid={!!jobFormMethods.formState.errors.scope}
              >
                <FieldLabel htmlFor="qb-scope">Scope & notes</FieldLabel>
                <Textarea
                  id="qb-scope"
                  placeholder="Describe the job — materials, access, anything relevant..."
                  aria-invalid={!!jobFormMethods.formState.errors.scope}
                  {...jobFormMethods.register("scope")}
                />
                <FieldError errors={[jobFormMethods.formState.errors.scope]} />
              </Field>
              <Field
                className="field"
                data-invalid={!!jobFormMethods.formState.errors.address}
              >
                <FieldLabel htmlFor="qb-address">Site address</FieldLabel>
                <Input
                  id="qb-address"
                  placeholder="123 Main St, Halifax NS"
                  aria-invalid={!!jobFormMethods.formState.errors.address}
                  {...jobFormMethods.register("address")}
                />
                <FieldError errors={[jobFormMethods.formState.errors.address]} />
              </Field>
              <Field
                className="field"
                data-invalid={!!jobFormMethods.formState.errors.startWin}
              >
                <FieldLabel htmlFor="qb-start">Preferred start window</FieldLabel>
                <Input
                  id="qb-start"
                  placeholder="e.g. Mid May 2026"
                  aria-invalid={!!jobFormMethods.formState.errors.startWin}
                  {...jobFormMethods.register("startWin")}
                />
                <FieldError errors={[jobFormMethods.formState.errors.startWin]} />
              </Field>
            </div>
            <div className="card">
              <div className="card-label">Or describe by voice</div>
              <p className="help-text">
                Tap and describe the job naturally. AI extracts the details into
                the form.
              </p>
              <VoiceBar
                idleLabel="Tap to record job details"
                onFinal={(text) => {
                  const cur = jobFormMethods.getValues("scope");
                  jobFormMethods.setValue(
                    "scope",
                    cur ? cur + "\n" + text : text,
                  );
                  setFormVoiceTranscript(text);
                }}
              />
              <div
                className={`voice-transcript${formVoiceTranscript ? " show" : ""}`}
              >
                {formVoiceTranscript}
              </div>
            </div>
            {model.formError ? (
              <div className={`error-box show`}>{model.formError}</div>
            ) : null}
            <div className="btn-row">
              <Button
                type="button"
                className="btn btn-primary btn-full w-full rounded-xl"
                onClick={() => void onGenerateFromForm()}
              >
                Generate AI quote →
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="card" style={{ marginTop: 4 }}>
        <div className="card-label">
          Site photos
          {sitePhotos.length > 0 ? (
            <span className="badge badge-blue">Added</span>
          ) : null}
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          Add photos of the job site to improve quote accuracy. AI will factor
          in what it sees.
        </p>
        <div className="photo-strip">
          {sitePhotos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={`data:${p.mime};base64,${p.b64}`}
              alt=""
              className="photo-thumb"
              title="Click to remove"
              onClick={() => removePhoto(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") removePhoto(p.id);
              }}
              role="button"
              tabIndex={0}
            />
          ))}
          {sitePhotos.length < 4 ? (
            <button
              type="button"
              className="photo-add"
              aria-label="Add photos"
              onClick={() => photoInputRef.current?.click()}
            >
              +
            </button>
          ) : null}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          style={{ display: "none" }}
          onChange={(e) => {
            handleSitePhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="card" style={{ marginTop: 4 }}>
        <div className="card-label">
          Work log calibration
          {workLogs.length > 0 ? (
            <span className="badge badge-green">Active</span>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            padding: "14px 16px",
            background: "var(--green-bg)",
            border: "1px solid var(--green-border)",
            borderRadius: "var(--radius)",
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--green)",
              flexShrink: 0,
              marginTop: 4,
              animation: "livepulse 2s infinite",
            }}
          />
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--green)",
                marginBottom: 4,
              }}
            >
              AI calibrated from your job history
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--green)",
                lineHeight: 1.6,
                opacity: 0.85,
              }}
            >
              Previous invoices and work logs applied. Pricing calibrated to
              your real numbers — not industry averages.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {workLogs.length === 0 ? (
            <>
              <button
                type="button"
                className="worklog-zone"
                onClick={() => wlInputRef.current?.click()}
              >
                <div
                  style={{ fontSize: 18, marginBottom: 6, color: "var(--text3)" }}
                >
                  ↑
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--text2)",
                    fontWeight: 500,
                  }}
                >
                  Upload work logs
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text3)",
                    marginTop: 3,
                  }}
                >
                  PDF invoices, quotes, or CSV
                </div>
              </button>
              <input
                ref={wlInputRef}
                type="file"
                accept=".pdf,.csv,.txt,.xlsx"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  handleWorkLogs(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          ) : (
            <>
              <div className="worklog-zone loaded">
                <div
                  style={{ fontSize: 18, marginBottom: 6, color: "var(--green)" }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--green)",
                    fontWeight: 600,
                  }}
                >
                  {workLogs.length} work log{workLogs.length > 1 ? "s" : ""}{" "}
                  uploaded
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--green)",
                    marginTop: 3,
                    opacity: 0.8,
                  }}
                >
                  AI calibrating to your real numbers
                </div>
              </div>
              <div className="wl-list show">
                {workLogs.map((f) => (
                  <div key={f.name} className="wl-item">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--green)" }}>
                      ✓ Ready
                    </span>
                    <button
                      type="button"
                      className="wl-remove"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => removeWorkLog(f.name)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
