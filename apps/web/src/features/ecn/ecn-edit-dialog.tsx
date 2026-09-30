"use client";

import { useState } from "react";
import type { EcnDto } from "@kaenal/types";
import { useUpdateEcn } from "@/hooks/use-ecn";
import { useMemberLookup } from "@/hooks/use-members";
import { Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";
import { CHANGE_TYPE_LABEL } from "./ecn-bits";

const CHANGE_RISK_OPTIONS: readonly EcnDto["changeRisk"][] = ["low", "medium", "high"];
const CHANGE_TYPE_OPTIONS: readonly EcnDto["changeType"][] = ["design", "process", "tooling", "material"];

/**
 * The ECN detail's Edit action (DESIGN-06 §7 Q-D1 — no drawn shape beyond
 * "PATCH exists"; smallest reasonable call, mirroring `RiskEditDialog`'s own
 * shape). `title`/`description`/`effectiveDate` are always editable;
 * `changeType`/`changeRisk`/`owner` only while `stage = 'draft'` (E1 AC3) —
 * those three fields render read-only once the pipeline has started.
 */
export function EcnEditDialog({ ecn, onClose }: { ecn: EcnDto; onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const update = useUpdateEcn();
  const members = useMemberLookup();
  const isDraft = ecn.stage === "draft";

  const [title, setTitle] = useState(ecn.title);
  const [description, setDescription] = useState(ecn.description);
  const [effectiveDate, setEffectiveDate] = useState(ecn.effectiveDate ?? "");
  const [changeType, setChangeType] = useState(ecn.changeType);
  const [changeRisk, setChangeRisk] = useState(ecn.changeRisk);
  const [owner, setOwner] = useState(ecn.owner);
  const [err, setErr] = useState("");

  function save(): void {
    if (title.trim() === "") {
      setErr("Enter a title.");
      return;
    }
    setErr("");
    update.mutate(
      {
        id: ecn.id,
        body: {
          title: title.trim(),
          description,
          effectiveDate: effectiveDate === "" ? null : effectiveDate,
          ...(isDraft ? { changeType, changeRisk, owner } : {}),
          lockVersion: ecn.lockVersion,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${ecn.code} updated`);
          onClose();
        },
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status === 409) onClose();
          else setErr(info?.message ?? "Couldn't save the ECN.");
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Edit ECN" description="Update this engineering change notice's details.">
        <div className="flex flex-col gap-2.5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <label className="flex flex-col gap-1">
            <span className="k-overline">Title</span>
            <input className="k-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Description</span>
            <textarea
              className="k-input"
              style={{ height: "auto", padding: 10 }}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Effective date</span>
            <input type="date" className="k-input" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="k-overline">Change type{!isDraft && " (frozen)"}</span>
              <select
                className="k-input"
                disabled={!isDraft}
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as typeof changeType)}
              >
                {CHANGE_TYPE_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CHANGE_TYPE_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="k-overline">Change risk{!isDraft && " (frozen)"}</span>
              <select
                className="k-input"
                disabled={!isDraft}
                value={changeRisk}
                onChange={(e) => setChangeRisk(e.target.value as typeof changeRisk)}
              >
                {CHANGE_RISK_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Owner{!isDraft && " (frozen)"}</span>
            <select className="k-input" disabled={!isDraft} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {members.byId.has(owner) ? null : <option value={owner}>{members.nameOf(owner)}</option>}
              {[...members.byId.values()].map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          {!isDraft && (
            <p className="text-[11.5px] text-muted">
              Change type, change risk, and owner are frozen once the approval pipeline has started — only while the ECN is
              back in Draft (via resubmission) can they change again.
            </p>
          )}

          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={update.isPending} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
