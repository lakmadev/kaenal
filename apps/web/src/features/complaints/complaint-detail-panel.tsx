"use client";

import { useState } from "react";
import { Download, FileText, Pencil } from "lucide-react";
import type { ComplaintDto } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { useAcknowledgeComplaint, useCloseComplaint, useComplaint } from "@/hooks/use-complaints";
import { useDownloadFile, useEntityFiles } from "@/hooks/use-files";
import { Button, Dialog, DialogClose, DialogContent, EmptyState, Skeleton, useToast } from "@/components/ui";
import { SlaIndicator } from "@/features/ncrs/ncr-bits";
import { apiErrorInfo } from "@/lib/api-error";
import { relativeTime } from "@/lib/format";
import { ConvertTargetPicker, LinkedRecordLink } from "./convert-target-picker";
import { IntakeFormDialog } from "./intake-form-dialog";

const CHANNEL_LABEL: Record<string, string> = {
  portal: "Customer portal",
  email_parsed: "Email parsed",
  web_form: "Web form",
  edi: "EDI",
  phone: "Phone (logged)",
};

const SEVERITY_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const STATUS_LABEL: Record<string, string> = { triage: "Triage", investigation: "Investigation", "8d": "8D", capa: "CAPA", closed: "Closed" };

/**
 * C3 — the complaint detail panel. No jsx board exists (the mock's list rows
 * are clickable but wired to nothing, §1a); DESIGN-06 §4.1 `Main.dc.html`
 * draws the new board reusing the `KvField` detail-card pattern (Calibration/
 * Risk precedent). Opened as a modal from the register's row click, matching
 * this sprint's own reuse of the modal-detail idiom for a genuinely new board.
 */
