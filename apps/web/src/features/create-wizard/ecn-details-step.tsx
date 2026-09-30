"use client";

import { useTranslations } from "next-intl";
import { Info, TriangleAlert } from "lucide-react";
import type { WizardDraft } from "@kaenal/core";
import type { EcnChangeRisk } from "@kaenal/types";
import { OwnerPicker } from "./owner-picker";
import type { FieldErrors } from "./use-wizard-draft";

const CHANGE_TYPE_OPTIONS: readonly { id: WizardDraft["ecnChangeType"] & string; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "process", label: "Process" },
  { id: "tooling", label: "Tooling" },
  { id: "material", label: "Material" },
];

const CHANGE_RISK_OPTIONS: readonly { id: EcnChangeRisk; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function FieldError({ message }: { message?: string | undefined }): React.ReactElement | null {
  if (message === undefined) return null;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--danger-fg)" }}>
      <TriangleAlert size={13} aria-hidden />
      {message}
    </div>
  );
}

/** ECN's `changeRisk` picker (DESIGN-06 §4.7): a 3-option segmented control,
 *  a real `role="radiogroup"`, not a bare `<select>` — mirrors the visual
 *  weight of `RiskDetailsStep`'s own `ScalePicker` for a small enum choice. */
function ChangeRiskPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: EcnChangeRisk | null;
  onChange: (v: EcnChangeRisk) => void;
  invalid: boolean;
}): React.ReactElement {
  const t = useTranslations("wizard");
  return (
    <div>
      <div id={id} className="mb-1.5 text-[12px] font-semibold">
        {t("ecnChangeRisk")} <span style={{ color: "var(--danger)" }}>*</span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="flex gap-1.5">
        {CHANGE_RISK_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-invalid={invalid}
              onClick={() => onChange(opt.id)}
              className="flex flex-1 items-center justify-center rounded-md text-[13px] font-semibold"
              style={{
                height: 36,
                background: selected ? "var(--accent)" : "var(--surface)",
                color: selected ? "white" : "var(--text)",
                border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ECN's own Details step (Sprint 06 E3 AC1, `EcnCreateWizard.dc.html`):
 * changeType/title/description/changeRisk/effectiveDate/owner. No template
 * picker column (ecn has no templates), no site/area/priority fields (not in
 * E3 AC1's field list) — mirrors `RiskDetailsStep`'s exact shape.
 */
export function EcnDetailsStep({
  draft,
  fieldErrors,
  patch,
  fieldsNeedAttentionBanner,
}: {
  draft: WizardDraft;
  fieldErrors: FieldErrors;
  patch: (p: Partial<WizardDraft>) => void;
  fieldsNeedAttentionBanner?: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const fieldErrorFor = (name: keyof typeof fieldErrors): string | undefined => fieldErrors[name];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 32px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{t("ecnDetailsTitle")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{t("ecnDetailsSub")}</p>
      {fieldsNeedAttentionBanner}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="wizard-ecn-change-type" className="mb-1.5 block text-[12px] font-semibold">
            {t("ecnChangeType")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <select
            id="wizard-ecn-change-type"
            className="k-input"
            value={draft.ecnChangeType ?? ""}
            onChange={(e) => patch({ ecnChangeType: e.target.value === "" ? null : (e.target.value as WizardDraft["ecnChangeType"]) })}
            aria-invalid={fieldErrorFor("changeType") !== undefined}
          >
            <option value="" disabled>
              {t("ecnChangeTypePlaceholder")}
            </option>
            {CHANGE_TYPE_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrorFor("changeType")} />
        </div>

        <div>
          <label htmlFor="wizard-ecn-title" className="mb-1.5 block text-[12px] font-semibold">
            {t("title")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            id="wizard-ecn-title"
            className="k-input"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t("ecnTitlePlaceholder")}
            aria-invalid={fieldErrorFor("title") !== undefined}
            autoFocus
          />
          <FieldError message={fieldErrorFor("title")} />
        </div>

        <div>
          <label htmlFor="wizard-ecn-description" className="mb-1.5 block text-[12px] font-semibold">
            {t("ecnDescription")}
          </label>
          <textarea
            id="wizard-ecn-description"
            className="k-input"
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={3}
            style={{ height: "auto", padding: 12, resize: "vertical", fontFamily: "inherit" }}
            placeholder={t("ecnDescriptionPlaceholder")}
          />
          <FieldError message={fieldErrorFor("description")} />
        </div>

        <ChangeRiskPicker
          id="wizard-ecn-change-risk"
          value={draft.ecnChangeRisk}
          onChange={(v) => patch({ ecnChangeRisk: v })}
          invalid={fieldErrorFor("changeRisk") !== undefined}
        />
        <FieldError message={fieldErrorFor("changeRisk")} />

        <div>
          <label htmlFor="wizard-ecn-effective-date" className="mb-1.5 block text-[12px] font-semibold">
            {t("ecnEffectiveDate")}
          </label>
          <input
            id="wizard-ecn-effective-date"
            type="date"
            className="k-input"
            value={draft.ecnEffectiveDate}
            onChange={(e) => patch({ ecnEffectiveDate: e.target.value })}
            aria-invalid={fieldErrorFor("effectiveDate") !== undefined}
          />
          <FieldError message={fieldErrorFor("effectiveDate")} />
        </div>

        <div>
          <div id="wizard-ecn-owner-label" className="mb-1.5 text-[12px] font-semibold">
            {t("owner")} <span style={{ color: "var(--danger)" }}>*</span>
          </div>
          <OwnerPicker
            labelId="wizard-ecn-owner-label"
            ownerId={draft.ecnOwner}
            onSelect={(userId) => patch({ ecnOwner: userId })}
            invalid={fieldErrorFor("owner") !== undefined}
          />
          <FieldError message={fieldErrorFor("owner")} />
        </div>

        <div className="flex gap-3 rounded-md bg-bg-subtle p-4">
          <Info size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
          <div className="text-[12px] leading-relaxed text-muted">{t("ecnDefaultsNote")}</div>
        </div>
      </div>
    </div>
  );
}
