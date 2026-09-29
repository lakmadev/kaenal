"use client";

import { useState } from "react";
import Link from "next/link";
import type { CalibrationEventDto } from "@kaenal/types";
import { useRaiseNcrFromCalibrationEvent } from "@/hooks/use-instruments";
import { Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";

/**
 * "Raise NCR" (C3 — the KPI's own "N led to NCR" sub-stat names a real
 * capability the mock never shows a button for). Design: Board 1 State B.
 * `result = 'pass'` is never eligible (no button, no dash — nothing to raise
 * from); an `adjusted`/`fail` event with no `ncrId` yet gets the button; once
 * `ncrId` is set the button is permanently replaced by a real link — one-time,
 * server-guarded (409), never re-shown.
 */
export function RaiseNcrAction({ instrumentId, event }: { instrumentId: string; event: CalibrationEventDto }): React.ReactElement {
  const toast = useToast();
  const raise = useRaiseNcrFromCalibrationEvent();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");

  if (event.ncrId !== null) {
    return (
      <Link href={`/ncrs/${event.ncrId}`} className="mono text-[11px] underline" style={{ color: "var(--accent)" }}>
        → View NCR
      </Link>
    );
  }

  if (event.result === "pass") {
    return <span className="text-[11px] text-subtle">— (pass, not eligible)</span>;
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Raise NCR
      </Button>
      {confirming && (
        <Dialog open onOpenChange={(o) => !o && setConfirming(false)}>
          <DialogContent title="Raise an NCR?">
            <div className="flex flex-col gap-3">
              <p className="text-[12px] leading-relaxed text-muted">
                Raise an NCR for this out-of-tolerance finding on {event.performedAt}? This creates a new NCR
                (source: calibration) and links it to this event. This can&apos;t be undone.
              </p>
              {err !== "" && (
                <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
                  {err}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  loading={raise.isPending}
                  onClick={() =>
                    raise.mutate(
                      { instrumentId, eventId: event.id },
                      {
                        onSuccess: (ncr) => {
                          toast.success(`NCR ${ncr.code} raised`);
                          setConfirming(false);
                        },
                        onError: (e) => setErr(apiErrorInfo(e)?.message ?? "Couldn't raise the NCR."),
                      },
                    )
                  }
                >
                  Raise NCR
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
