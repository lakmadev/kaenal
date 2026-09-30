import type { EcnStage } from "@kaenal/types";
import { ECN_STAGE_ORDER, ecnStageIndex } from "@kaenal/core";

/** All 9 Kanban columns, in board order (`ECNKanban`, `qms-modules.jsx:593-611`,
 *  corrected per DESIGN-06 §4.6/§0 to 9: `ppap` inserted, `rejected` added). */
export const ECN_KANBAN_COLUMNS: readonly EcnStage[] = [
  "draft",
  "feasibility",
  "risk_review",
  "ppap",
  "cab_approval",
  "pilot",
  "implementation",
  "closed",
  "rejected",
];

export const STAGE_LABEL: Record<EcnStage, string> = {
  draft: "Draft",
  feasibility: "Feasibility",
  risk_review: "Risk review",
  ppap: "PPAP",
  cab_approval: "CAB approval",
  pilot: "Pilot",
  implementation: "Implementation",
  closed: "Closed",
  rejected: "Rejected",
};

/** Column dot colours — `ECNKanban`'s own per-column `color` (`qms-modules.jsx:595-601`),
 *  extended for `ppap` (`--risk-info`, DESIGN-06 §0's touch-up) and `rejected`
 *  (`--risk-critical` — a real, on-token colour, never a new one). */
export const STAGE_COLOR: Record<EcnStage, string> = {
  draft: "#64748b",
  feasibility: "#7c3aed",
  risk_review: "#f59e0b",
  ppap: "var(--risk-info)",
  cab_approval: "#2563eb",
  pilot: "#0d9488",
  implementation: "#16a34a",
  closed: "#94a3b8",
  rejected: "var(--risk-critical)",
};

export interface EcnStageProgress {
  readonly step: number;
  readonly of: number;
}

/** "step X of 7" against the canonical pipeline (E1 AC2/§0b D1) — `null` for
 *  the two outcomes (`closed`/`rejected`) that sit outside the progress bar. */
export function stageProgress(stage: EcnStage): EcnStageProgress | null {
  const step = ecnStageIndex(stage);
  return step === null ? null : { step, of: ECN_STAGE_ORDER.length };
}
