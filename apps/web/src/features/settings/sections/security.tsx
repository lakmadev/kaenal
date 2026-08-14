"use client";

import { ShieldCheck, KeyRound, Smartphone, Monitor, X, Clock } from "lucide-react";
import { useSessionPolicy } from "@/hooks/use-session-policy";
import { useSessions, useRevokeSession, useRevokeOtherSessions } from "@/hooks/use-sessions";
import type { SessionSummary } from "@/lib/auth";
import { TwoFactorPanel } from "@/features/mfa/two-factor-panel";
import { SettingsPage, SettingsCard, SettingsRow } from "../settings-bits";

/** Security & devices (settings.jsx `Security`): sign-in method, the real
 *  two-factor panel (TOTP enrol/verify/recovery, wired to /v1/auth/mfa), the
 *  read-only session policy, and live active sessions (list + sign-out, wired to
 *  /v1/auth/sessions). */

/** Best-effort friendly name from a User-Agent string (presentation only). */
function deviceLabel(ua: string | null): string {
  if (ua === null || ua === "") return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua) && !/Chromium/.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua) && !/Chrome/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return os === null ? browser : `${browser} on ${os}`;
}

function isMobileUa(ua: string | null): boolean {
  return ua !== null && /Mobile|iPhone|iPad|Android/.test(ua);
}

/** Strip the inet netmask (`::1/128` → `::1`) and label loopback nicely. */
function formatIp(ip: string | null): string | null {
  if (ip === null || ip === "") return null;
  const bare = ip.replace(/\/\d+$/, "");
  return bare === "::1" || bare === "127.0.0.1" ? "localhost" : bare;
}

/** "Active now" / "2 hours ago" / "3 days ago" from an ISO timestamp. */
function relativeTime(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 90) return "Active now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

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

      <ActiveSessionsCard maxLabel={maxLabel} />
    </SettingsPage>
  );
}

/** Live active-session list with per-device and all-other-devices sign-out. */
function ActiveSessionsCard({ maxLabel }: { maxLabel: string }): React.ReactElement {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const sessions = data?.sessions ?? [];
  const others = sessions.filter((s) => !s.current);

  return (
    <SettingsCard
      title="Active sessions"
      desc={`Devices currently signed in to this workspace${maxLabel === "" ? "" : ` — workspace policy allows ${maxLabel}`}`}
      footer={
        <button
          className="k-btn k-btn-ghost"
          style={{ color: "var(--danger-600)" }}
          disabled={others.length === 0 || revokeOthers.isPending}
          onClick={() => revokeOthers.mutate()}
        >
          <X size={13} /> {revokeOthers.isPending ? "Signing out…" : "Sign out all other sessions"}
        </button>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-2 text-[13px] text-muted">No other active sessions.</div>
      ) : (
        <div className="flex flex-col">
          {sessions.map((s, i) => (
            <SessionRow
              key={s.id}
              session={s}
              divider={i < sessions.length - 1}
              onRevoke={() => revoke.mutate(s.id)}
              revoking={revoke.isPending && revoke.variables === s.id}
            />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

function SessionRow({
  session,
  divider,
  onRevoke,
  revoking,
}: {
  session: SessionSummary;
  divider: boolean;
  onRevoke: () => void;
  revoking: boolean;
}): React.ReactElement {
  const Icon = isMobileUa(session.userAgent) ? Smartphone : Monitor;
  const ip = formatIp(session.ip);
  const meta = [ip, relativeTime(session.signedInAt)].filter((x) => x !== null && x !== "").join(" · ");
  return (
    <div className={`flex items-center gap-3 py-3 ${divider ? "border-b border-border" : ""}`}>
      <Icon size={18} />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          {deviceLabel(session.userAgent)}
          {session.current && (
            <span className="k-chip" style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}>
              This device
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted">{meta}</div>
      </div>
      {!session.current && (
        <button className="k-btn k-btn-sm k-btn-ghost" disabled={revoking} onClick={onRevoke}>
          {revoking ? "Signing out…" : "Sign out"}
        </button>
      )}
    </div>
  );
}
