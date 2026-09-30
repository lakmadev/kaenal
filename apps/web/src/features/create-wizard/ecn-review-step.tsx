"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { WIZARD_TYPES, type WizardDraft } from "@kaenal/core";
import { Avatar } from "@/components/avatar";
import { useMembers } from "@/hooks/use-members";
import { WIZARD_ICON, WIZARD_COLOR } from "./wizard-meta";

const CHANGE_TYPE_LABEL: Record<string, string> = {
  design: "Design",
  process: "Process",
  tooling: "Tooling",
  material: "Material",
};

const CHANGE_RISK_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * ECN's Review & create step (Sprint 06 E3): the same wizard-review card
 * language as `RiskReviewStep`, reading ecn's own Details-step fields
 * (changeType/changeRisk/effectiveDate/owner) instead of a template + site/
 * area/due + team list, which don't apply to ecn.
 */
export function EcnReviewStep({
  draft,
  banner,
}: {
  draft: WizardDraft;
  banner?: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const def = WIZARD_TYPES.ecn;
  const Icon = WIZARD_ICON.ecn;
  const color = WIZARD_COLOR.ecn;
  const { data } = useMembers();
  const owner = draft.ecnOwner !== null ? (data?.items ?? []).find((m) => m.userId === draft.ecnOwner) : undefined;

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
            <div className="k-overline mb-1">{t("ecnChangeType")}</div>
            <div>{draft.ecnChangeType !== null ? CHANGE_TYPE_LABEL[draft.ecnChangeType] : ""}</div>
          </div>
          <div>
            <div className="k-overline mb-1">{t("ecnChangeRisk")}</div>
            <div>{draft.ecnChangeRisk !== null ? CHANGE_RISK_LABEL[draft.ecnChangeRisk] : ""}</div>
          </div>
          <div>
            <div className="k-overline mb-1">{t("ecnEffectiveDate")}</div>
            <div>{draft.ecnEffectiveDate !== "" ? draft.ecnEffectiveDate : "—"}</div>
          </div>
        </div>

        {draft.description.trim() !== "" && (
          <div className="px-5 pb-5">
            <div className="k-overline mb-1.5">{t("ecnDescription")}</div>
            <div className="text-[13px] leading-relaxed text-muted">{draft.description}</div>
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
          <span>{t("ecnDefaultsNote")}</span>
        </div>
      </div>
    </div>
  );
}
