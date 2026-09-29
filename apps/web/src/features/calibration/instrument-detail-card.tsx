"use client";

import { useState } from "react";
import { AlertTriangle, Check, Upload } from "lucide-react";
import type { InstrumentDto } from "@kaenal/types";
import { useCalibrationEvents } from "@/hooks/use-instruments";
import { useCan } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { longDate, daysUntil } from "@/lib/format";
import { INSTRUMENT_TYPE_LABEL } from "./instrument-type";
import { CalibrationResultLabel } from "./calibration-result-label";
import { InstrumentOptionsMenu } from "./instrument-options-menu";
import { RecordCalibrationDialog } from "./record-calibration-dialog";
import { AttachCertificateDialog } from "./attach-certificate-dialog";
import { RaiseNcrAction } from "./raise-ncr-action";

function KvField({ k, v }: { k: string; v: React.ReactNode }): React.ReactElement {
  return (
    <div className="rounded p-2" style={{ background: "var(--bg-subtle)" }}>
      <div className="text-[10px] font-semibold uppercase text-muted">{k}</div>
      <div className="text-[12.5px] font-medium">{v}</div>
    </div>
  );
}

/** The overdue/failed banner (C1 UC "Overdue" / "Failed calibration", B3;
 *  Board 1 State B/C). Corrected copy (§3.1 item 5 / Q-C1) replaces the jsx's
 *  false "blocked at inspection sign-off" claim, which no Inspections jsx
 *  shows a mechanism for. A `fail` result gets a distinct SOLID fill,
 *  regardless of `nextDue` — it may not even be date-overdue yet. */
function DueBanner({ instrument, areaLabel }: { instrument: InstrumentDto; areaLabel: string }): React.ReactElement | null {
  if (instrument.dueStatus !== "overdue") return null;

  if (instrument.lastResult === "fail") {
    return (
      <div className="mb-2.5 flex gap-2.5 rounded-md p-3" style={{ background: "var(--danger-600)" }}>
        <AlertTriangle size={16} color="#fff" aria-hidden />
        <div className="text-[12px]" style={{ color: "#fff" }}>
          <strong>
            Failed its last calibration
            {instrument.lastCalibrated !== null ? ` on ${longDate(instrument.lastCalibrated)}` : ""} — out of
            service until recalibrated.
          </strong>
          <div className="mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
            Its computed next-due date does not apply while the newest result is a fail — do not use for
            measurement.
          </div>
        </div>
      </div>
    );
  }

  const days = daysUntil(instrument.nextDue);
  return (
    <div
      className="mb-2.5 flex gap-2.5 rounded-md p-3"
      style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}
    >
      <AlertTriangle size={16} style={{ color: "var(--danger-600)" }} aria-hidden />
      <div className="text-[12px]" style={{ color: "var(--danger-700)" }}>
        <strong>Out of calibration — overdue {days !== null ? Math.abs(days) : ""} days.</strong>
        <div className="mt-1" style={{ color: "#7f1d1d" }}>
          Review any inspections that may have used this instrument since it was last in calibration
          {instrument.lastCalibrated !== null ? ` (${longDate(instrument.lastCalibrated)})` : ""}
          {areaLabel !== "" ? ` at ${areaLabel}` : ""}.
        </div>
      </div>
    </div>
  );
}

