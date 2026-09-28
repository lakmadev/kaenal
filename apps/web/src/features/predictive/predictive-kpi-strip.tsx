import type { RiskPredictionDto } from "@kaenal/types";
import { Skeleton } from "@/components/ui";

const PRED_FORE = "#d97706";

/**
 * KPI strip — 3 tiles, not the jsx's 5 (DESIGN-03B-predictive.md §2.2,
 * `predictive.jsx` 174-180/200-211's `k-surface` tile shape kept, grid
 * `repeat(3,1fr)` in place of `repeat(5,1fr)`). "Forecast accuracy" is
 * dropped entirely (§3B Q20 — nothing honest to report until the v1 baseline
 * has run a few real horizons); "Lines flagged"/"Suppliers flagged" merge
 * into one tile per §2.2's literal reading of §3B's "3, honestly". Computed
 * client-side from the already-fetched ranked rows (the same aggregation
 * pattern `supplier-list.tsx`'s `KpiStrip` uses over its own fetched items —
 * not a new business rule, just a display sum/average/count over rows the
 * page already has).
 */
export function PredictiveKpiStrip({
  lines,
  suppliers,
  isLoading,
}: {
  lines: readonly RiskPredictionDto[];
  suppliers: readonly RiskPredictionDto[];
  isLoading: boolean;
}): React.ReactElement {
  const all = [...lines, ...suppliers];
  const hasAny = all.length > 0;

  const predictedTotal = all.reduce((sum, r) => sum + r.predictedValue, 0);
  const nowTotal = all.reduce((sum, r) => sum + (r.history[r.history.length - 1] ?? 0), 0);
  const delta = hasAny && nowTotal > 0 ? Math.round(((predictedTotal - nowTotal) / nowTotal) * 100) : null;

  const flaggedLines = lines.filter((r) => r.level === "critical" || r.level === "high").length;
  const flaggedSuppliers = suppliers.filter((r) => r.level === "critical" || r.level === "high").length;

  const avgConfidence = hasAny ? Math.round(all.reduce((sum, r) => sum + r.confidence, 0) / all.length) : null;

  const tiles: { label: string; value: string; sub: string; color: string; delta?: string }[] = [
    {
      label: "Predicted NCs · this horizon",
      value: hasAny ? String(Math.round(predictedTotal * 10) / 10) : "—",
      sub: hasAny ? `${nowTotal} at last actual period` : "no scored subjects yet",
      color: PRED_FORE,
      ...(delta !== null ? { delta: `${delta > 0 ? "+" : ""}${delta}%` } : {}),
    },
    {
      label: "Lines / suppliers flagged",
      value: hasAny ? `${flaggedLines} / ${flaggedSuppliers}` : "—",
      sub: hasAny ? `of ${lines.length} lines · ${suppliers.length} suppliers scored` : "no scored subjects yet",
      color: "#dc2626",
    },
    {
      label: "Model confidence",
      value: avgConfidence === null ? "—" : `${avgConfidence}%`,
      sub: "avg across forecasts",
      color: "#2563eb",
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="k-surface p-3.5">
          <div className="k-overline text-muted">{t.label}</div>
          {isLoading ? (
            <Skeleton className="mt-1.5 h-6 w-16" />
          ) : (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="mono text-[24px] font-bold" style={{ color: t.color }}>
                {t.value}
              </span>
              {t.delta !== undefined && (
                <span className="mono text-[11px] font-semibold" style={{ color: PRED_FORE }}>
                  {t.delta}
                </span>
              )}
            </div>
          )}
          <div className="mt-0.5 text-[10.5px] text-subtle">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
