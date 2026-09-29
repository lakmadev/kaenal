"use client";

import { useState } from "react";
import type { CalibrationEventDto } from "@kaenal/types";
import { useAttachCalibrationCertificate } from "@/hooks/use-instruments";
import { uploadFile } from "@/hooks/use-files";
import { Button, Dialog, DialogClose, DialogContent } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";

/**
 * "Upload cert" as its own step (C2 AC5 — the after-the-fact
 * `PUT .../calibration-events/:eventId/certificate` route), attaching to the
 * instrument's newest calibration event. The jsx's own button
 * (`qms-modules.jsx:301`) names no specific event, so this targets the
 * instrument's own most recent one — the same "newest event" the detail
 * card's banner and KPI already key off.
 */
export function AttachCertificateDialog({
  instrumentId,
  event,
  onClose,
}: {
  instrumentId: string;
  event: CalibrationEventDto;
  onClose: () => void;
}): React.ReactElement {
  const attach = useAttachCalibrationCertificate();
  const [uploading, setUploading] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function onFileChosen(file: File): Promise<void> {
    setErr("");
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, undefined, { entityKind: "calibration_event" });
      setFileId(uploaded.id);
      setFilename(uploaded.filename);
    } catch {
      setErr("Couldn't upload the certificate. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Upload certificate" description={`Attaches to the calibration recorded on ${event.performedAt}`}>
        <div className="flex flex-col gap-3">
          {fileId === null ? (
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center text-[12px] text-muted"
              style={{ borderColor: "var(--border-strong)" }}
            >
              {uploading ? "Uploading…" : "Drop a PDF/image, or click to upload"}
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
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border p-2 text-[12px]">
              <span>📄</span>
              <span className="flex-1">{filename}</span>
              <span className="k-chip" style={{ background: "var(--warning-100)", color: "var(--warning-700)" }}>
                Scanning…
              </span>
            </div>
          )}
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
              variant="primary"
              disabled={fileId === null}
              loading={attach.isPending}
              onClick={() =>
                attach.mutate(
                  { instrumentId, eventId: event.id, body: { fileId: fileId as string } },
                  {
                    onSuccess: () => onClose(),
                    onError: (e) => setErr(apiErrorInfo(e)?.message ?? "Couldn't attach the certificate."),
                  },
                )
              }
            >
              Attach certificate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
