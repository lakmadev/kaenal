"use client";

import { useTranslations } from "next-intl";
import { Info, TriangleAlert } from "lucide-react";
import {
  RISK_CATEGORY_OPTIONS,
  RISK_SCALE_OPTIONS,
  RISK_TREATMENT_OPTIONS,
  type WizardDraft,
} from "@kaenal/core";
import { OwnerPicker } from "./owner-picker";
import type { FieldErrors } from "./use-wizard-draft";

function FieldError({ message }: { message?: string | undefined }): React.ReactElement | null {
  if (message === undefined) return null;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--danger-fg)" }}>
      <TriangleAlert size={13} aria-hidden />
      {message}
    </div>
  );
}

/** A 1-5 segmented picker for likelihood/impact (RiskWizardDetails.dc.html — a
 *  real radio-group, not `<div onClick>`, per the board's WCAG note). */
function ScalePicker({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  invalid: boolean;
}): React.ReactElement {
  return (
    <div>
      <div id={id} className="mb-1.5 text-[12px] font-semibold">
        {label} <span style={{ color: "var(--danger)" }}>*</span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="flex gap-1.5">
        {RISK_SCALE_OPTIONS.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-invalid={invalid}
              onClick={() => onChange(n)}
              className="flex flex-1 items-center justify-center rounded-md text-[13px] font-semibold"
              style={{
                height: 36,
                background: selected ? "var(--accent)" : "var(--surface)",
                color: selected ? "white" : "var(--text)",
                border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Risk's own Details step (Sprint 04 R4 AC1, `RiskWizardDetails.dc.html`):
 * category/title/likelihood/impact/treatment/plan plus the single-select
 * owner field that replaces the shared Assignees step for this type only.
 * No template picker column (risk has no templates), no site/area/priority/
 * due fields (not in R4 AC1's field list).
 */
export function RiskDetailsStep({
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
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{t("riskDetailsTitle")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{t("riskDetailsSub")}</p>
      {fieldsNeedAttentionBanner}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="wizard-risk-category" className="mb-1.5 block text-[12px] font-semibold">
            {t("riskCategory")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <select
            id="wizard-risk-category"
            className="k-input"
            value={draft.riskCategory ?? ""}
            onChange={(e) => patch({ riskCategory: e.target.value === "" ? null : (e.target.value as WizardDraft["riskCategory"]) })}
            aria-invalid={fieldErrorFor("category") !== undefined}
          >
            <option value="" disabled>
              {t("riskCategoryPlaceholder")}
            </option>
            {RISK_CATEGORY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrorFor("category")} />
        </div>

        <div>
          <label htmlFor="wizard-risk-title" className="mb-1.5 block text-[12px] font-semibold">
            {t("title")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            id="wizard-risk-title"
            className="k-input"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t("riskTitlePlaceholder")}
            aria-invalid={fieldErrorFor("title") !== undefined}
            autoFocus
          />
          <FieldError message={fieldErrorFor("title")} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <ScalePicker
              id="wizard-risk-likelihood"
              label={t("riskLikelihood")}
              value={draft.riskLikelihood}
              onChange={(n) => patch({ riskLikelihood: n })}
              invalid={fieldErrorFor("likelihood") !== undefined}
            />
            <FieldError message={fieldErrorFor("likelihood")} />
          </div>
          <div>
            <ScalePicker
              id="wizard-risk-impact"
              label={t("riskImpact")}
              value={draft.riskImpact}
              onChange={(n) => patch({ riskImpact: n })}
              invalid={fieldErrorFor("impact") !== undefined}
            />
            <FieldError message={fieldErrorFor("impact")} />
          </div>
        </div>

        <div>
          <label htmlFor="wizard-risk-treatment" className="mb-1.5 block text-[12px] font-semibold">
            {t("riskTreatment")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <select
            id="wizard-risk-treatment"
            className="k-input"
            value={draft.riskTreatment ?? ""}
            onChange={(e) => patch({ riskTreatment: e.target.value === "" ? null : (e.target.value as WizardDraft["riskTreatment"]) })}
            aria-invalid={fieldErrorFor("treatment") !== undefined}
          >
            <option value="" disabled>
              {t("riskTreatmentPlaceholder")}
            </option>
            {RISK_TREATMENT_OPTIONS.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrorFor("treatment")} />
        </div>

        <div>
          <div id="wizard-risk-owner-label" className="mb-1.5 text-[12px] font-semibold">
            {t("owner")} <span style={{ color: "var(--danger)" }}>*</span>
          </div>
          <OwnerPicker
            labelId="wizard-risk-owner-label"
            ownerId={draft.riskOwner}
            onSelect={(userId) => patch({ riskOwner: userId })}
            invalid={fieldErrorFor("owner") !== undefined}
          />
          <FieldError message={fieldErrorFor("owner")} />
        </div>

        <div>
          <label htmlFor="wizard-risk-plan" className="mb-1.5 block text-[12px] font-semibold">
            {t("riskPlan")}
          </label>
          <textarea
            id="wizard-risk-plan"
            className="k-input"
            value={draft.riskPlan}
            onChange={(e) => patch({ riskPlan: e.target.value })}
            rows={3}
            style={{ height: "auto", padding: 12, resize: "vertical", fontFamily: "inherit" }}
            placeholder={t("riskPlanPlaceholder")}
          />
          <FieldError message={fieldErrorFor("plan")} />
        </div>

        <div className="flex gap-3 rounded-md bg-bg-subtle p-4">
          <Info size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
          <div className="text-[12px] leading-relaxed text-muted">{t("riskDefaultsNote")}</div>
        </div>
      </div>
    </div>
  );
}
