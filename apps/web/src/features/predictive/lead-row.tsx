import { Zap } from "lucide-react";
import type { RiskPredictionDto } from "@kaenal/types";
import { ForecastSpark } from "./forecast-spark";
import { RiskLevelChip, riskLevelStyle } from "./risk-chip";

const PRED_FORE = "#d97706";

/**
 * Leading-indicator row (`predictive.jsx` `LeadRow`, lines 117-159). Identity
 * + real driver text (`reasoning`, from `forecast.ts`'s deterministic trend
 * description — never the jsx's invented domain narratives), the forecast
 * spark, and the predicted figure with delta-vs-now and confidence.
 */
export function LeadRow({ row, onOpen }: { row: RiskPredictionDto; onOpen: () => void }): React.ReactElement {
  const lv = riskLevelStyle(row.level);
  const now = row.history[row.history.length - 1] ?? 0;
  const delta = Math.round((row.predictedValue - now) * 10) / 10;
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const deltaColor = delta > 0 ? "#c2410c" : delta < 0 ? "#15803d" : "var(--text-muted)";

  return (
    <button
      onClick={onOpen}
      className="grid w-full items-center gap-3.5 rounded-md border border-border bg-surface p-2.5 text-left transition-colors hover:border-border-strong hover:bg-bg-subtle"
      style={{ gridTemplateColumns: "1fr 168px 92px" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: lv.dot }} aria-hidden />
          <span className="truncate text-[13px] font-semibold">{row.subjectName ?? "Unnamed subject"}</span>
          <RiskLevelChip level={row.level} />
        </div>
        <div className="ml-[15px] mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <Zap size={11} style={{ color: lv.dot }} aria-hidden />
          <span className="truncate">{row.reasoning}</span>
        </div>
      </div>

      <ForecastSpark history={row.history} predictedValue={row.predictedValue} bandLow={row.bandLow} bandHigh={row.bandHigh} />

      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className="mono text-[23px] font-bold leading-none" style={{ color: PRED_FORE }}>
            {row.predictedValue}
          </span>
          <span className="text-[10.5px] text-muted">NC</span>
        </div>
        <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-subtle">predicted</div>
        <div className="mono mt-0.5 text-[11px] font-semibold" style={{ color: deltaColor }}>
          {arrow} {delta > 0 ? "+" : ""}
          {delta} vs now
        </div>
        <div className="mt-0.5 text-[10px] text-subtle">{row.confidence}% conf.</div>
      </div>
    </button>
  );
}
