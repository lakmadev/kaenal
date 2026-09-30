"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { ComplaintChannel, ComplaintDto, ComplaintSeverity } from "@kaenal/types";
import { useCreateComplaint, useUpdateComplaint } from "@/hooks/use-complaints";
import { uploadFile } from "@/hooks/use-files";
import { Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";

const CHANNEL_OPTIONS: { id: ComplaintChannel; label: string }[] = [
  { id: "portal", label: "Customer portal" },
  { id: "email_parsed", label: "Email parsed" },
  { id: "web_form", label: "Web form" },
  { id: "edi", label: "EDI" },
  { id: "phone", label: "Phone (logged)" },
];

const SEVERITY_OPTIONS: { id: ComplaintSeverity; label: string }[] = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

interface PendingAttachment {
  fileId: string;
  name: string;
}

/**
 * `IntakeForm` (C2; `qms-modules.jsx:477-523`, read in full) — the fully
 * drawn intake dialog, plus the two fields the drawn dialog is missing that
 * the list/filters/P18 require (`Contact`/`Channel`, §1a gap), inserted as a
 * new row directly under Customer (DESIGN-06 §4.2, `ComplaintIntakeCorrected.
 * dc.html`, Q-D3). Attachments: presign with `entityKind: "complaint"` and no
 * `entityId` (none exists yet), linked via `attachmentFileIds` once the
 * complaint is created (C2 UC, mirrors Sprint 05's training-evidence pattern).
 *
 * Also serves as the Edit surface (Q-D2 — no separate design exists): pass
 * `complaint` to pre-fill and PATCH instead of create. Edit never shows the
 * attachment drop zone (S5 — attachments are creation-only) and adds the one
 * extra field PATCH allows beyond intake, `cost`, since real cost is rarely
 * known at the moment a complaint is logged.
 */
export function IntakeFormDialog({ complaint, onClose, onSaved }: { complaint?: ComplaintDto; onClose: () => void; onSaved?: (c: ComplaintDto) => void }): React.ReactElement {
  const toast = useToast();
  const create = useCreateComplaint();
  const update = useUpdateComplaint();
  const isEdit = complaint !== undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customer, setCustomer] = useState(complaint?.customer ?? "");
  const [contact, setContact] = useState(complaint?.contact ?? "");
  const [channel, setChannel] = useState<ComplaintChannel>(complaint?.channel ?? "web_form");
  const [severity, setSeverity] = useState<ComplaintSeverity>(complaint?.severity ?? "high");
  const [batchRef, setBatchRef] = useState(complaint?.batchRef ?? "");
  const [subject, setSubject] = useState(complaint?.subject ?? "");
  const [description, setDescription] = useState(complaint?.description ?? "");
  const [costUsd, setCostUsd] = useState(complaint?.costUsd !== undefined && complaint?.costUsd !== null ? String(complaint.costUsd) : "");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const busy = create.isPending || update.isPending;

  async function pickFiles(files: FileList): Promise<void> {
    setUploading(true);
    setErr("");
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFile(file, undefined, { entityKind: "complaint" });
        setAttachments((prev) => [...prev, { fileId: uploaded.id, name: file.name }]);
      }
    } catch {
      setErr("Couldn't upload one or more attachments. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(fileId: string): void {
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }

  function save(): void {
    if (customer.trim() === "") {
      setErr("Enter a customer.");
      return;
    }
    if (contact.trim() === "") {
      setErr("Enter a contact.");
      return;
    }
    if (subject.trim() === "") {
      setErr("Enter a subject.");
      return;
    }
    setErr("");

    if (isEdit && complaint !== undefined) {
      update.mutate(
        {
          id: complaint.id,
          body: {
            customer: customer.trim(),
            contact: contact.trim(),
            channel,
            severity,
            subject: subject.trim(),
            description: description.trim(),
            batchRef: batchRef.trim() === "" ? null : batchRef.trim(),
            costUsd: costUsd.trim() === "" ? null : Number(costUsd),
            lockVersion: complaint.lockVersion,
          },
        },
        {
          onSuccess: (c) => {
            toast.success("Complaint updated");
            onSaved?.(c);
            onClose();
          },
          onError: (e) => {
            const info = apiErrorInfo(e);
            if (info?.status === 409) onClose();
            else setErr(info?.message ?? "Couldn't save the complaint.");
          },
        },
      );
      return;
    }

    create.mutate(
      {
        body: {
          customer: customer.trim(),
          contact: contact.trim(),
          channel,
          severity,
          subject: subject.trim(),
          description: description.trim(),
          batchRef: batchRef.trim() === "" ? null : batchRef.trim(),
          attachmentFileIds: attachments.length > 0 ? attachments.map((a) => a.fileId) : undefined,
        },
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: (c) => {
          toast.success(`Logged ${c.code}`);
          onSaved?.(c);
          onClose();
        },
        onError: (e) => setErr(apiErrorInfo(e)?.message ?? "Couldn't log the complaint."),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[560px]"
        title={isEdit ? "Edit complaint" : "Log a customer complaint"}
        description={isEdit ? "Update this complaint's details." : "Auto-routes by severity. Acknowledgment sent to customer immediately."}
      >
        <div className="grid grid-cols-2 gap-2.5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="k-overline">Customer</span>
            <input className="k-input" placeholder="e.g. AB Volvo Group" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Contact</span>
            <input className="k-input" placeholder="e.g. Magnus Eriksson · Quality Manager" value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="k-overline">Channel</span>
            <select className="k-input" value={channel} onChange={(e) => setChannel(e.target.value as ComplaintChannel)}>
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Severity</span>
            <select className="k-input" value={severity} onChange={(e) => setSeverity(e.target.value as ComplaintSeverity)}>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="k-overline">Batch / serial</span>
            <input className="k-input" placeholder="PA-VLV-3041" value={batchRef} onChange={(e) => setBatchRef(e.target.value)} />
          </label>

          <label className="col-span-2 flex flex-col gap-1">
            <span className="k-overline">Subject</span>
            <input className="k-input" placeholder="Brief description" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="col-span-2 flex flex-col gap-1">
            <span className="k-overline">Detail</span>
            <textarea className="k-input" rows={4} style={{ height: 90, padding: 10 }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          {isEdit && (
            <label className="col-span-2 flex flex-col gap-1">
              <span className="k-overline">Cost (USD, optional)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="k-input"
                placeholder="e.g. 4280.00"
                value={costUsd}
                onChange={(e) => setCostUsd(e.target.value)}
              />
            </label>
          )}

          {!isEdit && (
            <div className="col-span-2 flex flex-col gap-1">
              <span className="k-overline">Attachments</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files !== null && e.target.files.length > 0) void pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border-2 border-dashed px-3.5 py-3.5 text-center text-[12px] text-muted"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {uploading ? "Uploading…" : "Drop photos, customer emails, or 8D PDF · or click to upload"}
              </button>
              {attachments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {attachments.map((a) => (
                    <span key={a.fileId} className="k-chip" style={{ background: "var(--bg-subtle)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {a.name}
                      <button type="button" aria-label={`Remove ${a.name}`} onClick={() => removeAttachment(a.fileId)}>
                        <X size={10} aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {err !== "" && (
            <div className="col-span-2 text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}

          <div className="col-span-2 mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={busy} onClick={save}>
              <Check size={12} aria-hidden /> {isEdit ? "Save changes" : "Log complaint"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
