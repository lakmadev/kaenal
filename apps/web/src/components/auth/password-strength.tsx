"use client";

import { Check, Circle } from "lucide-react";
import { MIN_PASSWORD_LENGTH, checkPasswordPolicy } from "@kaenal/core";

/**
 * Password strength meter + requirements checklist (matches `auth.jsx`'s reset
 * screen). Validation uses the SAME `checkPasswordPolicy` the API enforces
 * (`@kaenal/core`, 07 §2) plus the server's `MIN_PASSWORD_LENGTH`, so the client
 * never lets through a password the server will reject — the requirements shown
 * are the real ones, not decorative.
 */
const BARS = [1, 2, 3, 4] as const;
const LABELS = ["Too weak", "Weak", "Okay", "Strong", "Excellent"];
const COLORS = ["#dc2626", "#ea580c", "#f59e0b", "#16a34a", "#15803d"];

/** A 0–4 visual score (looser than the pass/fail policy — just UX feedback). */
function score(pw: string): number {
  if (pw === "") return 0;
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= MIN_PASSWORD_LENGTH) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/[0-9]/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(s, 4);
}

export interface PasswordChecks {
  checks: { label: string; ok: boolean }[];
  allOk: boolean;
}

/**
 * The pass/fail requirements. Only the server's REAL rules are shown (min length,
 * matches confirmation) — the prototype's upper/lower/number/symbol rules are not
 * enforced by the API, so surfacing them would mislead. `allOk` runs the full
 * `checkPasswordPolicy` (which also rejects an email-containing password when the
 * email is known), so it stays exactly as strict as the server.
 */
export function passwordChecks(pw: string, confirm: string, email?: string): PasswordChecks {
  const checks = [
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: pw.length >= MIN_PASSWORD_LENGTH },
    { label: "Matches confirmation", ok: pw !== "" && pw === confirm },
  ];
  const allOk = pw !== "" && checkPasswordPolicy(pw, email).ok && pw === confirm;
  return { checks, allOk };
}

export function PasswordStrength({ password }: { password: string }): React.ReactElement {
  const s = score(password);
  return (
    <div className="mt-2">
      <div className="mb-1.5 flex gap-1">
        {BARS.map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-sm transition-colors"
            style={{ background: i <= s ? COLORS[s] : "var(--border)" }}
          />
        ))}
      </div>
      <div className="text-[11.5px] font-semibold" style={{ color: password !== "" ? COLORS[s] : "var(--text-muted)" }}>
        {password !== "" ? LABELS[s] : "Enter a password"}
      </div>
    </div>
  );
}

export function PasswordRequirements({ checks }: { checks: PasswordChecks["checks"] }): React.ReactElement {
  return (
    <div className="k-surface mt-4 p-3" style={{ background: "var(--bg-subtle)" }}>
      <div className="k-overline mb-1.5 !text-[11px]">Requirements</div>
      {checks.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-2 py-0.5 text-[12.5px]"
          style={{ color: c.ok ? "var(--success-600)" : "var(--text-muted)" }}
        >
          {c.ok ? <Check size={13} strokeWidth={2.5} /> : <Circle size={13} strokeWidth={1.5} />}
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}
