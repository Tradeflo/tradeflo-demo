"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  loginCredentialsSchema,
  type LoginCredentialsValues,
} from "@/lib/schemas/auth";

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo = "/" }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginCredentialsValues>({
    resolver: zodResolver(loginCredentialsSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginCredentialsValues) {
    setServerError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    router.push(redirectTo);
    router.refresh();
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
          <FieldLabel htmlFor="login-email" className="text-[13px] font-medium text-[#6b6860]">
            Work Email
          </FieldLabel>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#a09d98] transition-colors group-focus-within:text-[#1a1916]" />
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="name@company.ca"
              className="h-[46px] pl-10 bg-[#fafaf8] border-[#e2e0db] border-[1.5px] focus:bg-white focus:border-[#1a1916] transition-all duration-150 rounded-[10px] text-[15px] outline-none"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
          </div>
          <FieldError errors={[form.formState.errors.email]} />
        </Field>

        <Field
          data-invalid={!!form.formState.errors.password}
          className="gap-2"
        >
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="login-password" className="text-[13px] font-medium text-[#6b6860]">
              Password
            </FieldLabel>
            <Link href="/reset-password" title="Forgot password?" className="text-[12px] font-medium text-[#1a1916] hover:underline">
              Forgot?
            </Link>
          </div>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#a09d98] transition-colors group-focus-within:text-[#1a1916]" />
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-[46px] pl-10 bg-[#fafaf8] border-[#e2e0db] border-[1.5px] focus:bg-white focus:border-[#1a1916] transition-all duration-150 rounded-[10px] text-[15px] outline-none"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
          </div>
          <FieldError errors={[form.formState.errors.password]} />
        </Field>
      </div>

      {serverError ? (
        <Alert variant="destructive" className="border-[#fecaca] bg-[#fef2f2] text-[#991b1b] py-3 rounded-[10px]">
          <AlertDescription className="text-xs font-medium">{serverError}</AlertDescription>
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
              Sign In
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        <div className="text-center">
          <p className="text-[14px] text-[#6b6860]">
            New to Tradeflo?{" "}
            <Link
              href={redirectTo && redirectTo !== "/" ? `/signup?next=${encodeURIComponent(redirectTo)}` : "/signup"}
              className="font-semibold text-[#1a1916] hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>

    </form>
  );
}
