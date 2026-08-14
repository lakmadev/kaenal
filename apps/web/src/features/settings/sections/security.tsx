"use client";

import { ShieldCheck, KeyRound, Smartphone, PanelLeft, X, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSessionPolicy } from "@/hooks/use-session-policy";
import { TwoFactorPanel } from "@/features/mfa/two-factor-panel";
import { SettingsPage, SettingsCard, SettingsRow } from "../settings-bits";

/** Security & devices (settings.jsx `Security`): sign-in method, the real
 *  two-factor panel (TOTP enrol/verify/recovery, wired to /v1/auth/mfa), the
 *  read-only session policy, and active sessions. */

const SESSIONS: { icon: LucideIcon; label: string; loc: string; when: string; current?: boolean }[] = [
  { icon: PanelLeft, label: "MacBook Pro · Chrome", loc: "Pune, IN · 192.168.4.18", when: "Active now", current: true },
  { icon: Smartphone, label: "iPad Pro · Safari", loc: "Plant floor · 192.168.5.42", when: "2 hours ago" },
  { icon: Smartphone, label: "iPhone · Kaenal Inspector", loc: "Pune, IN · LTE", when: "Yesterday" },
];

export function SecuritySection(): React.ReactElement {
  const { data: policy } = useSessionPolicy();
  const maxLabel =
    policy === undefined
      ? ""
      : policy.maxConcurrentSessions === 0
        ? "unlimited concurrent sessions"
        : `up to ${policy.maxConcurrentSessions} concurrent session${policy.maxConcurrentSessions === 1 ? "" : "s"}`;

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

      <TwoFactorPanel />

      {policy !== undefined && (
        <SettingsCard title="Session policy" desc="Set by your workspace administrator (read-only)">
          <SettingsRow label="Web idle timeout" hint="Inactivity sign-out">
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <Clock size={13} /> {policy.webIdleMinutes} minutes
            </span>
          </SettingsRow>
          <SettingsRow label="Web absolute timeout" hint="Hard session lifetime (enforced)">
            <span className="text-[13px] text-muted">{policy.webAbsoluteHours} hours</span>
          </SettingsRow>
          <SettingsRow label="Mobile idle timeout">
            <span className="text-[13px] text-muted">{policy.mobileIdleHours} hours</span>
          </SettingsRow>
          <SettingsRow label="Max concurrent sessions" hint="Oldest is signed out when exceeded (enforced)">
            <span className="text-[13px] text-muted">
              {policy.maxConcurrentSessions === 0 ? "Unlimited" : policy.maxConcurrentSessions}
            </span>
          </SettingsRow>
          <SettingsRow label="Remember device">
            <span className="text-[13px] text-muted">
              {policy.rememberDeviceDays === 0 ? "Off" : `${policy.rememberDeviceDays} days`}
            </span>
          </SettingsRow>
          <SettingsRow label="Step-up re-auth window">
            <span className="text-[13px] text-muted">{policy.stepUpMinutes} minutes</span>
          </SettingsRow>
        </SettingsCard>
      )}

      <SettingsCard
        title="Active sessions"
        desc={`Devices currently signed in to your account${maxLabel === "" ? "" : ` — workspace policy allows ${maxLabel}`}`}
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
