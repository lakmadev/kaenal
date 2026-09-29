"use client";

import { useState } from "react";
import type { CalibrationResult, InstrumentDto } from "@kaenal/types";
import { useRecordCalibrationEvent } from "@/hooks/use-instruments";
import { uploadFile } from "@/hooks/use-files";
import { Button, Dialog, DialogClose, DialogContent, Segmented } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";

const RESULT_OPTIONS: { value: CalibrationResult; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "adjusted", label: "Adjusted" },
  { value: "fail", label: "Fail" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Record calibration" (C2; `qms-modules.jsx:300-301`'s buttons, `kToast`
 * only in the prototype). Design: Board 2, `CalibrationRecordDialog.dc.html`
 * — result picker / performed-at / performed-by / notes / inline certificate
 * upload. `performedAt` in the future is rejected client-side (a coarse
 * guard; the server re-checks against the instrument's own plant timezone,
 * C2 AC7). The certificate presigns with `entityKind: "calibration_event"`
 * and `entityId` omitted (no event row exists yet) — B7/AMENDED-3 sequencing
 * — then links via `certificateFileId` in this same create call.
 */
export function RecordCalibrationDialog({ instrument, onClose }: { instrument: InstrumentDto; onClose: () => void }): React.ReactElement {
  const record = useRecordCalibrationEvent();

  const [result, setResult] = useState<CalibrationResult>("pass");
  const [performedAt, setPerformedAt] = useState(today());
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [certificateFileId, setCertificateFileId] = useState<string | null>(null);
  const [certFilename, setCertFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function onFileChosen(file: File): Promise<void> {
    setErr("");
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, undefined, { entityKind: "calibration_event" });
      setCertificateFileId(uploaded.id);
      setCertFilename(uploaded.filename);
    } catch {
      setErr("Couldn't upload the certificate. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function save(): void {
    if (performedBy.trim() === "") {
      setErr("Performed-by is required — external lab name or the technician who performed the check.");
      return;
    }
    if (performedAt > today()) {
      setErr("Performed-at can't be in the future.");
      return;
    }
    setErr("");
    record.mutate(
      {
        instrumentId: instrument.id,
        body: {
          performedAt,
          result,
          performedBy: performedBy.trim(),
          notes: notes.trim(),
          certificateFileId,
          lockVersion: instrument.lockVersion,
        },
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status === 409) {
            onClose(); // global reconcile dialog takes over
          } else {
            setErr(info?.message ?? "Couldn't record the calibration.");
          }
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Record calibration" description={`${instrument.code} · ${instrument.name}`}>
        <div className="flex flex-col gap-3">
          <div>
            <span className="k-overline mb-1 block">Result *</span>
            <Segmented options={RESULT_OPTIONS} value={result} onChange={setResult} ariaLabel="Calibration result" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="k-overline">Performed at *</span>
              <input type="date" className="k-input" max={today()} value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="k-overline">Performed by *</span>
              <input
                className="k-input"
                placeholder="e.g. A2LA Cal Labs, or a member name"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Notes</span>
            <textarea className="k-input" style={{ height: "auto", padding: 10 }} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="flex flex-col gap-1">
            <span className="k-overline">Certificate (optional)</span>
            {certificateFileId !== null ? (
              <div className="flex items-center gap-2 rounded-md border border-border p-2 text-[12px]">
                <span>📄</span>
                <span className="flex-1">{certFilename}</span>
                <span className="k-chip" style={{ background: "var(--warning-100)", color: "var(--warning-700)" }}>
                  Scanning…
                </span>
              </div>
            ) : (
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-3 text-center text-[12px] text-muted"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {uploading ? "Uploading…" : "Drop a PDF/image, or click to upload — attaches to this event"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  accept="application/pdf,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFileChosen(file);
                  }}
                />
              </label>
            )}
          </div>

          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={record.isPending} disabled={uploading} onClick={save}>
              ✓ Record calibration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
