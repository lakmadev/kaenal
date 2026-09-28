"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { WIZARD_TYPES, type WizardDraft, type WizardType } from "@kaenal/core";
import type { PlantDto, TemplateDto } from "@kaenal/types";
import { Avatar } from "@/components/avatar";
import { PriorityBadge, Chip } from "@/components/ui";
import { useMembers } from "@/hooks/use-members";
import { WIZARD_ICON, WIZARD_COLOR } from "./wizard-meta";

/**
 * Step 3 — Review & create (createwizard.jsx `renderStep3`): the summary card
 * (type header, template/site/area/due/linked-NCR grid, description, team list)
 * and the AI pre-fill hint. `banner` renders the create-failure state (W7-H)
 * above the card when the last submit attempt failed.
 */
export function ReviewStep({
  type,
  draft,
  publishedTemplates,
  plants,
  banner,
}: {
  type: WizardType;
  draft: WizardDraft;
  publishedTemplates: readonly TemplateDto[];
  plants: readonly PlantDto[];
  banner?: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const def = WIZARD_TYPES[type];
  const Icon = WIZARD_ICON[type];
  const color = WIZARD_COLOR[type];
  const { data } = useMembers();
  const byId = useMemo(() => new Map((data?.items ?? []).map((m) => [m.userId, m])), [data]);

  const templateLabel =
    type === "inspection"
      ? (publishedTemplates.find((tpl) => tpl.id === draft.template)?.name ?? draft.template ?? "")
      : (def.templates.find((tpl) => tpl.id === draft.template)?.label ?? draft.template ?? "");
  const siteLabel = plants.find((p) => p.id === draft.plantId)?.name ?? draft.plantId;

  const aiHint = type === "8d" ? t("aiEightD") : type === "inspection" ? t("aiInspection") : t("aiOther");

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
          {def.hasPriorityAndDue && <PriorityBadge priority={draft.priority === "critical" ? "critical" : draft.priority === "high" ? "major" : "minor"} />}
        </div>

        <div className="grid grid-cols-2 gap-3.5 p-5 text-[13px]">
          <div>
            <div className="k-overline mb-1">{t("template")}</div>
            <div>{templateLabel}</div>
          </div>
          {draft.plantId !== "" && (
            <div>
              <div className="k-overline mb-1">{t("site")}</div>
              <div>{siteLabel}</div>
            </div>
          )}
          {draft.area.trim() !== "" && (
            <div>
              <div className="k-overline mb-1">{t("area")}</div>
              <div>{draft.area}</div>
            </div>
          )}
          {draft.due !== "" && (
            <div>
              <div className="k-overline mb-1">{t("due")}</div>
              <div>{draft.due}</div>
            </div>
          )}
          {draft.linkedNcr.trim() !== "" && (
            <div>
              <div className="k-overline mb-1">{t("linkedNcr")}</div>
              <div className="mono">{draft.linkedNcr}</div>
            </div>
          )}
        </div>

        {draft.description.trim() !== "" && (
          <div className="px-5 pb-5">
            <div className="k-overline mb-1.5">{t("description")}</div>
            <div className="text-[13px] leading-relaxed text-muted">{draft.description}</div>
          </div>
        )}

        <div className="border-t border-border p-5">
          <div className="k-overline mb-2">{t("team", { count: draft.people.length })}</div>
          <div className="flex flex-col gap-1.5">
            {draft.people.map((p) => {
              const member = byId.get(p.userId);
              if (member === undefined) return null;
              return (
                <div key={p.userId} className="flex items-center gap-2.5 text-[13px]">
                  <Avatar name={member.name} size={24} />
                  <span className="flex-1 font-medium">{member.name}</span>
                  <Chip>{p.role}</Chip>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-border bg-bg-subtle p-4 text-[12px] text-muted">
          <Zap size={14} strokeWidth={2} aria-hidden />
          <span>{aiHint}</span>
        </div>
      </div>
    </div>
  );
}
