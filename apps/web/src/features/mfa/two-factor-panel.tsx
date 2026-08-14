"use client";

import { useState } from "react";
import { Check, KeyRound, RefreshCw, Shield, ShieldCheck, Smartphone, X } from "lucide-react";
import { getActiveTenant } from "@/lib/tenant";
import { useMfaStatus } from "@/hooks/use-mfa";
import { SettingsCard } from "../settings/settings-bits";
import { MfaNote, RecoveryCodesGrid, RecoveryActions } from "./mfa-bits";
import { MfaEnrollModal } from "./mfa-enroll-modal";
import { MfaConfirmModal } from "./mfa-confirm-modal";

/**
 * Settings › Security › Two-factor (binding design `TwoFactorPanel`). Embedded in
 * the Security section, so it renders the design's cards directly rather than its
 * own SettingsPage. Fully wired to `/v1/auth/mfa`: not-enrolled → enrol → active,
 * with recovery-code regeneration and turn-off. The regenerate path shows the
 * fresh codes once (the design faked this with a toast; real codes must be shown).
 */

const LOW_CODES = 3;

/** "4 months ago" / "today" style — from the real enrolledAt timestamp. */
function relativeSince(iso: string | null): string {
  if (iso === null) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function TwoFactorPanel(): React.ReactElement {
  const workspace = getActiveTenant() ?? "your-workspace";
  const { data: status, isLoading } = useMfaStatus();
  const [modal, setModal] = useState<"enroll" | "regenerate" | "disable" | null>(null);
  const [flash, setFlash] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  if (isLoading || status === undefined) {
    return (
      <SettingsCard>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: i === 0 ? 44 : 16, marginBottom: 14, width: i === 1 ? "70%" : "100%" }} />
        ))}
        <div className="skeleton" style={{ height: 36, width: 200, marginTop: 8 }} />
      </SettingsCard>
    );
  }

  const remaining = status.recoveryCodesRemaining;
  const lowCodes = remaining <= LOW_CODES;

  return (
    <>
      {flash && (
        <div
          className="fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "var(--success-50)",
            border: "1px solid var(--success-100)",
            borderRadius: "var(--r-md)",
            marginBottom: 16,
            color: "var(--success-700)",
          }}
        >
          <Check size={16} strokeWidth={2.5} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Two-factor authentication is on. Your account is now protected.</span>
          <button onClick={() => setFlash(false)} aria-label="Dismiss" className="k-btn-icon k-btn-plain" style={{ marginLeft: "auto", color: "var(--success-700)" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {!status.enrolled ? (
        <SettingsCard>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "var(--r-md)",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Shield size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Protect your account with 2FA</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: 16 }}>
                Two-factor authentication asks for a short code from an app on your phone whenever you sign in. Even if
                someone learns your password, they can&rsquo;t get into your account — or the quality records tied to it —
                without your device.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                {[
                  { Icon: Smartphone, l: "Use any authenticator app", s: "Google, 1Password, Authy" },
                  { Icon: KeyRound, l: "10 backup codes", s: "For lost-device recovery" },
                  { Icon: ShieldCheck, l: "Logged for audit", s: "IATF 16949 §7.5.3" },
                ].map((x) => (
                  <div key={x.l} style={{ padding: 12, background: "var(--bg-subtle)", borderRadius: "var(--r-md)" }}>
                    <div style={{ color: "var(--accent)", marginBottom: 8 }}>
                      <x.Icon size={17} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>{x.l}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{x.s}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setModal("enroll")} className="k-btn k-btn-primary" style={{ height: 40 }}>
                <ShieldCheck size={15} /> Enable two-factor authentication
              </button>
            </div>
          </div>
        </SettingsCard>
      ) : (
        <>
          <SettingsCard>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--r-md)",
                  background: "var(--success-50)",
                  color: "var(--success-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  Two-factor authentication is on
                  <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success-500)" }} />
                    Active
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <Smartphone size={12} /> Authenticator app{status.enrolledAt !== null ? ` · Added ${relativeSince(status.enrolledAt)}` : ""}
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Recovery codes"
            desc="One-time codes for signing in when you don't have your authenticator device"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: lowCodes ? "var(--warning-600)" : "var(--text)" }}>{remaining}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>of 10 remaining</span>
              </div>
              <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                <div style={{ width: `${remaining * 10}%`, height: "100%", background: lowCodes ? "var(--warning-500)" : "var(--success-500)", transition: "width 240ms" }} />
              </div>
              <button onClick={() => setModal("regenerate")} className="k-btn k-btn-ghost">
                <RefreshCw size={13} /> Regenerate
              </button>
            </div>
            {lowCodes && (
              <div style={{ marginTop: 14 }}>
                <MfaNote icon="alert" tone="warn">
                  <strong>Running low on recovery codes.</strong> You have {remaining} left. Regenerate a fresh set of 10 so
                  you don&rsquo;t get locked out if you lose your device.
                </MfaNote>
              </div>
            )}
          </SettingsCard>

          <SettingsCard title="Turn off two-factor" desc="Not recommended — your workspace may require two-factor to sign in">
            <button onClick={() => setModal("disable")} className="k-btn k-btn-ghost" style={{ color: "var(--danger-600)", borderColor: "var(--danger-100)" }}>
              <Shield size={13} /> Turn off two-factor authentication
            </button>
          </SettingsCard>
        </>
      )}

      {modal === "enroll" && (
        <MfaEnrollModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            setFlash(true);
          }}
        />
      )}
      {modal === "regenerate" && (
        <MfaConfirmModal
          variant="regenerate"
          onClose={() => setModal(null)}
          onConfirm={(res) => {
            setModal(null);
            if (res.recoveryCodes !== undefined) setNewCodes(res.recoveryCodes);
          }}
        />
      )}
      {modal === "disable" && (
        <MfaConfirmModal
          variant="disable"
          onClose={() => setModal(null)}
          onConfirm={() => {
            setModal(null);
            setFlash(false);
          }}
        />
      )}

      {newCodes !== null && (
        <div
          onClick={() => setNewCodes(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}
        >
          <div onClick={(e) => e.stopPropagation()} className="k-surface fade-in" role="dialog" aria-modal="true" aria-label="New recovery codes" style={{ width: 480, maxWidth: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ display: "inline-flex", padding: 10, borderRadius: "var(--r-md)", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <RefreshCw size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>New recovery codes</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Your previous codes no longer work.</div>
                </div>
                <button onClick={() => setNewCodes(null)} aria-label="Close" className="k-btn-icon k-btn-plain">
                  <X size={16} />
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <MfaNote icon="alert" tone="warn">
                  <strong>Save these now.</strong> They&rsquo;re shown only once — store them somewhere safe, like a password manager.
                </MfaNote>
              </div>
              <RecoveryCodesGrid codes={newCodes} />
              <RecoveryActions codes={newCodes} workspace={workspace} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => setNewCodes(null)} className="k-btn k-btn-primary">
                  <Check size={14} /> Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
