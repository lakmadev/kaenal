"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@kaenal/api-client";
import { signIn, AuthError } from "@/lib/auth";
import { setActiveTenant } from "@/lib/tenant";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";

/** Validated client-side; the API re-validates against the same rules (04 §1). */
const SignInSchema = z.object({
  workspace: z.string().min(1, "Workspace is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type SignInValues = z.infer<typeof SignInSchema>;

/**
 * Sign-in (04 §4). Cookie-session auth: on success the API sets the httpOnly
 * session + CSRF cookies; we persist the chosen workspace slug (sent as
 * `X-Tenant-Id` thereafter) and navigate into the app. A failed sign-in surfaces
 * inline — never revealing whether the email exists (the API returns a generic
 * error, 07 §2).
 */
export function SignInForm(): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(SignInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn({ tenant: values.workspace, email: values.email, password: values.password });
      setActiveTenant(values.workspace);
      // Drop any stale identity cached under a previous session.
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      router.replace("/dashboard");
    } catch (err) {
      setFormError(
        err instanceof AuthError && err.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : "Sign-in failed. Check your workspace, email, and password.",
      );
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <Logo />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-text">Sign in to Kaenal</h1>
        <p className="mt-1 text-[13px] text-muted">Quality &amp; Safety Management</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
            {formError !== null && (
              <div
                role="alert"
                className="rounded-md border px-3 py-2 text-[13px]"
                style={{ borderColor: "var(--danger-600)", background: "var(--danger-50)", color: "var(--danger-700)" }}
              >
                {formError}
              </div>
            )}

            <Field label="Workspace" error={errors.workspace?.message} required>
              {(a) => <Input {...a} {...register("workspace")} placeholder="acme" autoComplete="organization" />}
            </Field>

            <Field label="Email" error={errors.email?.message} required>
              {(a) => (
                <Input {...a} {...register("email")} type="email" placeholder="you@company.com" autoComplete="username" />
              )}
            </Field>

            <Field label="Password" error={errors.password?.message} required>
              {(a) => (
                <Input {...a} {...register("password")} type="password" autoComplete="current-password" />
              )}
            </Field>

            <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-[12px] text-muted">
        Forgot your password?{" "}
        <a href="/forgot-password" className="k-link">
          Reset it
        </a>
      </p>
    </div>
  );
}

function Logo(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12 L12 3 L21 12 L12 21 Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M3 12 L12 3 L21 12 L12 21 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor" />
    </svg>
  );
}
