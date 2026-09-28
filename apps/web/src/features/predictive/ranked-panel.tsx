"use client";

import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import type { RiskPredictionDto } from "@kaenal/types";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { LeadRow } from "./lead-row";

/**
 * One ranked panel ("Production lines" / "Suppliers", `predictive.jsx`
 * 243-254). Loading/error/empty are driven by props from the page (which owns
 * both queries) so a partially-scored tenant — one kind scored, the other not
 * — can show each panel independently (P3 UC "partial-empty",
 * DESIGN-03B-predictive.md board State B), while a tenant-wide empty result
 * is handled once at the page level (State C) instead of here.
 */
export function RankedPanel({
  title,
  desc,
  subjectLabel,
  items,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  openRoute,
}: {
  title: string;
  desc: string;
  subjectLabel: string;
  items: readonly RiskPredictionDto[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  openRoute: (subjectId: string) => string;
}): React.ReactElement {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-[11.5px] text-muted">{desc}</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px] rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={TrendingUp}
            title="Couldn't load forecasts"
            {...(errorMessage !== undefined ? { body: errorMessage } : {})}
            action={
              <Button variant="primary" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          // Panel-level "not enough history" (DESIGN-03B-predictive.md board
          // State B) — the built `EmptyState` primitive, the same pattern
          // `audit-frequency-chart.tsx` uses inline inside a chart panel. No
          // action: the job runs nightly with no user step to trigger it.
          <EmptyState
            icon={TrendingUp}
            title="Not enough history yet"
            body={`No ${subjectLabel} has enough trailing NC history to forecast for this horizon. Scores appear once the nightly model has at least 4 of the last 6 months of data.`}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((row) => (
              <LeadRow key={row.id} row={row} onOpen={() => router.push(openRoute(row.subjectId))} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
