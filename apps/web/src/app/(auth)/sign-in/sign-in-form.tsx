"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  TriangleAlert,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  Mail,
  RefreshCw,
  Smartphone,
  Clock,
  Info,
  Shield,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@kaenal/api-client";
import { signIn, forgotPassword, AuthError, isMfaRequired, isMfaBlocked } from "@/lib/auth";
import { setActiveTenant } from "@/lib/tenant";
import { AuthShell } from "@/components/auth/auth-shell";
import { CodeBoxes, MfaError } from "@/features/mfa/mfa-bits";

/**
 * Sign-in (04 §4), recreating the visual spec's `auth.jsx` flow: a workspace
 * picker first (each company has its own `slug.kaenal.app` tenant, resolved into
 * `X-Tenant-Id`), then the credential form. When the account has an active second
 * factor, a dedicated verification stage collects a TOTP (or recovery) code —
 * reproducing `src/mfa.jsx` `MfaChallenge`. An external partner whose workspace
 * mandates MFA but has none configured is hard-stopped on the `blocked` stage
 * (`MfaRequiredBlocked`). Cookie-session auth — the API sets the httpOnly session +
 * CSRF cookies; we persist the workspace slug and navigate in. Errors surface
 * inline and never reveal whether an email exists (07 §2).
 */
