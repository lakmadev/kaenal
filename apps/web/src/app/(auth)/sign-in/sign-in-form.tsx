"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, TriangleAlert, Eye, EyeOff, Lock, KeyRound, Mail, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@kaenal/api-client";
import { signIn, forgotPassword, AuthError } from "@/lib/auth";
import { setActiveTenant } from "@/lib/tenant";
import { AuthShell } from "@/components/auth/auth-shell";

/**
 * Sign-in (04 §4), recreating the visual spec's `auth.jsx` flow: a workspace
 * picker first (each company has its own `slug.kaenal.app` tenant, resolved into
 * `X-Tenant-Id`), then the credential form. Cookie-session auth — the API sets
 * the httpOnly session + CSRF cookies; we persist the workspace slug and navigate
 * in. Errors surface inline and never reveal whether an email exists (07 §2).
 *
 * The prototype's fake demo tenants / SSO / plan chips are omitted — they are
 * prototype fixtures with no backend, not product data to fabricate.
 */
type Stage = "workspace" | "login" | "forgot";

function slugToName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function SignInForm(): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<Stage>("workspace");
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const submitWorkspace = (e: React.FormEvent): void => {
    e.preventDefault();
    if (workspace.trim() === "") {
      setErr("Enter your workspace name");
      return;
    }
    setErr("");
    setStage("login");
  };

  const submitLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email.includes("@")) {
      setErr("Enter a valid email");
      return;
    }
    if (password.length < 1) {
      setErr("Enter your password");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      await signIn({ tenant: workspace, email, password });
      setActiveTenant(workspace);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      router.replace("/dashboard");
    } catch (error) {
      setBusy(false);
      setErr(
        error instanceof AuthError && error.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : "Sign-in failed. Check your workspace, email, and password.",
      );
    }
  };

  const submitForgot = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email.includes("@")) {
      setErr("Enter a valid email");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      await forgotPassword(email);
    } catch {
      /* forgot-password always succeeds to avoid account enumeration (07 §2) */
    }
    setBusy(false);
    setNotice("If that email has an account, a reset link is on its way.");
  };

  return (
    <AuthShell>
      <div className="fade-in" key={stage}>
        {stage === "workspace" && (
          <>
            <h1 className="mb-2 text-[32px] font-bold" style={{ letterSpacing: "-0.02em" }}>
              Sign in to Kaenal
            </h1>
            <p className="mb-8 text-[14px] text-muted">
              Each company has its own private workspace. Enter yours to continue.
            </p>

            <form onSubmit={submitWorkspace}>
              <label className="k-overline mb-2 block">Workspace</label>
              <div
                className="flex items-stretch overflow-hidden"
                style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)" }}
              >
                <input
                  autoFocus
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="your-company"
                  aria-label="Workspace"
                  className="flex-1 bg-transparent px-3 text-[14px] outline-none"
                  style={{ height: 44, border: "none" }}
                />
                <div
                  className="flex items-center px-3.5 text-[13px] text-muted"
                  style={{ background: "var(--bg-subtle)", borderLeft: "1px solid var(--border)" }}
                >
                  .kaenal.app
                </div>
              </div>
              {err !== "" && <InlineError message={err} />}

              <button
                type="submit"
                className="k-btn k-btn-primary mt-5 w-full"
                style={{ height: 44, fontSize: 14 }}
              >
                Continue <ArrowRight size={14} />
              </button>
            </form>
          </>
        )}

        {stage === "login" && (
          <>
            <button
              type="button"
              onClick={() => {
                setStage("workspace");
                setErr("");
              }}
              className="k-btn k-btn-plain k-btn-sm mb-3.5 self-start"
            >
              <ArrowLeft size={12} /> Switch workspace
            </button>

            <div
              className="mb-6 flex items-center gap-2.5 p-3"
              style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)" }}
            >
              <div
                className="flex items-center justify-center text-[15px] font-bold text-white"
                style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "var(--accent)" }}
              >
                {(workspace[0] ?? "K").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{slugToName(workspace)}</div>
                <div className="mono text-[11px] text-muted">{workspace}.kaenal.app</div>
              </div>
            </div>

            <h1 className="mb-1.5 text-[28px] font-bold">Welcome back</h1>
            <p className="mb-6 text-[13px] text-muted">Sign in to continue to your workspace.</p>

            <form onSubmit={(e) => void submitLogin(e)}>
              <label className="k-overline mb-1.5 block">Work email</label>
              <input
                className="k-input mb-3.5"
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                style={{ height: 42 }}
              />

              <div className="mb-1.5 flex items-center justify-between">
                <label className="k-overline">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setStage("forgot");
                    setErr("");
                  }}
                  className="k-link text-[11px]"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input
                  className="k-input"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ height: 42, paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute flex items-center justify-center text-muted"
                  style={{ right: 6, top: 6, width: 30, height: 30 }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {err !== "" && <InlineError message={err} />}

              <button
                type="submit"
                disabled={busy}
                className="k-btn k-btn-primary mt-5 w-full"
                style={{ height: 44, fontSize: 14 }}
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-8 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-subtle)" }}>
              <Lock size={11} /> SOC 2 Type II · ISO 27001 · GDPR · Data hosted in EU-West
            </div>
          </>
        )}

        {stage === "forgot" && (
          <>
            <button
              type="button"
              onClick={() => {
                setStage("login");
                setErr("");
                setNotice("");
              }}
              className="k-btn k-btn-plain k-btn-sm mb-3.5 self-start"
            >
              <ArrowLeft size={12} /> Back to sign in
            </button>

            {notice !== "" ? (
              <>
                <div
                  className="mb-5 inline-flex self-start rounded-full p-3.5"
                  style={{ background: "var(--success-50)", color: "var(--success-600)" }}
                >
                  <Mail size={28} />
                </div>
                <h1 className="mb-2 text-[28px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                  Check your inbox
                </h1>
                <p className="mb-6 text-[14px] leading-relaxed text-muted">
                  If <strong className="text-text">{email}</strong> matches an account, a password reset link is on
                  its way. The link expires in <strong className="text-text">30 minutes</strong>.
                </p>
                <div className="k-surface p-3.5" style={{ background: "var(--bg-subtle)" }}>
                  <div className="mb-1.5 text-[12px] font-semibold">Didn&rsquo;t get it?</div>
                  <ul className="m-0 list-disc pl-[18px] text-[12px] leading-relaxed text-muted">
                    <li>Check your spam folder</li>
                    <li>Make sure it&rsquo;s the email you use for this workspace</li>
                    <li>Give it a few minutes and try again</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => setNotice("")}
                    className="k-btn k-btn-ghost k-btn-sm mt-3"
                  >
                    <RefreshCw size={12} /> Resend reset link
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  className="mb-4 inline-flex self-start rounded-md p-3.5"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <KeyRound size={26} />
                </div>
                <h1 className="mb-2 text-[28px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                  Forgot your password?
                </h1>
                <p className="mb-5 text-[13.5px] leading-relaxed text-muted">
                  Enter your work email and we&rsquo;ll send a secure reset link.
                </p>
                <form onSubmit={(e) => void submitForgot(e)}>
                  <label className="k-overline mb-1.5 block">Work email</label>
                  <input
                    className="k-input"
                    autoFocus
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={{ height: 42 }}
                  />
                  {err !== "" && <InlineError message={err} />}
                  <button
                    type="submit"
                    disabled={busy}
                    className="k-btn k-btn-primary mt-5 w-full"
                    style={{ height: 44, fontSize: 14 }}
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </AuthShell>
  );
}

function InlineError({ message }: { message: string }): React.ReactElement {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[12px]" role="alert" style={{ color: "var(--danger-600)" }}>
      <TriangleAlert size={12} />
      {message}
    </div>
  );
}
