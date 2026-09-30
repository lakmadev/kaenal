import type { EcnApprovalStage, EcnChangeRisk, EcnChangeType } from "@kaenal/types";
import { ECN_GATED_STAGES } from "@kaenal/core";
import { Chip } from "@/components/ui";
import { STAGE_LABEL, stageProgress } from "@/lib/ecn-stage";

export { ECN_KANBAN_COLUMNS, STAGE_COLOR, STAGE_LABEL, stageProgress } from "@/lib/ecn-stage";

export const CHANGE_TYPE_LABEL: Record<EcnChangeType, string> = {
  design: "Design",
  process: "Process",
  tooling: "Tooling",
  material: "Material",
};

/** The 5-row approval tracker's stage order (E4). */
export const ECN_APPROVAL_STAGES: readonly EcnApprovalStage[] = ECN_GATED_STAGES as readonly EcnApprovalStage[];

/** `ECNList`'s own risk chip palette (`qms-modules.jsx:577-582`), 1:1. */
export function EcnRiskChip({ risk }: { risk: EcnChangeRisk }): React.ReactElement {
  const style =
    risk === "high"
      ? { background: "rgba(220,38,38,0.10)", color: "#b91c1c" }
      : risk === "medium"
        ? { background: "rgba(245,158,11,0.12)", color: "#92400e" }
        : { background: "rgba(34,197,94,0.10)", color: "var(--success-700)" };
  return <Chip style={style}>{risk}</Chip>;
}

/** The stage progress bar cell (`ECNList`'s own bar, `qms-modules.jsx:568-575`),
 *  `null` step renders the terminal label alone (no bar — closed/rejected sit
 *  outside the "of 7" count). */
export function EcnStageProgress({ stage }: { stage: Parameters<typeof stageProgress>[0] }): React.ReactElement {
  const progress = stageProgress(stage);
  return (
    <div className="flex items-center gap-1.5">
      {progress !== null && (
        <div style={{ width: 80, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              width: `${(progress.step / progress.of) * 100}%`,
              height: "100%",
              background: "var(--accent)",
            }}
          />
        </div>
      )}
      <span style={{ fontSize: 11 }}>
        {STAGE_LABEL[stage]}
        {progress !== null ? ` · step ${progress.step} of ${progress.of}` : ""}
      </span>
    </div>
  );
}
