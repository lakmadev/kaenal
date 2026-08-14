"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, X } from "lucide-react";
import { AuthError, changePassword } from "@/lib/auth";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength, PasswordRequirements, passwordChecks } from "@/components/auth/password-strength";

/**
 * Change the signed-in user's password from Settings › Security. Requires the
 * current password, validates the new one with the SAME policy the API enforces
 * (`passwordChecks`), and on success notes that other devices were signed out.
 * No binding jsx design exists for this in-app modal, so it follows the app's
 * modal + auth-field patterns.
 */
export function ChangePasswordModal({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}): React.ReactElement {
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const { checks, allOk } = passwordChecks(next, confirm, email);
  const canSubmit = current !== "" && allOk && !busy;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr("");
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      // Other sessions were revoked server-side — refresh the sessions list.
      await qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
      setDone(true);
    } catch (error) {
      setBusy(false);
      if (error instanceof AuthError && error.code !== "REQUEST_FAILED") {
        setErr(error.message);
      } else {
        setErr("Couldn’t change your password. Try again.");
      }
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="k-surface fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        style={{ width: 460, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "var(--shadow-xl)" }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <KeyRound size={17} />
          </div>
          <div className="flex-1 text-[15px] font-bold">Change password</div>
          <button onClick={onClose} aria-label="Close" className="k-btn-icon k-btn-plain">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="p-5">
            <div
              className="mb-4 inline-flex self-start rounded-full p-3"
              style={{ background: "var(--success-50)", color: "var(--success-600)" }}
            >
              <Check size={26} strokeWidth={2.5} />
            </div>
            <div className="mb-1.5 text-[16px] font-bold">Password changed</div>
            <p className="mb-5 text-[13px] leading-relaxed text-muted">
              Your password has been updated. For security, you&rsquo;ve been signed out of all your other devices.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="k-btn k-btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="p-5">
            <label className="k-overline mb-1.5 block">Current password</label>
            <PasswordField
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              autoFocus
              aria-label="Current password"
            />

            <label className="k-overline mb-1.5 mt-4 block">New password</label>
            <PasswordField value={next} onChange={setNext} aria-label="New password" />
            <PasswordStrength password={next} />

            <label className="k-overline mb-1.5 mt-4 block">Confirm new password</label>
            <PasswordField value={confirm} onChange={setConfirm} aria-label="Confirm new password" />

            <PasswordRequirements checks={checks} />

            {err !== "" && (
              <div className="mt-3 flex items-center gap-1.5 text-[12.5px]" role="alert" style={{ color: "var(--danger-600)" }}>
                {err}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="k-btn k-btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} className="k-btn k-btn-primary" style={{ opacity: canSubmit ? 1 : 0.6 }}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
