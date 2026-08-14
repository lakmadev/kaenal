"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { AuthError } from "@/lib/auth";
import { getActiveTenant } from "@/lib/tenant";
import { useMfaActivate, useMfaEnroll } from "@/hooks/use-mfa";
import { CodeBoxes, MfaError, MfaNote, QrImage, RecoveryCodesGrid, RecoveryActions } from "./mfa-bits";

/**
 * Enrolment flow (binding design `MfaEnrollModal`): a 3-step modal — scan the QR /
 * enter the setup key → confirm a code → save the one-time recovery codes. Wired
 * to `POST /enroll` (step 1) and `POST /activate` (step 2). The recovery codes are
 * shown once, on step 3, and never fetched again.
 */

/** otpauth://…?secret=BASE32 → "BASE3 2GRO UPED" for manual entry. */
function setupKeyFromUri(uri: string): string {
  const secret = new URL(uri.replace(/^otpauth:\/\//, "https://otpauth/")).searchParams.get("secret") ?? "";
  return (secret.match(/.{1,4}/g) ?? [secret]).join(" ");
}

const STEPS = [
  { n: 1, l: "Scan" },
  { n: 2, l: "Confirm" },
  { n: 3, l: "Save codes" },
];

export function MfaEnrollModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}): React.ReactElement {
  const workspace = getActiveTenant() ?? "your-workspace";
  const enroll = useMfaEnroll();
  const activate = useMfaActivate();

  const [step, setStep] = useState(1);
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);

  // Kick off enrolment once when the modal opens.
  const enrollMutate = enroll.mutate;
  useEffect(() => {
    enrollMutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupKey = useMemo(
    () => (enroll.data === undefined ? "" : setupKeyFromUri(enroll.data.otpauthUri)),
    [enroll.data],
  );

  const confirm = (entered?: string): void => {
    // `entered` comes from the auto-submit-on-complete path (the current keystroke
    // value); the button path falls back to state. Reading the arg avoids a stale
    // closure where the 6th digit hasn't landed in `code` yet.
    const value = (entered ?? code).replace(/\s/g, "");
    if (value.length !== 6 || activate.isPending) return;
    setInvalid(false);
    activate.mutate(value, {
      onSuccess: (res) => {
        setCodes(res.recoveryCodes);
        setStep(3);
      },
      onError: () => setInvalid(true),
    });
  };

  const enrollFailed = enroll.isError;
  const alreadyEnabled = enroll.error instanceof AuthError && enroll.error.status === 409;

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
        aria-label="Set up two-factor authentication"
        style={{ width: 540, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "var(--shadow-xl)" }}
      >
        {/* Header + stepper */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--r-md)",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Set up two-factor authentication</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Step {step} of 3</div>
            </div>
            <button onClick={onClose} aria-label="Close" className="k-btn-icon k-btn-plain">
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "contents" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      background: step > s.n ? "var(--success-500)" : step === s.n ? "var(--accent)" : "var(--bg-subtle)",
                      color: step >= s.n ? "#fff" : "var(--text-subtle)",
                      border: step >= s.n ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {step > s.n ? <Check size={12} strokeWidth={3} /> : s.n}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: step >= s.n ? "var(--text)" : "var(--text-subtle)" }}>
                    {s.l}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1.5, background: step > s.n ? "var(--success-500)" : "var(--border)", borderRadius: 2 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 22 }}>
          {/* STEP 1 — QR + manual key */}
          {step === 1 && (
            <div className="fade-in">
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 18 }}>
                Open your authenticator app —{" "}
                <strong style={{ color: "var(--text)" }}>Google Authenticator, 1Password, Microsoft Authenticator, or Authy</strong>{" "}
                — and scan this QR code.
              </div>

              {enrollFailed ? (
                <MfaError>
                  {alreadyEnabled
                    ? "Two-factor is already enabled on this account."
                    : "Couldn’t start setup. Close this dialog and try again."}
                </MfaError>
              ) : (
                <div style={{ display: "flex", gap: 20 }}>
                  <div style={{ padding: 12, background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", flexShrink: 0 }}>
                    {enroll.data === undefined ? (
                      <div className="skeleton" style={{ width: 160, height: 160, borderRadius: 6 }} />
                    ) : (
                      <QrImage dataUri={enroll.data.qrDataUri} size={160} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="k-overline" style={{ marginBottom: 6 }}>
                      Can&rsquo;t scan?
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 10 }}>
                      Enter this setup key manually in your app.
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 12px",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r-md)",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          letterSpacing: "0.06em",
                          wordBreak: "break-all",
                          filter: showKey ? "none" : "blur(4px)",
                          userSelect: showKey ? "text" : "none",
                          transition: "filter 120ms",
                        }}
                      >
                        {setupKey || "····"}
                      </span>
                      <button
                        onClick={() => setShowKey((s) => !s)}
                        aria-label={showKey ? "Hide setup key" : "Show setup key"}
                        className="k-btn-icon k-btn-plain"
                        style={{ height: 28, width: 28, flexShrink: 0 }}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          void navigator.clipboard?.writeText(setupKey.replace(/\s/g, "")).catch(() => {});
                          setKeyCopied(true);
                          setTimeout(() => setKeyCopied(false), 1500);
                        }}
                        aria-label="Copy setup key"
                        className="k-btn-icon k-btn-plain"
                        style={{ height: 28, width: 28, flexShrink: 0 }}
                      >
                        {keyCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <MfaNote icon="info">Time-based (TOTP), 30-second codes. Keep this key private.</MfaNote>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
                <button onClick={onClose} className="k-btn k-btn-ghost">
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={enroll.data === undefined}
                  className="k-btn k-btn-primary"
                  style={{ opacity: enroll.data === undefined ? 0.6 : 1 }}
                >
                  Next <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — confirm code */}
          {step === 2 && (
            <div className="fade-in">
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
                Enter the 6-digit code from your app to confirm it&rsquo;s set up correctly.
              </div>
              <label className="k-overline" style={{ display: "block", marginBottom: 10 }}>
                Code from authenticator
              </label>
              <CodeBoxes
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (invalid) setInvalid(false);
                }}
                disabled={activate.isPending}
                invalid={invalid}
                autoFocus
                onComplete={(v) => confirm(v)}
              />
              {invalid && <MfaError>That code isn&rsquo;t valid. Try again.</MfaError>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 22 }}>
                <button onClick={() => setStep(1)} className="k-btn k-btn-plain">
                  <ArrowLeft size={13} /> Back
                </button>
                <button
                  onClick={() => confirm()}
                  disabled={code.replace(/\s/g, "").length !== 6 || activate.isPending}
                  className="k-btn k-btn-primary"
                  style={{ minWidth: 130, justifyContent: "center", opacity: code.replace(/\s/g, "").length !== 6 || activate.isPending ? 0.6 : 1 }}
                >
                  {activate.isPending ? (
                    <>
                      <span className="k-spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%" }} />{" "}
                      Verifying…
                    </>
                  ) : (
                    "Confirm & continue"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — recovery codes */}
          {step === 3 && (
            <div className="fade-in">
              <div style={{ marginBottom: 14 }}>
                <MfaNote icon="alert" tone="warn">
                  <strong>Save these recovery codes now.</strong> They&rsquo;re shown only once. Each lets you sign in if you
                  lose your authenticator device — store them somewhere safe, like a password manager.
                </MfaNote>
              </div>
              <RecoveryCodesGrid codes={codes} />
              <RecoveryActions codes={codes} workspace={workspace} />
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 18, fontSize: 13, cursor: "pointer", lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                  style={{ accentColor: "var(--accent)", marginTop: 2, width: 15, height: 15 }}
                />
                <span>I&rsquo;ve saved my recovery codes somewhere safe.</span>
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button onClick={onDone} disabled={!saved} className="k-btn k-btn-primary" style={{ minWidth: 150, justifyContent: "center", opacity: saved ? 1 : 0.6 }}>
                  <Check size={14} /> Finish setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
