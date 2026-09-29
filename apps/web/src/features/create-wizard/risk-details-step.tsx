"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, TriangleAlert, X } from "lucide-react";
import {
  RISK_CATEGORY_OPTIONS,
  RISK_SCALE_OPTIONS,
  RISK_TREATMENT_OPTIONS,
  type WizardDraft,
} from "@kaenal/core";
import type { MemberDto } from "@kaenal/types";
import { Avatar } from "@/components/avatar";
import { Skeleton } from "@/components/ui";
import { useMembers } from "@/hooks/use-members";
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
 * Risk's owner: a single-select (search-and-replace), not the shared
 * Assignees step's multi-role add-many picker — R4 AC1(b). Visually a
 * `PeoplePicker`-style row that swaps the selected person instead of
 * appending one.
 */
function OwnerPicker({
  ownerId,
  onSelect,
  invalid,
}: {
  ownerId: string | null;
  onSelect: (userId: string) => void;
  invalid: boolean;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useMembers();
  const byId = useMemo(() => new Map((data?.items ?? []).map((m) => [m.userId, m])), [data]);
  const owner: MemberDto | undefined = ownerId !== null ? byId.get(ownerId) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const all = data?.items ?? [];
    const query = q.trim().toLowerCase();
    return all.filter((u) => query === "" || u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query));
  }, [data, q]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div id="wizard-risk-owner-label" className="mb-1.5 text-[12px] font-semibold">
        {t("owner")} <span style={{ color: "var(--danger)" }}>*</span>
      </div>
      {owner !== undefined ? (
        <div className="flex items-center gap-2.5 rounded-md bg-bg-subtle px-3 py-2">
          <Avatar name={owner.name} size={28} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">{owner.name}</div>
            <div className="text-[11px] text-muted">{owner.role}</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="k-btn k-btn-ghost k-btn-sm"
            aria-label={t("changeOwner")}
          >
            {t("change")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby="wizard-risk-owner-label"
          aria-invalid={invalid}
          onClick={() => setOpen((o) => !o)}
          className="k-input"
          style={{ textAlign: "left", color: "var(--text-muted)" }}
        >
          {t("chooseOwner")}
        </button>
      )}
      {open && (
        <div
          className="k-surface fade-in absolute z-[100] flex flex-col overflow-hidden"
          style={{ top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 280, boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex items-center border-b border-border p-2">
            <input
              className="k-input"
              placeholder={t("searchPeople")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("cancel")}
              className="k-btn k-btn-icon k-btn-plain ml-1"
              style={{ height: 28, width: 28 }}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto p-1">
            {isLoading && <Skeleton className="m-1 h-10 rounded-sm" />}
            {!isLoading && filtered.length === 0 && (
              <div className="p-3 text-center text-[12px] text-muted">{t("noMatches")}</div>
            )}
            {filtered.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => {
                  onSelect(u.userId);
                  setOpen(false);
                  setQ("");
                }}
                aria-pressed={u.userId === ownerId}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left hover:bg-bg-subtle"
              >
                <Avatar name={u.name} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{u.name}</div>
                  <div className="text-[11px] text-muted">{u.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
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
          <OwnerPicker
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
