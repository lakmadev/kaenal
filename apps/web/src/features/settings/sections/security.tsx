"use client";

import { ShieldCheck, KeyRound, Smartphone, Phone, Mail, PanelLeft, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";

/** Security & devices (settings.jsx `Security`): sign-in method, MFA methods, and
 *  active sessions. Rendered as the design shows it; live session/MFA management
 *  lands with the account API (07 §7). */

const MFA_METHODS: { icon: LucideIcon; label: string; sub: string; on: boolean; primary?: boolean }[] = [
  { icon: Smartphone, label: "Authenticator app", sub: "TOTP · added 4 months ago", on: true, primary: true },
  { icon: KeyRound, label: "Security key", sub: "FIDO2 / WebAuthn · last used yesterday", on: true },
  { icon: Phone, label: "SMS backup", sub: "Backup only — not recommended as primary", on: false },
  { icon: Mail, label: "Email codes", sub: "Sent to your verified work email", on: false },
];

const SESSIONS: { icon: LucideIcon; label: string; loc: string; when: string; current?: boolean }[] = [
  { icon: PanelLeft, label: "MacBook Pro · Chrome", loc: "Pune, IN · 192.168.4.18", when: "Active now", current: true },
  { icon: Smartphone, label: "iPad Pro · Safari", loc: "Plant floor · 192.168.5.42", when: "2 hours ago" },
  { icon: Smartphone, label: "iPhone · Kaenal Inspector", loc: "Pune, IN · LTE", when: "Yesterday" },
];

export function SecuritySection(): React.ReactElement {
  return (
    <SettingsPage title="Security & devices" subtitle="Multi-factor auth, sessions, and security keys">
      <SettingsCard title="Sign-in method">
        <SettingsRow label="Primary method" hint="Single sign-on through your identity provider, where enforced by workspace policy" align="start">
          <div className="flex items-center gap-2.5 rounded-md p-2.5" style={{ background: "var(--success-50, rgba(22,163,74,0.08))" }}>
            <ShieldCheck size={20} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Email &amp; password</div>
              <div className="text-[11px] text-muted">Last sign-in a few hours ago</div>
            </div>
            <span className="k-chip" style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}>
              Active
            </span>
          </div>
        </SettingsRow>
        <SettingsRow label="Password" hint="Change the password used to sign in">
          <button className="k-btn k-btn-ghost">
            <KeyRound size={13} /> Change password
          </button>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Multi-factor authentication" desc="Required by workspace policy. Add at least 2 methods for resilience.">
        <div className="flex flex-col gap-2">
          {MFA_METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-center rounded-md" style={{ width: 36, height: 36, background: "var(--bg-subtle)" }}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {m.label}
                    {m.primary === true && (
                      <span className="k-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">{m.sub}</div>
                </div>
                <Toggle on={m.on} />
              </div>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Active sessions"
        desc="Devices currently signed in to your account"
        footer={
          <button className="k-btn k-btn-ghost" style={{ color: "var(--danger-600)" }}>
            <X size={13} /> Sign out all other sessions
          </button>
        }
      >
        <div className="flex flex-col">
          {SESSIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`flex items-center gap-3 py-3 ${i < SESSIONS.length - 1 ? "border-b border-border" : ""}`}>
                <Icon size={18} />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {s.label}
                    {s.current === true && (
                      <span className="k-chip" style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}>
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">
                    {s.loc} · {s.when}
                  </div>
                </div>
                {s.current !== true && <button className="k-btn k-btn-sm k-btn-ghost">Sign out</button>}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
