"use client";

import { useState } from "react";
import { RISK_CATEGORY_OPTIONS, RISK_TREATMENT_OPTIONS } from "@kaenal/core";
import type { RiskDto, RiskRegisterStatus, RiskTrend } from "@kaenal/types";
import { useUpdateRisk } from "@/hooks/use-risks";
import { useMemberLookup } from "@/hooks/use-members";
import { Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";

const TREND_OPTIONS: { id: RiskTrend; label: string }[] = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
  { id: "flat", label: "Flat" },
];

const STATUS_OPTIONS: { id: RiskRegisterStatus; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "monitoring", label: "Monitoring" },
  { id: "accepted", label: "Accepted" },
];

/**
 * R1 — Edit and Re-score both open THIS same edit surface (not a separate
 * backend concept): every field from `UpdateRiskBody` re-sent, optimistic via
 * `lockVersion`. `focusScore` (Re-score) autofocuses the likelihood field
 * rather than opening a different form. On a 409 the mutation's `{id, ...}`
 * shape lets the global stale-write reconcile dialog open automatically.
 */
export function RiskEditDialog({
  risk,
  focusScore,
  onClose,
}: {
  risk: RiskDto;
  focusScore: boolean;
  onClose: () => void;
}): React.ReactElement {
  const toast = useToast();
  const update = useUpdateRisk();
  const members = useMemberLookup();
  const [category, setCategory] = useState(risk.category);
  const [title, setTitle] = useState(risk.title);
  const [owner, setOwner] = useState(risk.owner);
  const [likelihood, setLikelihood] = useState(risk.likelihood);
  const [impact, setImpact] = useState(risk.impact);
  const [residualScore, setResidualScore] = useState(risk.residualScore);
  const [trend, setTrend] = useState<RiskTrend>(risk.trend);
  const [treatment, setTreatment] = useState(risk.treatment);
  const [status, setStatus] = useState<RiskRegisterStatus>(risk.status);
  const [plan, setPlan] = useState(risk.plan);
  const [reviewDue, setReviewDue] = useState(risk.reviewDue ?? "");
  const [err, setErr] = useState("");

  function save(): void {
    if (title.trim() === "") {
      setErr("Enter a title.");
      return;
    }
    setErr("");
    update.mutate(
      {
        id: risk.id,
        body: {
          category,
          title: title.trim(),
          owner,
          likelihood,
          impact,
          residualScore,
          trend,
          treatment,
          status,
          plan,
          reviewDue: reviewDue === "" ? null : reviewDue,
          lockVersion: risk.lockVersion,
        },
      },
      {
        onSuccess: () => {
          toast.success("Risk updated");
          onClose();
        },
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status === 409) {
            // The global reconcile dialog takes over; just close this one.
            onClose();
          } else {
            setErr(info?.message ?? "Couldn't save the risk.");
          }
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={focusScore ? "Re-score risk" : "Edit risk"}
        description={focusScore ? "Update likelihood, impact and the residual score." : "Update this risk's details."}
      >
        <div className="flex flex-col gap-2.5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <label className="flex flex-col gap-1">
            <span className="k-overline">Category</span>
            <select className="k-input" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {RISK_CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Title</span>
            <input className="k-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Owner</span>
            <select className="k-input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {members.byId.has(owner) ? null : <option value={owner}>{members.nameOf(owner)}</option>}
              {[...members.byId.values()].map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="k-overline">Likelihood</span>
              <select
                className="k-input"
                autoFocus={focusScore}
                value={likelihood}
                onChange={(e) => setLikelihood(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="k-overline">Impact</span>
              <select className="k-input" value={impact} onChange={(e) => setImpact(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Residual score (1-25)</span>
            <input
              type="number"
              className="k-input"
              min={1}
              max={25}
              value={residualScore}
              onChange={(e) => setResidualScore(Math.min(25, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="k-overline">Trend</span>
              <select className="k-input" value={trend} onChange={(e) => setTrend(e.target.value as RiskTrend)}>
                {TREND_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="k-overline">Status</span>
              <select className="k-input" value={status} onChange={(e) => setStatus(e.target.value as RiskRegisterStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Treatment</span>
            <select className="k-input" value={treatment} onChange={(e) => setTreatment(e.target.value as typeof treatment)}>
              {RISK_TREATMENT_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Treatment plan</span>
            <textarea className="k-input" style={{ height: "auto", padding: 10 }} rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Review due</span>
            <input type="date" className="k-input" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} />
          </label>

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
