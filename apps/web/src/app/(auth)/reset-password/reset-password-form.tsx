"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Check, ShieldCheck, TriangleAlert } from "lucide-react";
import { resetPassword, AuthError } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import {
  PasswordStrength,
  PasswordRequirements,
  passwordChecks,
} from "@/components/auth/password-strength";

/**
 * Set a new password (04 §4, `auth.jsx` reset screen). Client validation mirrors
 * the server policy exactly (`@kaenal/core`), so the button only enables for a
 * password the API will accept. On success we show the confirmation screen — the
 * server has already revoked every other session (07 §2), which the copy states.
 */
export function ResetPasswordForm({ token }: { token: string }): React.ReactElement {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const { checks, allOk } = passwordChecks(pw, confirm);
  const noToken = token === "";

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!allOk || noToken) return;
    setErr("");
    setBusy(true);
    try {
      await resetPassword({ token, password: pw });
      setDone(true);
    } catch (error) {
      setBusy(false);
      setErr(
        error instanceof AuthError && error.status === 404
          ? "This reset link is invalid or has expired. Request a new one."
          : "Couldn't reset your password. Please try again.",
      );
    }
  };

  if (done) {
    return (
      <AuthShell>
        <div className="fade-in">
          <div
            className="mb-5 inline-flex self-start rounded-full p-[18px]"
            style={{ background: "var(--success-50)", color: "var(--success-600)" }}
          >
            <Check size={36} strokeWidth={2.25} />
          </div>
          <h1 className="mb-2 text-[30px] font-bold" style={{ letterSpacing: "-0.02em" }}>
            Password updated
          </h1>
          <p className="mb-6 text-[14px] leading-relaxed text-muted">
            Your password has been changed. For security, you&rsquo;ve been signed out of all other devices.
          </p>
          <div className="k-surface mb-4 p-3.5" style={{ background: "var(--bg-subtle)" }}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
              <ShieldCheck size={14} /> Security actions taken
            </div>
            <ul className="m-0 list-disc pl-[18px] text-[12px] leading-relaxed text-muted">
              <li>Reset link invalidated</li>
              <li>Other active sessions terminated</li>
              <li>A confirmation was sent to your email</li>
            </ul>
          </div>
          <Link href="/sign-in" className="k-btn k-btn-primary w-full" style={{ height: 44, fontSize: 14 }}>
            Sign in with new password
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="fade-in">
        <div
          className="mb-4 inline-flex self-start rounded-md p-3.5"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <KeyRound size={26} />
        </div>
        <h1 className="mb-2 text-[28px] font-bold" style={{ letterSpacing: "-0.01em" }}>
          Set a new password
        </h1>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted">
          Choose something memorable and unique to Kaenal.
        </p>

        {noToken && (
          <div
            className="mb-4 flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px]"
            role="alert"
            style={{ background: "var(--danger-50)", color: "var(--danger-700)" }}
          >
            <TriangleAlert size={14} /> This link is missing its reset token. Use the link from your email.
          </div>
        )}

        <form onSubmit={(e) => void submit(e)}>
          <label className="k-overline mb-1.5 block">New password</label>
          <PasswordField value={pw} onChange={setPw} autoFocus aria-label="New password" />
          <PasswordStrength password={pw} />

          <label className="k-overline mb-1.5 mt-4 block">Confirm new password</label>
          <PasswordField value={confirm} onChange={setConfirm} aria-label="Confirm new password" />

          <PasswordRequirements checks={checks} />

          {err !== "" && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px]" role="alert" style={{ color: "var(--danger-600)" }}>
              <TriangleAlert size={12} /> {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !allOk || noToken}
            className="k-btn k-btn-primary mt-4 w-full"
            style={{ height: 44, fontSize: 14 }}
          >
            {busy ? "Updating…" : "Set new password"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
