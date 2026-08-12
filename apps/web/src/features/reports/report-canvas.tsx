"use client";

import type { ReportTile } from "@kaenal/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { TileWidget } from "./bound-widgets";

/**
 * Renders a report definition's tiles through the query engine — the same render
 * a built-in dashboard and a saved report share (B3). Tile `layout.w` is a
 * 24-column unit from the builder; here it maps onto a 12-column responsive grid.
 */

function span(w: number | undefined): number {
  if (w === undefined) return 6;
  return Math.min(12, Math.max(3, Math.round(w / 2)));
}

function minHeight(viz: string, h: number | undefined): number {
  if (viz === "kpi") return 84;
  if (h === undefined) return 200;
  return Math.max(120, h * 22);
}

export function ReportCanvas({ tiles }: { tiles: readonly ReportTile[] }): React.ReactElement {
  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] py-16 text-center text-sm text-[var(--text-muted)]">
        This report has no tiles yet.
      </div>
    );
  }
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
      {tiles.map((t) => (
        <Card key={t.id} className="flex flex-col" style={{ gridColumn: `span ${span(t.layout?.w)} / span ${span(t.layout?.w)}` }}>
          <CardHeader>
            <CardTitle>{t.title === "" ? "Untitled" : t.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col" style={{ minHeight: minHeight(t.viz, t.layout?.h) }}>
            <TileWidget viz={t.viz} query={t.query} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
