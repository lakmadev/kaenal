import type { PredictionRiskLevel } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * Risk-level chip vocabulary local to this screen (DESIGN-03B-predictive.md
 * §2.1) — `predictive.jsx`'s `PRED_LEVELS` (lines 80-85) exact labels/colours,
 * reproduced with the base `k-chip` primitive directly rather than the shared
 * `RiskBadge` (its labels are generic "Medium"/"Low", not this screen's
 * domain wording "Watch"/"Stable"). Colours match `RiskBadge`'s `RISK_STYLES`
 * exactly (confirmed in the design audit) — no new token, no new colour.
 */
const PRED_LEVELS: Record<PredictionRiskLevel, { label: string; fg: string; bg: string; dot: string }> = {
  critical: { label: "Critical", fg: "#b91c1c", bg: "rgba(220,38,38,0.10)", dot: "#dc2626" },
  high: { label: "High", fg: "#c2410c", bg: "rgba(234,88,12,0.12)", dot: "#ea580c" },
  medium: { label: "Watch", fg: "#b45309", bg: "rgba(245,158,11,0.13)", dot: "#f59e0b" },
  low: { label: "Stable", fg: "#15803d", bg: "rgba(34,197,94,0.13)", dot: "#22c55e" },
};

export function riskLevelStyle(level: PredictionRiskLevel): { label: string; fg: string; bg: string; dot: string } {
  return PRED_LEVELS[level];
}

export function RiskLevelChip({ level }: { level: PredictionRiskLevel }): React.ReactElement {
  const lv = PRED_LEVELS[level];
  return (
    <Chip bg={lv.bg} fg={lv.fg} dot={lv.dot} style={{ flexShrink: 0 }}>
      {lv.label}
    </Chip>
  );
}
