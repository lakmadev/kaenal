"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { horizonLabel, type ForecastHorizonKind } from "@kaenal/core";
import { usePredictions } from "@/hooks/use-predictions";
import { PageHeader } from "@/components/page-header";
import { EmptyState, Segmented, Skeleton } from "@/components/ui";
import { PredictiveKpiStrip } from "./predictive-kpi-strip";
import { ModelBanner } from "./model-banner";
import { GovernancePanel } from "./governance-panel";
import { RankedPanel } from "./ranked-panel";
import { ForecastPackExportButton } from "./forecast-pack-export-button";

const HORIZON_OPTIONS: { value: ForecastHorizonKind; label: string }[] = [
  { value: "month", label: "Next month" },
  { value: "quarter", label: "Next quarter" },
  { value: "half", label: "Next 2Q" },
];

/**
 * `/predictive` — `predictive.jsx` `PredictiveRisk` (164-254), rebuilt against
 * real data end to end (P3). Excludes the jsx's "Recurring failure modes"
 * panel entirely, per the sprint's explicit out-of-scope decision (§7 Q17,
 * DESIGN-03B-predictive.md) — nothing renders in that slot, not a stub.
 * "Tune model" is replaced by the governance-disclosure panel (P5).
 */
export function PredictiveRiskPage(): React.ReactElement {
  const [horizonKind, setHorizonKind] = useState<ForecastHorizonKind>("quarter");
  // horizonLabel is a pure `packages/core` function (§3B) — the calendar
  // period string ("2026-Q4") the API's `horizon` filter expects, not a
  // client-side forecast computation.
  const horizon = useMemo(() => horizonLabel(horizonKind, new Date()), [horizonKind]);

  const linesQuery = usePredictions({ subjectKind: "line", horizon, order: "predicted_value", limit: 10 });
  const suppliersQuery = usePredictions({ subjectKind: "supplier", horizon, order: "predicted_value", limit: 10 });

  const lines = linesQuery.data?.items ?? [];
  const suppliers = suppliersQuery.data?.items ?? [];
  const bothLoading = linesQuery.isLoading || suppliersQuery.isLoading;
  const bothSettled = !linesQuery.isLoading && !suppliersQuery.isLoading;
  const bothErrored = linesQuery.isError && suppliersQuery.isError;
  // Page-level "not enough history" (DESIGN-03B-predictive.md board State C,
  // P21 DoD's named tenant-wide empty state): nothing scored anywhere, and
  // neither query failed (a real empty result, not an error masquerading as
  // one). One page-wide empty state replaces both panels, per the P3 UC.
  const tenantWideEmpty = bothSettled && !bothErrored && lines.length === 0 && suppliers.length === 0 && !linesQuery.isError && !suppliersQuery.isError;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-0 p-6">
      <PageHeader
        title="Predictive risk"
        description="Forward-looking NC forecasts for production lines and suppliers, ranked by predicted volume."
        actions={
          <>
            <Segmented ariaLabel="Forecast horizon" value={horizonKind} onChange={setHorizonKind} options={HORIZON_OPTIONS} size="sm" />
            <ForecastPackExportButton />
          </>
        }
      />

      <div className="mt-4">
        {bothLoading ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
        ) : (
          <PredictiveKpiStrip lines={lines} suppliers={suppliers} isLoading={false} />
        )}

        <ModelBanner />
        <GovernancePanel />

        {tenantWideEmpty ? (
          <div className="k-surface">
            <EmptyState
              icon={TrendingUp}
              title="Not enough history yet"
              body="No production line or supplier has enough trailing NC history for the model to forecast. Scores appear once the nightly model has at least 4 of the last 6 months of data for a subject."
            />
          </div>
        ) : (
          <>
            <div className="k-overline mb-2.5 flex items-center gap-2">
              <TrendingUp size={13} style={{ color: "var(--accent)" }} aria-hidden />
              Leading indicators — likely to generate NCs this horizon
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RankedPanel
                title="Production lines"
                desc={`Ranked by predicted NC volume · ${horizon}`}
                subjectLabel="production line"
                items={lines}
                isLoading={linesQuery.isLoading}
                isError={linesQuery.isError}
                {...(linesQuery.error instanceof Error ? { errorMessage: linesQuery.error.message } : {})}
                onRetry={() => void linesQuery.refetch()}
                openRoute={() => "/spc"}
              />
              <RankedPanel
                title="Suppliers"
                desc={`Ranked by predicted NC volume · ${horizon}`}
                subjectLabel="supplier"
                items={suppliers}
                isLoading={suppliersQuery.isLoading}
                isError={suppliersQuery.isError}
                {...(suppliersQuery.error instanceof Error ? { errorMessage: suppliersQuery.error.message } : {})}
                onRetry={() => void suppliersQuery.refetch()}
                openRoute={(subjectId) => `/suppliers/${subjectId}`}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
