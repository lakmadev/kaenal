"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { MsaStudyDto } from "@kaenal/types";
import { Button, useToast } from "@/components/ui";
import { errorMessage } from "@/lib/api-error";
import { longDate } from "@/lib/format";
import { useCompleteMsaStudy, useRecordMsaMeasurements, useReopenMsaStudy } from "@/hooks/use-msa";

/**
 * Appraiser×part×trial measurement grid (M2 AC2, board `MsaMeasurementGrid.dc.html`).
 * Appraiser-major column groups (`nTrials` trial columns per appraiser) × part
 * rows. A `draft` study is fully editable (including a study reopened from
 * `completed`, which additionally shows the "Reopened for correction" banner);
 * a `completed` study renders read-only with a "Reopen for correction" action.
 */
export function MsaGrid({ study, canManage }: { study: MsaStudyDto; canManage: boolean }): React.ReactElement {
  const toast = useToast();
  const record = useRecordMsaMeasurements();
  const complete = useCompleteMsaStudy();
  const reopen = useReopenMsaStudy();

  const serverValues = valuesFromStudy(study);
  // Local edits are keyed to the lockVersion they were made against — a fresh
  // server value (after a save, a reopen, or another viewer's edit) resets the
  // grid to match, derived during render rather than via an effect (React 19
  // style: this is the "adjust state when a prop changes" pattern, not a side
  // effect — no external system is touched here).
  const [syncedVersion, setSyncedVersion] = useState(study.lockVersion);
  const [values, setValues] = useState(serverValues);
  if (syncedVersion !== study.lockVersion) {
    setSyncedVersion(study.lockVersion);
    setValues(serverValues);
  }

  const readOnly = study.status === "completed" || !canManage;
  const reopened = study.status === "draft" && study.completedAt !== null;
  const required = study.nAppraisers * study.nParts * study.nTrials;
  const cells = cellCoords(study);
  const enteredCount = cells.filter((c) => values[cellKey(c)] !== undefined && values[cellKey(c)] !== "").length;
  const isFull = enteredCount === required;
  const dirty = cells.some((c) => (values[cellKey(c)] ?? "") !== (serverValues[cellKey(c)] ?? ""));

  const pending = record.isPending || complete.isPending || reopen.isPending;

  function setCell(a: number, p: number, t: number, raw: string): void {
    setValues((v) => ({ ...v, [cellKey({ a, p, t })]: raw }));
  }

  function buildCells(): { appraiser: number; part: number; trial: number; value: number }[] {
    return cells
      .filter((c) => {
        const raw = values[cellKey(c)];
        return raw !== undefined && raw !== "" && !Number.isNaN(Number(raw));
      })
      .map((c) => ({ appraiser: c.a, part: c.p, trial: c.t, value: Number(values[cellKey(c)]) }));
  }

  function save(onSaved?: (lockVersion: number) => void): void {
    record.mutate(
      { id: study.id, body: { lockVersion: study.lockVersion, cells: buildCells() } },
      {
        onSuccess: (updated) => onSaved?.(updated.lockVersion),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  function saveOnly(): void {
    save();
  }

  function saveAndComplete(): void {
    save((lockVersion) => {
      complete.mutate(
        { id: study.id, body: { status: "completed", lockVersion } },
        {
          onSuccess: () => toast.success(`${study.code} completed.`),
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
    });
  }

  function discardChanges(): void {
    setValues(serverValues);
  }

  function doReopen(): void {
    reopen.mutate(
      { id: study.id, body: { lockVersion: study.lockVersion } },
      {
        onSuccess: () => toast.success(`${study.code} reopened for correction.`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reopened && (
        <div
          className="flex items-start gap-2.5 rounded-md p-3 text-[12.5px]"
          style={{ border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#92400e" }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <strong>Reopened for correction</strong> — last completed on {longDate(study.completedAt)}. Edit the grid
            below and save to re-complete.
          </div>
        </div>
      )}

      {study.status === "completed" && (
        <div className="flex items-center justify-between rounded-md border border-border bg-bg-subtle p-3 text-[12.5px]">
          <span className="text-muted">
            Completed on {study.completedAt !== null ? longDate(study.completedAt) : "—"}. Measurements are read-only.
          </span>
          {canManage && (
            <Button variant="ghost" size="sm" onClick={doReopen} disabled={pending}>
              <RotateCcw size={13} aria-hidden /> Reopen for correction
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="k-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Part</th>
              {Array.from({ length: study.nAppraisers }, (_, ai) => (
                <th key={ai} colSpan={study.nTrials} style={{ textAlign: "center" }}>
                  Appraiser {String.fromCharCode(65 + ai)}
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {Array.from({ length: study.nAppraisers }, (_, ai) =>
                Array.from({ length: study.nTrials }, (_, ti) => (
                  <th key={`${ai}-${ti}`} style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
                    Trial {ti + 1}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: study.nParts }, (_, pi) => (
              <tr key={pi}>
                <td className="mono" style={{ fontWeight: 600 }}>
                  Part {pi + 1}
                </td>
                {Array.from({ length: study.nAppraisers }, (_, ai) =>
                  Array.from({ length: study.nTrials }, (_, ti) => {
                    const a = ai + 1;
                    const p = pi + 1;
                    const t = ti + 1;
                    const key = cellKey({ a, p, t });
                    const raw = values[key] ?? "";
                    return (
                      <td key={key} style={{ padding: 2 }}>
                        {readOnly ? (
                          <span className="mono" style={{ display: "block", textAlign: "center", padding: "4px 0" }}>
                            {raw === "" ? "—" : raw}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            className="k-input mono"
                            style={{
                              width: "100%",
                              minWidth: 56,
                              textAlign: "center",
                              borderStyle: raw === "" ? "dashed" : "solid",
                            }}
                            aria-label={`Appraiser ${String.fromCharCode(65 + ai)}, Part ${p}, Trial ${t}`}
                            value={raw}
                            disabled={pending}
                            onChange={(e) => setCell(a, p, t, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted">
            {enteredCount} of {required} entered
          </span>
          <div className="flex items-center gap-2">
            {reopened && (
              <Button variant="ghost" onClick={discardChanges} disabled={pending || !dirty}>
                Discard changes
              </Button>
            )}
            <Button variant="ghost" onClick={saveOnly} disabled={pending || !dirty}>
              Save draft
            </Button>
            <Button
              variant="primary"
              onClick={saveAndComplete}
              disabled={pending || !isFull}
              disabledReason={!isFull ? `Needs ${required - enteredCount} more measurement(s)` : undefined}
              {...(pending ? { loading: true } : {})}
            >
              {reopened ? "Save & re-complete" : "Complete study"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Coord {
  a: number;
  p: number;
  t: number;
}

function cellKey(c: Coord): string {
  return `${c.a}-${c.p}-${c.t}`;
}

function cellCoords(study: MsaStudyDto): Coord[] {
  const out: Coord[] = [];
  for (let a = 1; a <= study.nAppraisers; a++) {
    for (let p = 1; p <= study.nParts; p++) {
      for (let t = 1; t <= study.nTrials; t++) out.push({ a, p, t });
    }
  }
  return out;
}

function valuesFromStudy(study: MsaStudyDto): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of study.measurements) out[cellKey({ a: m.appraiser, p: m.part, t: m.trial })] = String(m.value);
  return out;
}
