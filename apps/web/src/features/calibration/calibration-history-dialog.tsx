"use client";

import { useEffect, useState } from "react";
import type { CalibrationEventDto, InstrumentDto } from "@kaenal/types";
import { useCalibrationEvents } from "@/hooks/use-instruments";
import { useCan } from "@/hooks/use-me";
import { Button, Dialog, DialogContent, Skeleton } from "@/components/ui";
import { RaiseNcrAction } from "./raise-ncr-action";
import { CalibrationResultLabel } from "./calibration-result-label";

/**
 * "View full history" (C4 UC — the register/detail "⋯" menu's first item).
 * Design: Board 4 State B. The jsx's own detail-card "last 5" (Board 1) is
 * this same `GET /v1/instruments/:id/calibration-events` route with
 * `limit: 5`; this dialog is the unpaged, cursor-paginated full list.
 */
export function CalibrationHistoryDialog({ instrument, onClose }: { instrument: InstrumentDto; onClose: () => void }): React.ReactElement {
  const canManage = useCan("calibration:manage");
  const [items, setItems] = useState<CalibrationEventDto[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const page = useCalibrationEvents(instrument.id, { limit: 20, ...(cursor !== undefined ? { cursor } : {}) });

  // Effect justified: accumulating "Load more" pages needs to persist earlier
  // pages' rows across a cursor change that swaps `page.data` for a new,
  // single-page response — no pure render-time derivation can recover rows
  // that already scrolled out of the current query's own cache entry.
  useEffect(() => {
    if (page.data === undefined) return;
    setItems((prev) => (cursor === undefined ? page.data.items : [...prev, ...page.data.items]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.data]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`${instrument.code} — full calibration history`} description={instrument.name}>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {page.isPending && items.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">No calibration events recorded yet.</p>
          ) : (
            <table className="k-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>By</th>
                  <th>Result</th>
                  <th>Cert</th>
                  {canManage && <th>NCR</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((ev) => (
                  <tr key={ev.id}>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {ev.performedAt}
                    </td>
                    <td style={{ fontSize: 12 }}>{ev.performedBy}</td>
                    <td style={{ fontSize: 12 }}>
                      <CalibrationResultLabel result={ev.result} />
                    </td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>
                      {ev.certificateFileId !== null ? "Attached" : "—"}
                    </td>
                    {canManage && (
                      <td>
                        <RaiseNcrAction instrumentId={instrument.id} event={ev} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {page.data?.nextCursor != null && (
            <div className="mt-2 flex justify-center">
              <Button variant="ghost" size="sm" loading={page.isFetching} onClick={() => setCursor(page.data?.nextCursor ?? undefined)}>
                Load more ↓
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