type Stage = "workspace" | "login" | "verify" | "blocked" | "forgot";

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
  // Second factor: after the server signals `mfaRequired`, the verify stage
  // collects either a 6-digit authenticator code or a one-time recovery code.
  const [mfaMode, setMfaMode] = useState<"code" | "recovery">("code");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");

  const resetMfa = (): void => {
    setMfaMode("code");
    setCode("");
    setRecovery("");
  };

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
      const res = await signIn({ tenant: workspace, email, password });
      if (isMfaRequired(res)) {
        // Password accepted; a second factor is required. Move to the challenge.
        resetMfa();
        setBusy(false);
        setStage("verify");
        return;
      }
      setActiveTenant(workspace);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      router.replace("/dashboard");
    } catch (error) {
      setBusy(false);
      if (isMfaBlocked(error)) {
        // Partner (or MFA-mandated account) with no factor configured.
        setStage("blocked");
        return;
      }
      setErr(signInErrorMessage(error, workspace));
    }
  };

  const submitVerify = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const entered = mfaMode === "code" ? code.replace(/\s/g, "") : recovery.trim();
    if (mfaMode === "code" && entered.length !== 6) {
      setErr("Enter the 6-digit code from your authenticator");
      return;
    }
    if (mfaMode === "recovery" && entered.length < 10) {
      setErr("Enter a recovery code");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const res = await signIn({ tenant: workspace, email, password, code: entered });
      if (isMfaRequired(res)) {
        // Shouldn't happen (we just sent a code), but keep the user on the step.
        setBusy(false);
        setErr(mfaMode === "code" ? "That code isn’t valid. Try again." : "That recovery code isn’t valid or has already been used.");
        return;
      }
      setActiveTenant(workspace);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      router.replace("/dashboard");
    } catch (error) {
      setBusy(false);
      // A wrong code is a 401 like a bad password; keep the challenge visible.
      if (error instanceof AuthError && error.status === 429) {
        setErr("Too many attempts. Please wait a moment and try again.");
        return;
      }
      setErr(mfaMode === "code" ? "That code isn’t valid. Try again." : "That recovery code isn’t valid or has already been used.");
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
                resetMfa();
              }}
              className="k-btn k-btn-plain k-btn-sm mb-3.5 self-start"
            >
              <ArrowLeft size={12} /> Switch workspace
            </button>

            <WorkspaceCard workspace={workspace} />

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

        {stage === "verify" && (
          <form onSubmit={(e) => void submitVerify(e)} key={mfaMode}>
            <button
              type="button"
              onClick={() => {
                setStage("login");
                setErr("");
                resetMfa();
              }}
              className="k-btn k-btn-plain k-btn-sm mb-3.5 self-start"
            >
              <ArrowLeft size={12} /> Back
            </button>

            <WorkspaceCard workspace={workspace} email={email} />

            <div
              className="mb-4 inline-flex self-start"
              style={{ padding: 12, borderRadius: "var(--r-md)", background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {mfaMode === "code" ? <Smartphone size={24} /> : <KeyRound size={24} />}
            </div>

            {mfaMode === "code" ? (
              <>
                <h1 className="mb-1.5 text-[26px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                  Two-factor verification
                </h1>
                <p className="mb-6 text-[13.5px] leading-relaxed text-muted">
                  Enter the 6-digit code from your authenticator app to finish signing in.
                </p>

                <label className="k-overline mb-2.5 block">Verification code</label>
                <CodeBoxes
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (err !== "") setErr("");
                  }}
                  disabled={busy}
                  invalid={err !== ""}
                  autoFocus
                />
                {err !== "" && <MfaError>{err}</MfaError>}

                <button
                  type="submit"
                  disabled={busy || code.replace(/\s/g, "").length !== 6}
                  className="k-btn k-btn-primary mt-5 w-full"
                  style={{ height: 44, fontSize: 14, justifyContent: "center", opacity: busy || code.replace(/\s/g, "").length !== 6 ? 0.6 : 1 }}
                >
                  {busy ? (
                    <>
                      <span className="k-spin" style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%" }} />{" "}
                      Verifying…
                    </>
                  ) : (
                    "Verify"
                  )}
                </button>

                <div className="mt-[18px] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaMode("recovery");
                      setErr("");
                    }}
                    className="k-link"
                    style={{ fontSize: 12.5, background: "none", padding: 0 }}
                  >
                    Use a recovery code instead
                  </button>
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>
                    <Clock size={12} /> Code refreshes every 30s
                  </span>
                </div>
              </>
            ) : (
              <>
                <h1 className="mb-1.5 text-[26px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                  Enter a recovery code
                </h1>
                <p className="mb-[22px] text-[13.5px] leading-relaxed text-muted">
                  Use one of the one-time backup codes you saved when you set up two-factor. Each code works only once.
                </p>

                <label className="k-overline mb-2 block">Recovery code</label>
                <input
                  className="k-input mono"
                  autoFocus
                  value={recovery}
                  onChange={(e) => {
                    setRecovery(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24));
                    if (err !== "") setErr("");
                  }}
                  placeholder="xxxxx-xxxxx-xxxxx-xxxxx"
                  aria-invalid={err !== ""}
                  style={{ height: 46, fontSize: 16, letterSpacing: "0.08em", borderColor: err !== "" ? "var(--danger-500)" : undefined }}
                />
                {err !== "" && <MfaError>{err}</MfaError>}

                <button
                  type="submit"
                  disabled={busy || recovery.trim().length < 10}
                  className="k-btn k-btn-primary mt-5 w-full"
                  style={{ height: 44, fontSize: 14, justifyContent: "center", opacity: busy || recovery.trim().length < 10 ? 0.6 : 1 }}
                >
                  {busy ? (
                    <>
                      <span className="k-spin" style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%" }} />{" "}
                      Verifying…
                    </>
                  ) : (
                    "Verify recovery code"
                  )}
                </button>

                <div className="mt-[18px]">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaMode("code");
                      setErr("");
                    }}
                    className="k-link"
                    style={{ fontSize: 12.5, background: "none", padding: 0 }}
                  >
                    ← Back to authenticator code
                  </button>
                </div>
              </>
            )}

            <div className="mt-7 flex items-center gap-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>
              <Info size={12} /> Lost access to your device and codes? Contact your workspace admin.
            </div>
          </form>
        )}

        {stage === "blocked" && (
          <>
            <WorkspaceCard workspace={workspace} email={email} />

            <div
              className="mb-[18px] inline-flex self-start"
              style={{ padding: 14, borderRadius: "var(--r-md)", background: "var(--warning-50)", color: "var(--warning-700)", border: "1px solid rgba(245,158,11,0.25)" }}
            >
              <Shield size={26} />
            </div>
            <h1 className="mb-2 text-[26px] font-bold" style={{ letterSpacing: "-0.01em" }}>
              Two-factor is required to continue
            </h1>
            <p className="mb-5 text-[13.5px] leading-[1.65] text-muted">
              <strong className="text-text">{slugToName(workspace)}</strong> requires two-factor authentication for this
              account, but it isn&rsquo;t set up yet. For security, this account can only enrol a second factor with help
              from an administrator.
            </p>

            <div className="k-surface mb-4 p-4" style={{ background: "var(--bg-subtle)" }}>
              <div className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold">
                <Mail size={14} /> What to do next
              </div>
              <ol className="m-0 list-decimal pl-[18px] text-[12.5px] leading-[1.8] text-muted">
                <li>
                  Contact your Kaenal administrator at{" "}
                  <strong className="text-text">{slugToName(workspace)}</strong>.
                </li>
                <li>
                  Ask them to send a two-factor setup link to <strong className="text-text">{email}</strong>.
                </li>
                <li>Follow the link to enrol an authenticator app, then sign in again.</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => {
                setStage("login");
                setErr("");
                setPassword("");
              }}
              className="k-link inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ background: "none", padding: 0 }}
            >
              <ArrowLeft size={12} /> Back to sign in
            </button>
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

/** The workspace context card shown above the credential and verify stages. */
function WorkspaceCard({ workspace, email }: { workspace: string; email?: string }): React.ReactElement {
  return (
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
        <div className="mono text-[11px] text-muted">{email !== undefined && email !== "" ? email : `${workspace}.kaenal.app`}</div>
      </div>
    </div>
  );
}

/**
 * Turn a sign-in failure into an actionable message. The old code collapsed
 * *every* error into "check your workspace, email, and password", which hid the
 * real cause — a wrong workspace, a stale browser session, a rate-limit, or the
 * server being unreachable all looked identical. We keep the genuine
 * bad-credentials case (401) generic so it never reveals whether an email
 * exists (enumeration-safe, 07 §2), but name the others so they can be fixed.
 */
function signInErrorMessage(error: unknown, workspace: string): string {
  // A rejected fetch (server down, wrong host, offline) is a TypeError, not an
  // AuthError — most common when reaching the app by IP with the API not up.
  if (!(error instanceof AuthError)) {
    return "Couldn’t reach the server. Check that the app is running and try again.";
  }
  if (error.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (error.code === "TENANT_NOT_FOUND") {
    return `Workspace “${workspace}” wasn’t found. Check the workspace name and try again.`;
  }
  if (error.status === 403) {
    // A stale browser session/CSRF cookie. The server no longer blocks sign-in
    // on this (anonymous routes skip CSRF), so seeing it means an older build —
    // clearing site cookies for this origin and reloading resolves it.
    return "Your browser session is stale. Clear this site’s cookies, reload, and sign in again.";
  }
  return "Sign-in failed. Check your workspace, email, and password.";
}

function InlineError({ message }: { message: string }): React.ReactElement {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[12px]" role="alert" style={{ color: "var(--danger-600)" }}>
      <TriangleAlert size={12} />
      {message}
    </div>
  );
}
