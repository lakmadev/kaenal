"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { SessionPolicy, SessionPolicyDto } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import { useSessionPolicy, useUpdateSessionPolicy } from "@/hooks/use-session-policy";
import { Segmented, Spinner, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";

type Form = SessionPolicy;

function strip(dto: SessionPolicyDto): Form {
  const { lockVersion: _v, ...policy } = dto;
  return policy;
}

/** A number of minutes displayed as minutes-or-hours; stores canonical minutes. */
function DurationMinutes({
  minutes,
  units,
  onChange,
  disabled,
}: {
  minutes: number;
  units: "min-hour" | "hour-day";
  onChange: (minutes: number) => void;
  disabled?: boolean;
}): React.ReactElement {
  // min-hour: base minute; hour-day: base hour (minutes = hours*60).
  const base = units === "min-hour" ? 1 : 60; // minutes per small unit
  const bigFactor = units === "min-hour" ? 60 : 24; // small units per big unit
  const [unit, setUnit] = useState<"small" | "big">("small");
  const smallVal = Math.round(minutes / base);
  const shown = unit === "big" ? Math.round(smallVal / bigFactor) : smallVal;
  const labels = units === "min-hour" ? ["minutes", "hours"] : ["hours", "days"];

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        className="k-input"
        style={{ width: 80 }}
        value={shown}
        min={1}
        disabled={disabled}
        onChange={(e) => {
          const v = Math.max(1, Number(e.target.value) || 1);
          const small = unit === "big" ? v * bigFactor : v;
          onChange(small * base);
        }}
      />
      <select
        className="k-input"
        style={{ width: 110 }}
        value={unit}
        disabled={disabled}
        onChange={(e) => setUnit(e.target.value as "small" | "big")}
      >
        <option value="small">{labels[0]}</option>
        <option value="big">{labels[1]}</option>
      </select>
    </div>
  );
}

/**
 * Session policies (settings.jsx → identity-advanced.jsx `SessionPolicies`).
 * Faithful to the design's five cards. The ENFORCED fields — absolute timeout
 * (session lifetime) and max concurrent (revoke oldest) — are applied at sign-in
 * by the API; idle timeouts / remember-device / step-up window are stored policy
 * the app reads back (runtime enforcement is a later slice). The design's
 * decorative safety toggles (biometric, impossible-travel, off-hours…) are
 * UI-only and not persisted; each is labelled so nothing implies a live control
 * it isn't.
 */
export function SessionPoliciesSection(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("settings:manage");
  const { data, isPending } = useSessionPolicy();
  const update = useUpdateSessionPolicy();
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (data !== undefined && form === null) setForm(strip(data));
  }, [data, form]);

  if (isPending || form === null || data === undefined) {
    return (
      <SettingsPage title="Session policies" subtitle="Control session lifetime, concurrency, and re-authentication">
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
        </div>
      </SettingsPage>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]): void => setForm((s) => (s === null ? s : { ...s, [k]: v }));

  const save = (): void => {
    update.mutate(
      { ...form, version: data.lockVersion },
      {
        onSuccess: () => toast.success("Session policy saved"),
        onError: () => toast.error("Couldn't save the session policy"),
      },
    );
  };

  return (
    <SettingsPage
      title="Session policies"
      subtitle="Control session lifetime, concurrency, and re-authentication"
      actions={
        <button className="k-btn k-btn-primary" onClick={save} disabled={!canManage || update.isPending}>
          <Check size={14} /> {update.isPending ? "Saving…" : "Save"}
        </button>
      }
    >
      <SettingsCard title="Web session lifetime">
        <SettingsRow label="Idle timeout" hint="Sign the user out after this period of inactivity (stored)">
          <DurationMinutes minutes={form.webIdleMinutes} units="min-hour" onChange={(m) => set("webIdleMinutes", m)} disabled={!canManage} />
        </SettingsRow>
        <SettingsRow label="Absolute timeout" hint="Hard maximum regardless of activity — enforced at sign-in">
          <DurationMinutes
            minutes={form.webAbsoluteHours * 60}
            units="hour-day"
            onChange={(m) => set("webAbsoluteHours", Math.max(1, Math.round(m / 60)))}
            disabled={!canManage}
          />
        </SettingsRow>
        <SettingsRow label="Remember device duration" hint="When 'Trust this device' is checked (stored)">
          <Segmented
            value={String(form.rememberDeviceDays)}
            onChange={(v) => set("rememberDeviceDays", Number(v))}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "0", label: "Off" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Mobile session lifetime">
        <SettingsRow label="Idle timeout" hint="Mobile inspector app — when the phone is locked or app backgrounded (stored)">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="k-input"
              style={{ width: 80 }}
              min={1}
              value={form.mobileIdleHours}
              disabled={!canManage}
              onChange={(e) => set("mobileIdleHours", Math.max(1, Number(e.target.value) || 1))}
            />
            <span className="text-[12px] text-muted">hours</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Require biometric on resume" hint="Face ID / Touch ID when reopening the app (UI only — not yet enforced)">
          <Toggle on />
        </SettingsRow>
        <SettingsRow label="Wipe local data on logout" hint="Offline queue + cached photos (UI only — not yet enforced)">
          <Toggle on />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Concurrent sessions">
        <SettingsRow label="Max sessions per user" hint="Sign out the oldest when exceeded — enforced at sign-in">
          <Segmented
            value={String(form.maxConcurrentSessions)}
            onChange={(v) => set("maxConcurrentSessions", Number(v))}
            options={[
              { value: "1", label: "1 (single sign-on)" },
              { value: "3", label: "3" },
              { value: "5", label: "5" },
              { value: "0", label: "Unlimited" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Notify user when a new device signs in" hint="Email + push (stored)">
          <Toggle on={form.notifyNewDevice} {...(canManage ? { onChange: (v: boolean) => set("notifyNewDevice", v) } : {})} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Step-up authentication" desc="Require fresh authentication for sensitive operations (window stored; per-operation enforcement is a later slice)">
        <SettingsRow label="Trigger threshold">
          <Segmented
            value={String(form.stepUpMinutes)}
            onChange={(v) => set("stepUpMinutes", Number(v))}
            options={[
              { value: "5", label: "5 min" },
              { value: "15", label: "15 min" },
              { value: "60", label: "1 hour" },
              { value: "240", label: "4 hours" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Step-up required for" align="start">
          <div className="flex flex-col gap-1.5">
            {[
              "Approving documents",
              "Closing critical NCRs",
              "Disposition: scrap or use-as-is",
              "Deleting any record",
              "Changing permissions",
              "Rotating API tokens",
              "Configuring integrations",
              "Viewing PII / personal data",
            ].map((o) => (
              <label key={o} className="flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  defaultChecked={!["Deleting any record", "Viewing PII / personal data"].includes(o)}
                  style={{ accentColor: "var(--accent)" }}
                />
                {o}
              </label>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Workforce safety" desc="UI only — these detections are not yet wired to a backend">
        <SettingsRow label="Off-hours sign-in alerts" hint="Alert admins on logins outside 6am–10pm local">
          <Toggle on />
        </SettingsRow>
        <SettingsRow label="Impossible-travel detection" hint="Sign-ins from far-apart locations within minutes">
          <Toggle on />
        </SettingsRow>
        <SettingsRow label="Suspicious-pattern lockout" hint="Auto-lock after a suspicious behaviour pattern">
          <Toggle on />
        </SettingsRow>
        <SettingsRow label="Allow personal device sign-in" hint="When off, only managed devices can sign in">
          <Toggle on />
        </SettingsRow>
      </SettingsCard>
    </SettingsPage>
  );
}
