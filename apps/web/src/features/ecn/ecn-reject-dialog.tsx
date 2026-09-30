"use client";

import { useState } from "react";
import { Dialog, DialogContent, Button } from "@/components/ui";

/**
 * The reject confirm dialog (DESIGN-06 §4.5 State C / §4.6 — a comment is
 * required and the exact, irreversible consequence is named before the
 * write, mirroring `document-detail.tsx`'s own `RejectDialog` pattern).
 * Shared by the Kanban board's reject-drop/reject-button and the detail
 * page's per-gate Reject action.
 */
export function EcnRejectDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment: string) => void;
  loading: boolean;
}): React.ReactElement {
  const [comment, setComment] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setComment("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Reject this stage"
        description="The ECN moves to Rejected and every future gate resets. A reason is required and recorded on the audit trail — it can be resubmitted back to Draft afterward."
      >
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-semibold" htmlFor="ecn-reject-comment">
            Reason <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            id="ecn-reject-comment"
            className="k-input"
            style={{ height: "auto", padding: 10, resize: "vertical", fontFamily: "inherit" }}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What needs to change before this can be approved?"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" loading={loading} disabled={comment.trim() === ""} onClick={() => onConfirm(comment.trim())}>
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