export function ComplaintDetailPanel({ id, onClose }: { id: string; onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const detail = useComplaint(id);
  const canManage = useCan("complaint:manage");
  const acknowledge = useAcknowledgeComplaint();
  const members = useMemberLookup();
  const files = useEntityFiles("complaint", id);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState("");

  function doAcknowledge(complaint: ComplaintDto): void {
    setErr("");
    acknowledge.mutate(
      { id: complaint.id, body: { lockVersion: complaint.lockVersion } },
      {
        onSuccess: () => toast.success("Acknowledged"),
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status !== 409) setErr(info?.message ?? "Couldn't acknowledge the complaint.");
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[640px]"
        title={detail.data !== undefined ? detail.data.code : "Complaint"}
        {...(detail.data?.subject !== undefined ? { description: detail.data.subject } : {})}
      >
        {detail.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : detail.isError ? (
          <div className="py-6">
            <EmptyState
              title="Couldn't load this complaint"
              body={apiErrorInfo(detail.error)?.message ?? "Something went wrong."}
              action={
                <Button variant="ghost" onClick={() => void detail.refetch()}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : (
          (() => {
            const c = detail.data;
            const isClosed = c.status === "closed";
            return (
              <div className="flex flex-col gap-3.5" style={{ maxHeight: "72vh", overflowY: "auto" }}>
                <div className="grid grid-cols-2 gap-2">
                  <Field k="Customer" v={c.customer} />
                  <Field k="Contact" v={c.contact} />
                  <Field k="Channel" v={CHANNEL_LABEL[c.channel] ?? c.channel} />
                  <Field k="Severity" v={SEVERITY_LABEL[c.severity] ?? c.severity} />
                  <Field k="Status" v={STATUS_LABEL[c.status] ?? c.status} />
                  <Field k="SLA" v={<SlaIndicator state={c.slaState} />} />
                  <Field k="Batch / serial" v={c.batchRef ?? "—"} />
                  <Field k="Owner" v={members.nameOf(c.owner)} />
                  <Field k="Received" v={relativeTime(c.receivedAt)} />
                  <Field k="Acknowledged" v={c.acknowledgedAt !== null ? relativeTime(c.acknowledgedAt) : "—"} />
                  <Field k="Closed" v={c.closedAt !== null ? relativeTime(c.closedAt) : "—"} />
                  <Field k="Cost" v={c.costUsd !== null ? `$${c.costUsd.toLocaleString()}` : "—"} />
                </div>

                <div>
                  <div className="k-overline mb-1">Subject</div>
                  <div className="text-[12.5px]">{c.subject}</div>
                </div>
                <div>
                  <div className="k-overline mb-1">Detail</div>
                  <div className="rounded-md p-2.5 text-[12px] leading-relaxed" style={{ background: "var(--bg-subtle)" }}>
                    {c.description !== "" ? c.description : <span className="text-muted">No detail recorded.</span>}
                  </div>
                </div>

                <div>
                  <div className="k-overline mb-1">Linked record</div>
                  <LinkedRecordLink complaint={c} />
                  {c.ncrId === null && c.eightDId === null && c.capaId === null && <span className="text-[12px] text-muted">Not linked to NCR, 8D or CAPA.</span>}
                </div>

                <div>
                  <div className="k-overline mb-1">
                    Attachments {files.data !== undefined ? `(${files.data.items.length})` : ""}
                  </div>
                  {files.isPending ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (files.data?.items.length ?? 0) === 0 ? (
                    <p className="text-[12px] text-muted">No attachments.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {(files.data?.items ?? []).map((f) => (
                        <div key={f.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                          <FileText size={14} className="text-muted" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[12px]">{f.filename}</span>
                          <DownloadAttachmentButton fileId={f.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {err !== "" && (
                  <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
                    {err}
                  </div>
                )}

                {canManage && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      <Pencil size={12} aria-hidden /> Edit
                    </Button>
                    {!isClosed && c.acknowledgedAt === null && (
                      <Button variant="ghost" size="sm" loading={acknowledge.isPending} onClick={() => doAcknowledge(c)}>
                        Acknowledge
                      </Button>
                    )}
                    {!isClosed && <ConvertTargetPicker complaint={c} />}
                    {!isClosed && (
                      <Button variant="danger" size="sm" onClick={() => setClosing(true)}>
                        Close
                      </Button>
                    )}
                    {isClosed && <span className="text-[12px] text-muted">Closed — record is read-only for status/links.</span>}
                  </div>
                )}

                {editing && <IntakeFormDialog complaint={c} onClose={() => setEditing(false)} />}
                {closing && <CloseConfirmDialog complaint={c} onClose={() => setClosing(false)} />}
              </div>
            );
          })()
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ padding: 8, background: "var(--bg-subtle)", borderRadius: 4 }}>
      <div className="k-overline">{k}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</div>
    </div>
  );
}

function DownloadAttachmentButton({ fileId }: { fileId: string }): React.ReactElement {
  const toast = useToast();
  const download = useDownloadFile();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={download.isPending}
      onClick={() =>
        download.mutate(
          { id: fileId, disposition: "attachment" },
          {
            onSuccess: (r) => window.open(r.url, "_blank", "noopener"),
            onError: (e) => toast.error(apiErrorInfo(e)?.message ?? "Couldn't download the file."),
          },
        )
      }
    >
      <Download size={13} aria-hidden />
    </Button>
  );
}

function CloseConfirmDialog({ complaint, onClose }: { complaint: ComplaintDto; onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const close = useCloseComplaint();
  const [err, setErr] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Close ${complaint.code}?`} description="A complaint can be closed with or without ever converting.">
        <div className="flex flex-col gap-3">
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
              loading={close.isPending}
              onClick={() =>
                close.mutate(
                  { id: complaint.id, body: { lockVersion: complaint.lockVersion } },
                  {
                    onSuccess: () => {
                      toast.success("Complaint closed");
                      onClose();
                    },
                    onError: (e) => {
                      const info = apiErrorInfo(e);
                      if (info?.status === 409) onClose();
                      else setErr(info?.message ?? "Couldn't close the complaint.");
                    },
                  },
                )
              }
            >
              Close complaint
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
