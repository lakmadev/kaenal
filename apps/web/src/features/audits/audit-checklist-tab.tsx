"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Link2, ListChecks } from "lucide-react";
import type { AuditChecklistStatus, AuditDto } from "@kaenal/types";
import { Button, Chip, EmptyState, useToast } from "@/components/ui";
import { useCan } from "@/hooks/use-me";
import { useUpdateAuditChecklistItem } from "@/hooks/use-audits";
import { errorMessage } from "@/lib/api-error";

/** Scoring buttons, left → right, matching `CHECKLIST_STATUS`/`audits.jsx:434`. */
const SCORE_OPTIONS: AuditChecklistStatus[] = ["conformant", "minor_nc", "major_nc", "opportunity", "na"];

/** Colour pairs ported from the jsx's `CHECKLIST_STATUS` (audits.jsx:1-8) —
 *  literal, like `badge.tsx`'s own status maps, since these are compound
 *  rgba backgrounds tokens.css doesn't declare directly. */
const STATUS_STYLE: Record<AuditChecklistStatus, { bg: string; fg: string; dot: string }> = {
  pending: { bg: "var(--bg-subtle)", fg: "var(--text-muted)", dot: "#94a3b8" },
  conformant: { bg: "rgba(34,197,94,0.12)", fg: "#15803d", dot: "#22c55e" },
  minor_nc: { bg: "rgba(234,88,12,0.12)", fg: "#c2410c", dot: "#ea580c" },
  major_nc: { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", dot: "#dc2626" },
  opportunity: { bg: "rgba(99,102,241,0.12)", fg: "#4338ca", dot: "#6366f1" },
  na: { bg: "var(--bg-subtle)", fg: "var(--text-muted)", dot: "#cbd5e1" },
};

interface AuditChecklistTabProps {
  audit: AuditDto;
  /** Switch the parent shell to the Findings tab (linked-finding line). */
  onViewFindings?: () => void;
}

const STATUS_LABEL_KEY: Record<AuditChecklistStatus, string> = {
  pending: "statusPending",
  conformant: "statusConformant",
  minor_nc: "statusMinorNc",
  major_nc: "statusMajorNc",
  opportunity: "statusOpportunity",
  na: "statusNa",
};

/**
 * Checklist tab (Sprint 02 S2-4) — `audits.jsx` `AuditChecklist` (403-492),
 * `CHECKLIST_STATUS` (394-401). Renders the real `audit.checklist` (a jsonb
 * array on the audit row): counts strip, per-clause scoring buttons, notes
 * callout, linked-finding line. Scoring calls `PATCH …/checklist/:itemId`
 * (`useUpdateAuditChecklistItem`) — a 409 opens the existing global stale-write
 * dialog (wired at the `QueryClient` level, same as every other mutation); a
 * 422 (audit closed) surfaces as a toast and the buttons are disabled
 * pre-emptively from `audit.status`. The evidence-count chip is DROPPED per
 * the sprint's architecture-review resolution (no per-item attach mechanism
 * exists) — logged in PROGRESS.md Known issues, not rendered as a fake zero.
 */
export function AuditChecklistTab({ audit, onViewFindings }: AuditChecklistTabProps): React.ReactElement {
  const t = useTranslations("auditChecklist");
  const toast = useToast();
  const canScore = useCan("audit:manage");
  const closed = audit.status === "closed";
  const mutation = useUpdateAuditChecklistItem(audit.id);
  const [scoringItemId, setScoringItemId] = useState<string | null>(null);

  const items = audit.checklist;

  if (items.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState icon={ListChecks} title={t("emptyTitle")} body={t("emptyBody")} />
      </div>
    );
  }

  const counts = {
    conformant: items.filter((i) => i.status === "conformant").length,
    ncs: items.filter((i) => i.status === "minor_nc" || i.status === "major_nc").length,
    pending: items.filter((i) => i.status === "pending").length,
  };

  function score(itemId: string, status: AuditChecklistStatus): void {
    setScoringItemId(itemId);
    mutation.mutate(
      { itemId, body: { status, version: audit.lockVersion } },
      {
        onError: (e) => toast.error(errorMessage(e)),
        onSettled: () => setScoringItemId(null),
      },
    );
  }

  return (
    <div className="k-surface p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-[18px] py-3.5">
        <div className="text-[13px] font-semibold text-text">Audit checklist</div>
        {audit.standard !== null && <span className="text-[11px] text-muted">· {audit.standard}</span>}
        <div className="ml-auto flex gap-3 text-[11.5px]">
          <span style={{ color: "#15803d", fontWeight: 600 }}>
            <span aria-hidden>●</span> {counts.conformant} {t("countConformant")}
          </span>
          <span style={{ color: "#dc2626", fontWeight: 600 }}>
            <span aria-hidden>●</span> {counts.ncs} {t("countNcs")}
          </span>
          <span className="text-muted">
            <span aria-hidden>●</span> {counts.pending} {t("countPending")}
          </span>
        </div>
      </div>

      {closed && (
        <div className="border-b border-border bg-bg-subtle px-[18px] py-2.5 text-[12px] text-muted">{t("closedNotice")}</div>
      )}

      <div>
        {items.map((item) => {
          const cs = STATUS_STYLE[item.status];
          const isScoring = mutation.isPending && scoringItemId === item.id;
          return (
            <div key={item.id} className="flex items-start gap-3 border-b border-border px-[18px] py-3.5 last:border-b-0">
              <div className="w-[60px] shrink-0">
                <div className="font-mono text-[11px] font-bold text-muted">§{item.clause}</div>
                <div className="text-[10px] text-muted">{item.section.split(" ").slice(0, 2).join(" ")}</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 text-[13px] font-medium leading-[1.4] text-text">{item.text}</div>

                {canScore && (
                  <div className="flex flex-wrap gap-1.5">
                    {SCORE_OPTIONS.map((s) => {
                      const optStyle = STATUS_STYLE[s];
                      const active = item.status === s;
                      return (
                        <Button
                          key={s}
                          loading={isScoring}
                          disabled={closed || (mutation.isPending && !isScoring)}
                          disabledReason={closed ? t("closedNotice") : undefined}
                          onClick={() => score(item.id, s)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 500,
                            height: "auto",
                            border: `1px solid ${active ? optStyle.dot : "var(--border)"}`,
                            borderRadius: "var(--r-sm)",
                            background: active ? optStyle.bg : "var(--surface)",
                            color: active ? optStyle.fg : "var(--text-muted)",
                          }}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-[5px] w-[5px] rounded-full"
                            style={{ background: optStyle.dot }}
                          />
                          {t(STATUS_LABEL_KEY[s])}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {item.notes !== null && item.notes !== "" && (
                  <div className="mt-2 rounded-[var(--r-sm)] bg-bg-subtle px-2.5 py-2 text-[11.5px] leading-[1.45] text-muted">
                    <Info size={11} className="mr-1 inline" aria-hidden />
                    <em>{item.notes}</em>
                  </div>
                )}

                {item.findingId !== null && (
                  <button
                    type="button"
                    onClick={onViewFindings}
                    className="k-link mt-1.5 inline-flex items-center gap-1 text-[11.5px]"
                  >
                    <Link2 size={11} aria-hidden /> {t("linkedFinding")}
                  </button>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Chip bg={cs.bg} fg={cs.fg} dot={cs.dot}>
                  {t(STATUS_LABEL_KEY[item.status])}
                </Chip>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
