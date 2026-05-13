"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  signupCredentialsSchema,
  type SignupCredentialsValues,
} from "@/lib/schemas/auth";

type SignupFormProps = {
  redirectTo?: string;
};

export function SignupForm({ redirectTo = "/onboarding" }: SignupFormProps) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignupCredentialsValues>({
    resolver: zodResolver(signupCredentialsSchema),
    defaultValues: {
      email: "",
      password: "",
      confirm: "",
    },
  });

  async function onSubmit(values: SignupCredentialsValues) {
    setServerError(null);
    setServerMessage(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      const json = (await res.json()) as { hasSession?: boolean; error?: string };

      if (!res.ok || json.error) {
        setServerError(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (json.hasSession) {
        // Email confirmation is disabled — session was created immediately.
        router.push(redirectTo);
        router.refresh();
        return;
      }

      // Normal path: confirmation email sent.
      setServerMessage(
        "Success! Please check your email to verify your account.",
      );
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-8"
    >
      <div className="space-y-5">
        <Field
          data-invalid={!!form.formState.errors.email}
          className="gap-2"
        >
          <FieldLabel htmlFor="signup-email" className="text-[13px] font-medium text-[#6b6860]">
            Work Email
          </FieldLabel>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#a09d98] transition-colors group-focus-within:text-[#1a1916]" />
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.ca"
              className="h-[46px] pl-10 bg-[#fafaf8] border-[#e2e0db] border-[1.5px] focus:bg-white focus:border-[#1a1916] transition-all duration-150 rounded-[10px] text-[15px] outline-none"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
          </div>
          <FieldError errors={[form.formState.errors.email]} />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            data-invalid={!!form.formState.errors.password}
            className="gap-2"
          >
            <FieldLabel htmlFor="signup-password" className="text-[13px] font-medium text-[#6b6860]">
              Password
            </FieldLabel>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#a09d98] transition-colors group-focus-within:text-[#1a1916]" />
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="8+ chars"
                className="h-[46px] pl-10 bg-[#fafaf8] border-[#e2e0db] border-[1.5px] focus:bg-white focus:border-[#1a1916] transition-all duration-150 rounded-[10px] text-[15px] outline-none"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
            </div>
            <FieldError errors={[form.formState.errors.password]} />
          </Field>

          <Field
            data-invalid={!!form.formState.errors.confirm}
            className="gap-2"
          >
            <FieldLabel htmlFor="signup-confirm" className="text-[13px] font-medium text-[#6b6860]">
              Confirm
            </FieldLabel>
            <div className="relative group">
              <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#a09d98] transition-colors group-focus-within:text-[#1a1916]" />
              <Input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat it"
                className="h-[46px] pl-10 bg-[#fafaf8] border-[#e2e0db] border-[1.5px] focus:bg-white focus:border-[#1a1916] transition-all duration-150 rounded-[10px] text-[15px] outline-none"
                aria-invalid={!!form.formState.errors.confirm}
                {...form.register("confirm")}
              />
            </div>
            <FieldError errors={[form.formState.errors.confirm]} />
          </Field>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#e2e0db] bg-[#fafaf8] p-4 text-[12px] leading-relaxed text-[#6b6860] italic">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="text-[#1a1916] font-semibold hover:underline">Terms</Link>{" "}
        and our PIPEDA-compliant{" "}
        <Link href="/privacy" className="text-[#1a1916] font-semibold hover:underline">Privacy Policy</Link>.
      </div>

      {serverError ? (
        <Alert variant="destructive" className="border-[#fecaca] bg-[#fef2f2] text-[#991b1b] py-3 rounded-[10px]">
          <AlertDescription className="text-xs font-medium">{serverError}</AlertDescription>
        </Alert>
      ) : null}
      
      {serverMessage ? (
        <Alert className="border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] py-3 rounded-[10px]">
          <AlertDescription className="text-xs font-semibold">
            {serverMessage}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <Button
          type="submit"
          className="h-[48px] w-full bg-[#1a1916] hover:bg-[#333] text-white font-medium text-[15px] transition-all active:scale-[0.98] rounded-[10px] gap-2"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              Create Your Account
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        <p className="text-center text-[14px] text-[#6b6860]">
          Already using Tradeflo?{" "}
          <Link
            href={
              redirectTo && redirectTo !== "/"
                ? `/login?next=${encodeURIComponent(redirectTo)}`
                : "/login"
            }
            className="font-semibold text-[#1a1916] hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>

    </form>
  );
}
