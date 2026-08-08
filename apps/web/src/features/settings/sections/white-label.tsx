"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, KeyRound, RefreshCw, Upload } from "lucide-react";
import { BRANDING_DEFAULTS, type BrandingDto, type BrandingSettings } from "@kaenal/types";
import { ApiRequestError } from "@kaenal/api-client";
import { useCan } from "@/hooks/use-me";
import { useBranding, useUpdateBranding } from "@/hooks/use-branding";
import { Spinner, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";

/** The editable branding fields (everything on {@link BrandingDto} except the
 *  optimistic-concurrency token, which the form tracks separately). */
type BrandForm = BrandingSettings;

/** Preset accent swatches — a quick palette; the colour input covers the rest. */
const SWATCHES = ["#18181b", "#dc2626", "#ea580c", "#f59e0b", "#16a34a", "#0d9488", "#2563eb", "#7c3aed"];
const FONTS = ["Archivo", "Inter", "Source Sans 3", "System"];

function stripVersion(dto: BrandingDto): BrandForm {
  const { lockVersion: _lockVersion, ...settings } = dto;
  return settings;
}

/**
 * White-label branding editor (settings.jsx → multi-tenancy.jsx `WhiteLabelEditor`).
 * A faithful reproduction of the design's two-column editor — brand / colour /
 * login copy / email cards on the left, a live login + sidebar preview on the
 * right — wired to the real `/v1/settings/branding` endpoint (settings:manage,
 * optimistic concurrency). The display name flows to the app shell's tenant
 * label once saved. Logo/favicon uploads, the domain-verify + SPF/DKIM chips and
 * the PDF/mobile toggles are presentational for now (no upload/DNS backend yet).
 */
export function WhiteLabelSection(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("settings:manage");
  const { data: branding, isPending } = useBranding();
  const update = useUpdateBranding();

  const [form, setForm] = useState<BrandForm | null>(null);
  // Seed the editable form the first time branding resolves.
  useEffect(() => {
    if (branding !== undefined && form === null) setForm(stripVersion(branding));
  }, [branding, form]);

  if (isPending || form === null || branding === undefined) {
    return (
      <SettingsPage title="White-label branding" subtitle="Make Kaenal look like your own product">
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner /> <span className="ml-2 text-[13px]">Loading branding…</span>
        </div>
      </SettingsPage>
    );
  }

  const set = <K extends keyof BrandForm>(key: K, value: BrandForm[K]): void =>
    setForm((prev) => (prev === null ? prev : { ...prev, [key]: value }));

  const monogram = (form.shortName || form.displayName || "K").slice(0, 2).toUpperCase();
  const nameLabel = form.displayName || "your workspace";

  const reset = (): void => {
    setForm({ ...BRANDING_DEFAULTS });
    toast.toast("Reset to Kaenal defaults — Save to apply", "info");
  };

  const save = (): void => {
    update.mutate(
      { ...form, version: branding.lockVersion },
      {
        onSuccess: () => toast.success("Branding saved"),
        onError: (err) => {
          const stale = err instanceof ApiRequestError && err.status === 409;
          toast.error(
            stale ? "Branding changed in another tab — reload and try again" : "Couldn't save branding",
          );
        },
      },
    );
  };

  return (
    <SettingsPage
      title="White-label branding"
      subtitle="Make Kaenal look like your own product"
      actions={
        <>
          <button className="k-btn k-btn-ghost" onClick={reset} disabled={update.isPending}>
            <RefreshCw size={13} /> Reset to default
          </button>
          <button
            className="k-btn k-btn-primary"
            onClick={save}
            disabled={!canManage || update.isPending}
            title={canManage ? undefined : "Requires an admin or manager"}
          >
            <Check size={14} /> {update.isPending ? "Saving…" : "Save branding"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:[grid-template-columns:390px_1fr]">
        {/* ---- Editor column ---- */}
        <div>
          <SettingsCard title="Brand">
            <SettingsRow label="Display name" hint="Shown in the app shell and on the login screen">
              <input
                className="k-input"
                value={form.displayName}
                placeholder="e.g. Precision Auto"
                onChange={(e) => set("displayName", e.target.value)}
              />
            </SettingsRow>
            <SettingsRow label="Short / initials">
              <input
                className="k-input"
                style={{ width: 90 }}
                maxLength={6}
                value={form.shortName}
                placeholder="PA"
                onChange={(e) => set("shortName", e.target.value)}
              />
            </SettingsRow>
            <SettingsRow label="Custom domain" hint="CNAME your domain → kaenal.app">
              <div className="flex items-center gap-2">
                <input
                  className="k-input flex-1"
                  value={form.domain}
                  placeholder="quality.example.com"
                  onChange={(e) => set("domain", e.target.value)}
                />
                <span
                  className="k-chip whitespace-nowrap"
                  style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}
                >
                  <Check size={10} strokeWidth={3} /> Verified
                </span>
              </div>
            </SettingsRow>
            <SettingsRow label="Logo (full)" align="start">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center font-extrabold text-white"
                  style={{ width: 56, height: 56, borderRadius: 8, background: form.primaryColor, fontSize: 18 }}
                >
                  {monogram}
                </div>
                <button className="k-btn k-btn-ghost" title="Logo upload isn't wired yet">
                  <Upload size={12} /> Upload SVG
                </button>
              </div>
            </SettingsRow>
            <SettingsRow label="Favicon">
              <button className="k-btn k-btn-ghost" title="Favicon upload isn't wired yet">
                <Upload size={12} /> Upload 32×32
              </button>
            </SettingsRow>
          </SettingsCard>

          <SettingsCard title="Colour">
            <SettingsRow label="Primary" align="start">
              <div className="flex flex-wrap items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => set("primaryColor", c)}
                    aria-label={`Set primary colour ${c}`}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: c,
                      cursor: "pointer",
                      border: form.primaryColor.toLowerCase() === c ? "2px solid var(--text)" : "2px solid transparent",
                      outline: "1px solid var(--border)",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  style={{ width: 30, height: 26, padding: 0, border: "none", cursor: "pointer", background: "none" }}
                />
              </div>
            </SettingsRow>
            <SettingsRow label="Login background">
              <input
                type="color"
                value={form.bgColor}
                onChange={(e) => set("bgColor", e.target.value)}
                style={{ width: 40, height: 30, padding: 0, border: "none", cursor: "pointer", background: "none" }}
              />
            </SettingsRow>
            <SettingsRow label="Font">
              <select className="k-input" value={form.font} onChange={(e) => set("font", e.target.value)}>
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </SettingsRow>
          </SettingsCard>

          <SettingsCard title="Login screen copy">
            <SettingsRow label="Tagline" align="start">
              <textarea
                className="k-input"
                rows={3}
                style={{ height: "auto" }}
                value={form.loginTagline}
                placeholder="Welcome back. Sign in with your corporate account."
                onChange={(e) => set("loginTagline", e.target.value)}
              />
            </SettingsRow>
            <SettingsRow label="Support email">
              <input
                className="k-input"
                value={form.supportEmail}
                placeholder="support@example.com"
                onChange={(e) => set("supportEmail", e.target.value)}
              />
            </SettingsRow>
            <SettingsRow label="Footer text">
              <input
                className="k-input"
                value={form.footer}
                placeholder="© Your Company 2026. Powered by Kaenal."
                onChange={(e) => set("footer", e.target.value)}
              />
            </SettingsRow>
          </SettingsCard>

          <SettingsCard title="Email & exports">
            <SettingsRow label="Sender 'From' name">
              <input
                className="k-input"
                value={form.fromName}
                placeholder="Your Quality Team"
                onChange={(e) => set("fromName", e.target.value)}
              />
            </SettingsRow>
            <SettingsRow label="Sender 'From' email" hint="Must be SPF/DKIM verified for the domain">
              <div className="flex items-center gap-2">
                <input
                  className="k-input flex-1"
                  value={form.fromEmail}
                  placeholder="noreply@example.com"
                  onChange={(e) => set("fromEmail", e.target.value)}
                />
                <span
                  className="k-chip whitespace-nowrap"
                  style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}
                >
                  SPF/DKIM ✓
                </span>
              </div>
            </SettingsRow>
            <SettingsRow label="PDF header logo">
              <Toggle on />
            </SettingsRow>
            <SettingsRow label="Mobile inspector splash">
              <Toggle on />
            </SettingsRow>
          </SettingsCard>
        </div>

        {/* ---- Live preview column ---- */}
        <div>
          <div className="k-overline mb-2">Live preview — login</div>
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg, 12px)", background: form.bgColor, height: 440 }}
          >
            <div style={{ background: "white", padding: 36, borderRadius: 12, width: 340, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
              <div className="mb-4 flex justify-center">
                <div
                  className="flex items-center justify-center font-extrabold text-white"
                  style={{ width: 56, height: 56, borderRadius: 12, background: form.primaryColor, fontSize: 22 }}
                >
                  {monogram}
                </div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, textAlign: "center", marginBottom: 4, color: "#0f172a" }}>
                Sign in to {form.displayName || "Kaenal"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
                {form.loginTagline || "Welcome back. Sign in to your workspace."}
              </div>
              <button
                className="flex w-full items-center justify-center gap-1.5"
                style={{ padding: "10px 14px", background: form.primaryColor, color: "white", borderRadius: 6, fontWeight: 600, fontSize: 13 }}
              >
                <KeyRound size={13} /> Continue with corporate SSO
              </button>
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 24 }}>{form.domain || "kaenal.app"}</div>
            </div>
            <div style={{ position: "absolute", bottom: 14, left: 14, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{form.footer}</div>
          </div>

          <div className="k-overline mb-2 mt-4">Live preview — sidebar</div>
          <div
            className="overflow-hidden"
            style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg, 12px)", display: "grid", gridTemplateColumns: "220px 1fr" }}
          >
            <div style={{ background: "#070d1a", color: "#cbd5e1", padding: 14 }}>
              <div className="mb-5 flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center font-extrabold text-white"
                  style={{ width: 32, height: 32, borderRadius: 6, background: form.primaryColor, fontSize: 13 }}
                >
                  {monogram}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{form.displayName || "Kaenal"}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{form.font}</div>
                </div>
              </div>
              {["Dashboard", "Inspections", "Non-Conformities", "Audits"].map((it, i) => (
                <div
                  key={it}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 4,
                    marginBottom: 2,
                    fontSize: 13,
                    background: i === 0 ? `${form.primaryColor}24` : "transparent",
                    color: i === 0 ? "white" : "#94a3b8",
                    borderLeft: i === 0 ? `3px solid ${form.primaryColor}` : "3px solid transparent",
                  }}
                >
                  {it}
                </div>
              ))}
            </div>
            <div style={{ padding: 18, background: "#f8fafc" }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Welcome back</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Here&apos;s your plant overview</div>
              <button style={{ background: form.primaryColor, color: "white", padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                Primary action
              </button>
              <button
                style={{ background: "white", color: "#0f172a", padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, marginLeft: 8, border: "1px solid #e2e8f0" }}
              >
                Secondary
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button className="k-btn k-btn-ghost" onClick={reset} disabled={update.isPending}>
              <RefreshCw size={12} /> Reset to default
            </button>
            <button className="k-btn k-btn-secondary" onClick={() => toast.toast(`Previewing as end-user — ${nameLabel}`, "info")}>
              <ExternalLink size={12} /> Preview as user
            </button>
            <button
              className="k-btn k-btn-primary ml-auto"
              onClick={save}
              disabled={!canManage || update.isPending}
            >
              <Check size={12} /> {update.isPending ? "Saving…" : "Save branding"}
            </button>
          </div>
        </div>
      </div>
    </SettingsPage>
  );
}
