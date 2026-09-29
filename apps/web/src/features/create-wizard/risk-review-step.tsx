"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { RISK_CATEGORY_OPTIONS, RISK_TREATMENT_OPTIONS, WIZARD_TYPES, type WizardDraft } from "@kaenal/core";
import { Avatar } from "@/components/avatar";
import { useMembers } from "@/hooks/use-members";
import { WIZARD_ICON, WIZARD_COLOR } from "./wizard-meta";

/**
 * Risk's Review & create step (Sprint 04 R4): the same wizard-review card
 * language as the shared `ReviewStep`, but reading risk's own Details-step
 * fields (category/likelihood/impact/treatment/owner/plan) instead of a
 * template + site/area/due + team list, which don't apply to risk.
 */
export function RiskReviewStep({
  draft,
  banner,
}: {
  draft: WizardDraft;
  banner?: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const def = WIZARD_TYPES.risk;
  const Icon = WIZARD_ICON.risk;
  const color = WIZARD_COLOR.risk;
  const { data } = useMembers();
  const owner = draft.riskOwner !== null ? (data?.items ?? []).find((m) => m.userId === draft.riskOwner) : undefined;

  const categoryLabel = RISK_CATEGORY_OPTIONS.find((c) => c.id === draft.riskCategory)?.label ?? "";
  const treatmentLabel = RISK_TREATMENT_OPTIONS.find((tr) => tr.id === draft.riskTreatment)?.label ?? "";
  const inherentScore = draft.riskLikelihood !== null && draft.riskImpact !== null ? draft.riskLikelihood * draft.riskImpact : null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 32px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{t("reviewTitle")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>{t("reviewSub")}</p>
      {banner}
      <div className="k-surface overflow-hidden">
        <div className="flex items-center gap-3.5 border-b border-border p-5">
          <div
            className="flex shrink-0 items-center justify-center rounded-md"
            style={{ width: 44, height: 44, background: `${color}18`, color }}
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="flex-1">
            <div className="k-overline">{def.label}</div>
            <div className="mt-0.5 text-[16px] font-semibold">{draft.title || t("untitled")}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 p-5 text-[13px]">
          <div>
            <div className="k-overline mb-1">{t("riskCategory")}</div>
            <div>{categoryLabel}</div>
          </div>
          <div>
            <div className="k-overline mb-1">{t("riskTreatment")}</div>
            <div>{treatmentLabel}</div>
          </div>
          <div>
            <div className="k-overline mb-1">{t("riskLikelihood")}</div>
            <div>{draft.riskLikelihood ?? ""}</div>
          </div>
          <div>
            <div className="k-overline mb-1">{t("riskImpact")}</div>
            <div>{draft.riskImpact ?? ""}</div>
          </div>
          {inherentScore !== null && (
            <div>
              <div className="k-overline mb-1">{t("riskInherentScore")}</div>
              <div>{inherentScore}</div>
            </div>
          )}
        </div>

        {draft.riskPlan.trim() !== "" && (
          <div className="px-5 pb-5">
            <div className="k-overline mb-1.5">{t("riskPlan")}</div>
            <div className="text-[13px] leading-relaxed text-muted">{draft.riskPlan}</div>
          </div>
        )}

        <div className="border-t border-border p-5">
          <div className="k-overline mb-2">{t("owner")}</div>
          {owner !== undefined ? (
            <div className="flex items-center gap-2.5 text-[13px]">
              <Avatar name={owner.name} size={24} />
              <span className="font-medium">{owner.name}</span>
            </div>
          ) : (
            <div className="text-[13px] text-muted">{t("riskNoOwner")}</div>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-border bg-bg-subtle p-4 text-[12px] text-muted">
          <Info size={14} strokeWidth={2} aria-hidden />
          <span>{t("riskDefaultsNote")}</span>
        </div>
      </div>
    </div>
  );
}
