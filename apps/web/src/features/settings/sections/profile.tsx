"use client";

import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { titleCase } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { Avatar } from "@/components/avatar";
import { Segmented, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard, SettingsRow } from "../settings-bits";

/**
 * Profile (settings.jsx `Profile`). The name/job-title read from the real
 * identity (member directory + role); the remaining fields are editable but
 * not yet persisted (there's no account-update endpoint) — Save surfaces that
 * honestly rather than implying a write.
 */
export function ProfileSection(): React.ReactElement {
  const toast = useToast();
  const { data: me } = useMe();
  const { memberOf } = useMemberLookup();
  const member = memberOf(me?.userId);
  const [tone, setTone] = useState("professional");
  const [dateFmt, setDateFmt] = useState("dmy");

  const fullName = member?.name ?? "";
  const role = me !== undefined ? titleCase(me.role) : "";

  return (
    <SettingsPage
      title="Profile"
      subtitle="How you appear across the workspace"
      actions={
        <button className="k-btn k-btn-primary" onClick={() => toast.toast("Preview only — profile editing isn't wired to the backend yet", "info")}>
          <Check size={14} /> Save changes
        </button>
      }
    >
      <SettingsCard title="Public profile" desc="Visible to other members of your workspace">
        <SettingsRow label="Photo" hint="JPG, PNG, GIF up to 5MB. Square images recommended." align="start">
          <div className="flex items-center gap-3.5">
            <Avatar name={fullName} size={64} />
            <button className="k-btn k-btn-ghost">
              <Camera size={13} /> Change
            </button>
            <button className="k-btn k-btn-plain" style={{ color: "var(--danger-600)" }}>
              Remove
            </button>
          </div>
        </SettingsRow>
        <SettingsRow label="Full name">
          <input className="k-input" defaultValue={fullName} />
        </SettingsRow>
        <SettingsRow label="Display name" hint="Shown in comments and notifications">
          <input className="k-input" defaultValue={fullName.split(" ")[0] ?? ""} />
        </SettingsRow>
        <SettingsRow label="Job title">
          <input className="k-input" defaultValue={role} />
        </SettingsRow>
        <SettingsRow label="Department">
          <input className="k-input" placeholder="e.g. Quality Assurance" />
        </SettingsRow>
        <SettingsRow label="Bio" hint="A short description shown on your profile" align="start">
          <textarea className="k-input" rows={3} style={{ height: "auto" }} placeholder="A short professional bio…" />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Contact" desc="Used for sign-in and notifications">
        <SettingsRow label="Work email">
          <div className="flex items-center gap-2">
            <input className="k-input flex-1" placeholder="you@company.com" />
            <span className="k-chip" style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}>
              <Check size={11} strokeWidth={2.5} /> Verified
            </span>
          </div>
        </SettingsRow>
        <SettingsRow label="Phone" hint="For SMS alerts on critical NCRs">
          <input className="k-input" placeholder="+00 00000 00000" />
        </SettingsRow>
        <SettingsRow label="Time zone">
          <select className="k-input">
            <option>(GMT+5:30) Asia/Kolkata</option>
            <option>(GMT+0) UTC</option>
            <option>(GMT-5) America/New_York</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Date format">
          <Segmented
            value={dateFmt}
            onChange={setDateFmt}
            options={[
              { value: "dmy", label: "DD/MM/YYYY" },
              { value: "mdy", label: "MM/DD/YYYY" },
              { value: "iso", label: "YYYY-MM-DD" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="AI assistant tone" desc="How the in-app AI writes messages and summaries on your behalf">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: "professional", label: "Professional", sample: '"Confirming the rework batch passed CMM verification at 14:22."' },
            { id: "concise", label: "Concise", sample: '"Rework batch — CMM passed @ 14:22."' },
            { id: "friendly", label: "Friendly", sample: '"Good news — the rework batch cleared CMM, all green!"' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className="rounded-md p-3.5 text-left"
              style={{
                border: tone === t.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: tone === t.id ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <div className="mb-1.5 text-[13px] font-semibold">{t.label}</div>
              <div className="text-[11px] italic leading-relaxed text-muted">{t.sample}</div>
            </button>
          ))}
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