export function InstrumentDetailCard({
  instrument,
  loading,
  canManage,
  areaLabel,
}: {
  instrument: InstrumentDto | null;
  loading: boolean;
  canManage: boolean;
  areaLabel: string;
}): React.ReactElement {
  const canView = useCan("calibration:view");
  const members = useMemberLookup();
  const [recording, setRecording] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const history = useCalibrationEvents(instrument?.id ?? null, { limit: 5 });
  const newestEvent = history.data?.items[0] ?? null;

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (instrument === null) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-[12px] text-muted">Select an instrument to see its detail.</p>
        </CardContent>
      </Card>
    );
  }

  const retired = instrument.status === "retired";

  return (
    <Card data-testid="instrument-detail-card">
      <CardHeader>
        <div className="flex w-full items-start justify-between">
          <div>
            <CardTitle>{instrument.code}</CardTitle>
            <p className="mt-0.5 text-[11.5px] text-muted">{instrument.name}</p>
          </div>
          {retired && (
            <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
              Retired
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DueBanner instrument={instrument} areaLabel={areaLabel} />

        <div className="grid grid-cols-2 gap-2">
          <KvField k="Type" v={INSTRUMENT_TYPE_LABEL[instrument.type]} />
          <KvField k="Area" v={areaLabel !== "" ? areaLabel : "—"} />
          <KvField k="Method" v={instrument.method} />
          <KvField k="Tolerance" v={instrument.tolerance} />
          <KvField k="Last calibrated" v={instrument.lastCalibrated !== null ? longDate(instrument.lastCalibrated) : "Never"} />
          <KvField k="Next due" v={instrument.nextDue !== null ? longDate(instrument.nextDue) : "Unscheduled"} />
          <KvField k="Owner" v={members.nameOf(instrument.owner)} />
          <KvField k="Status" v={instrument.status === "active" ? "Active" : "Retired"} />
        </div>

        <div className="k-overline mt-2.5">History (last 5)</div>
        {history.isPending ? (
          <Skeleton className="mt-1 h-24 w-full" />
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <p className="py-3 text-center text-[11.5px] text-muted">No calibration events recorded yet.</p>
        ) : (
          <table style={{ width: "100%", fontSize: 11.5, marginTop: 4 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "5px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Date</th>
                <th style={{ textAlign: "left", padding: "5px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>By</th>
                <th style={{ textAlign: "left", padding: "5px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Result</th>
                <th style={{ textAlign: "left", padding: "5px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Cert</th>
                {canManage && <th style={{ textAlign: "left", padding: "5px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>NCR</th>}
              </tr>
            </thead>
            <tbody>
              {(history.data?.items ?? []).map((ev) => (
                <tr key={ev.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="mono" style={{ padding: "6px 0" }}>
                    {ev.performedAt}
                  </td>
                  <td style={{ padding: "6px 0" }}>{ev.performedBy}</td>
                  <td style={{ padding: "6px 0" }}>
                    <CalibrationResultLabel result={ev.result} />
                  </td>
                  <td className="mono" style={{ padding: "6px 0", color: "var(--accent)" }}>
                    {ev.certificateFileId !== null ? "Attached" : "—"}
                  </td>
                  {canManage && (
                    <td style={{ padding: "6px 0" }}>
                      <RaiseNcrAction instrumentId={instrument.id} event={ev} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canManage && !retired && (
          <div className="mt-2 flex gap-1.5">
            <Button variant="primary" size="sm" onClick={() => setRecording(true)}>
              <Check size={12} aria-hidden /> Record calibration
            </Button>
            <Button variant="ghost" size="sm" disabled={newestEvent === null} onClick={() => setAttaching(true)}>
              <Upload size={12} aria-hidden /> Upload cert
            </Button>
            <div className="ml-auto">
              <InstrumentOptionsMenu instrument={instrument} canManage={canManage} />
            </div>
          </div>
        )}
        {(!canManage || retired) && canView && (
          <div className="mt-2 flex gap-1.5">
            <InstrumentOptionsMenu instrument={instrument} canManage={canManage} />
          </div>
        )}

        {retired && <p className="mt-2 text-[11px] italic text-muted">Retired instruments cannot be edited or have new calibration events recorded.</p>}
      </CardContent>

      {recording && <RecordCalibrationDialog instrument={instrument} onClose={() => setRecording(false)} />}
      {attaching && newestEvent !== null && (
        <AttachCertificateDialog instrumentId={instrument.id} event={newestEvent} onClose={() => setAttaching(false)} />
      )}
    </Card>
  );
}
