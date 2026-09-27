"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { PRIORITY_OPTIONS, WIZARD_TYPES, templateQuestionCount, type WizardDraft, type WizardType } from "@kaenal/core";
import type { PlantDto, TemplateDto } from "@kaenal/types";
import { FileDrop } from "@/features/documents/file-drop";
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

/**
 * Step 1 — Template + Details (createwizard.jsx `renderStep1`): a template
 * picker on the left, the details form on the right. Inspection templates come
 * from the tenant's real published pool; the other three types use the fixed
 * template lists from `WIZARD_TYPES`.
 */
export function DetailsStep({
  type,
  draft,
  fieldErrors,
  patch,
  onTemplateSelect,
  publishedTemplates,
  templatesLoading,
  plants,
  fieldsNeedAttentionBanner,
}: {
  type: WizardType;
  draft: WizardDraft;
  fieldErrors: FieldErrors;
  patch: (p: Partial<WizardDraft>) => void;
  onTemplateSelect: (id: string) => void;
  publishedTemplates: readonly TemplateDto[];
  templatesLoading: boolean;
  plants: readonly PlantDto[];
  /** Shown above the Details form when a 422 mapped errors onto this step (W7-G). */
  fieldsNeedAttentionBanner?: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const def = WIZARD_TYPES[type];
  const fieldErrorFor = (name: keyof typeof fieldErrors): string | undefined => fieldErrors[name];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{t("templateTitle")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{t("templateSub")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {type === "inspection" ? (
            templatesLoading ? (
              <div className="skeleton h-14 rounded-md" />
            ) : publishedTemplates.length === 0 ? (
              <div className="text-[13px] text-muted">{t("noTemplatesBody")}</div>
            ) : (
              publishedTemplates.map((tpl) => (
                <TemplateRow
                  key={tpl.id}
                  label={tpl.name}
                  meta={t("inspectionMeta", { count: templateQuestionCount(tpl.schema), version: tpl.version })}
                  selected={draft.template === tpl.id}
                  color="#2563eb"
                  onClick={() => onTemplateSelect(tpl.id)}
                />
              ))
            )
          ) : (
            def.templates.map((tpl) => (
              <TemplateRow
                key={tpl.id}
                label={tpl.label}
                meta={tpl.meta}
                selected={draft.template === tpl.id}
                color="var(--accent)"
                onClick={() => onTemplateSelect(tpl.id)}
              />
            ))
          )}
        </div>
        {type === "document" && draft.template === "upload" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("file")}</div>
            <FileDrop value={null} onChange={(f) => patch({ fileId: f?.id ?? null })} />
            <p className="mt-1.5 text-[11.5px] text-muted">{t("fileHint")}</p>
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{t("detailsTitle")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{t("detailsSub")}</p>
        {fieldsNeedAttentionBanner}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="wizard-title" className="mb-1.5 block text-[12px] font-semibold">
              {t("title")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="wizard-title"
              className="k-input"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={def.titlePlaceholder}
              aria-invalid={fieldErrorFor("title") !== undefined}
              autoFocus
            />
            <FieldError message={fieldErrorFor("title")} />
          </div>

          {def.hasPriorityAndDue && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="wizard-priority" className="mb-1.5 block text-[12px] font-semibold">
                  {t("priority")}
                </label>
                <select
                  id="wizard-priority"
                  className="k-input"
                  value={draft.priority}
                  onChange={(e) => patch({ priority: e.target.value as WizardDraft["priority"] })}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wizard-due" className="mb-1.5 block text-[12px] font-semibold">
                  {t("dueDate")}
                </label>
                <input
                  id="wizard-due"
                  type="date"
                  className="k-input"
                  value={draft.due}
                  onChange={(e) => patch({ due: e.target.value })}
                  aria-invalid={fieldErrorFor("due") !== undefined}
                />
                <FieldError message={fieldErrorFor("due")} />
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="wizard-site" className="mb-1.5 block text-[12px] font-semibold">
                {t("site")}
              </label>
              <select
                id="wizard-site"
                className="k-input"
                value={draft.plantId}
                onChange={(e) => patch({ plantId: e.target.value })}
                aria-invalid={fieldErrorFor("site") !== undefined}
              >
                <option value="">—</option>
                {plants.length === 0 && (
                  <option value="" disabled>
                    {t("noSites")}
                  </option>
                )}
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.code}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrorFor("site")} />
            </div>
            <div>
              <label htmlFor="wizard-area" className="mb-1.5 block text-[12px] font-semibold">
                {t("area")}
              </label>
              <input
                id="wizard-area"
                className="k-input"
                value={draft.area}
                onChange={(e) => patch({ area: e.target.value })}
                placeholder={def.areaPlaceholder}
              />
            </div>
          </div>

          {type === "8d" && (
            <div>
              <label htmlFor="wizard-linked-ncr" className="mb-1.5 block text-[12px] font-semibold">
                {t("linkedNcr")}
              </label>
              <input
                id="wizard-linked-ncr"
                className="k-input"
                value={draft.linkedNcr}
                onChange={(e) => patch({ linkedNcr: e.target.value })}
                placeholder={t("linkedNcrPlaceholder")}
                aria-invalid={fieldErrorFor("linkedNcr") !== undefined}
              />
              <FieldError message={fieldErrorFor("linkedNcr")} />
            </div>
          )}

          <div>
            <label htmlFor="wizard-description" className="mb-1.5 block text-[12px] font-semibold">
              {t("description")}
            </label>
            <textarea
              id="wizard-description"
              className="k-input"
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={4}
              style={{ height: "auto", padding: 12, resize: "vertical", fontFamily: "inherit" }}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateRow({
  label,
  meta,
  selected,
  color,
  onClick,
}: {
  label: string;
  meta: string;
  selected: boolean;
  color: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        width: "100%",
        padding: "14px 16px",
        textAlign: "left",
        background: selected ? `${color}08` : "var(--surface)",
        border: `1px solid ${selected ? color : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `2px solid ${selected ? color : "var(--border-strong)"}`,
          background: selected ? color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{meta}</div>
      </div>
    </button>
  );
}
