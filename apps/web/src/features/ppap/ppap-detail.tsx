"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TriangleAlert, Sparkles, Check, X, Building2 } from "lucide-react";
import type { PpapElementDto, PpapElementStatus, PpapSubmissionDto } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import { usePpap, useUpdatePpapElement, useDecidePpap } from "@/hooks/use-ppap";
import { PageHeader } from "@/components/page-header";
import { Button, Card, EmptyState, Skeleton, useToast } from "@/components/ui";
import { PpapStatusBadge, LevelChip, ElementMarker, ElementStatusBadge, ELEMENT_STYLES } from "./ppap-bits";

const ELEMENT_STATUSES: PpapElementStatus[] = ["pending", "approved", "changes_requested", "n_a"];

export function PpapDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: ppap, isLoading, isError } = usePpap(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || ppap === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/ppap")} />
        <div className="k-surface mt-4">
          <EmptyState
            icon={TriangleAlert}
            title="PPAP submission not found"
            body="It may have been removed, or you may not have access."
          />
        </div>
      </div>
    );
  }

  return <PpapDetailView ppap={ppap} canManage={hasCapability(me, "ppap:manage")} />;
}

function PpapDetailView({ ppap, canManage }: { ppap: PpapSubmissionDto; canManage: boolean }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const decide = useDecidePpap(ppap.id);

  const { completeness } = ppap;
  const done = completeness.required > 0 ? completeness.approved : 0;
  const progress = ppap.elements.length > 0 ? (ppap.elements.filter((e) => e.status === "approved" || e.status === "n_a").length / ppap.elements.length) * 100 : 0;
  const decided = ppap.status === "approved" || ppap.status === "rejected";

  const runDecision = (decision: "approve" | "reject"): void => {
    decide.mutate(
      { decision, version: ppap.lockVersion },
      {
        onSuccess: (updated) => toast.success(decision === "approve" ? `${updated.code ?? "PPAP"} approved` : `${updated.code ?? "PPAP"} rejected`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const pred = ppap.aiPrediction;
  const hasPrediction = pred.willMissDeadline != null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/ppap")} />
      <PageHeader
        title={`${ppap.code ?? "PPAP"} — ${ppap.partNumber}`}
        description={[ppap.programName, ppap.supplierName, `Level ${ppap.level}`, ppap.customer]
          .filter((v): v is string => v !== null && v !== "")
          .join(" · ")}
        actions={
          canManage && !decided ? (
            <>
              <Button onClick={() => runDecision("reject")} loading={decide.isPending}>
                <X size={14} /> Reject
              </Button>
              <Button
                variant="primary"
                disabled={!completeness.approvable || decide.isPending}
                title={completeness.approvable ? undefined : "Every non-N/A element must be approved first"}
                onClick={() => runDecision("approve")}
              >
                <Check size={14} /> Approve PPAP
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Header strip */}
      <Card className="grid items-center gap-4 p-4" style={{ gridTemplateColumns: "1fr auto" }}>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <PpapStatusBadge status={ppap.status} />
            <LevelChip level={ppap.level} />
            <span className="text-[11px] text-muted">
              Submitted {longDate(ppap.submittedDate)} · Due {longDate(ppap.dueDate)}
              {ppap.daysOpen !== null ? ` · ${ppap.daysOpen}d open` : ""}
              {ppap.approvedDate !== null ? ` · approved ${longDate(ppap.approvedDate)}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-subtle)" }}>
              <div
                style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #16a34a, #22c55e)", transition: "width 300ms" }}
              />
            </div>
            <span className="text-[12px] font-semibold">
              {done}/{completeness.required} approved
            </span>
          </div>
        </div>
        <Button onClick={() => router.push(`/suppliers/${ppap.supplierId}`)}>
          <Building2 size={14} /> Supplier 360
        </Button>
      </Card>

      {/* AI prediction */}
      {hasPrediction && (
        <div
          className="rounded-lg p-3.5"
          style={{
            background: pred.willMissDeadline ? "rgba(220,38,38,0.05)" : "rgba(34,197,94,0.05)",
            border: `1px solid ${pred.willMissDeadline ? "rgba(220,38,38,0.25)" : "rgba(34,197,94,0.25)"}`,
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles size={14} style={{ color: pred.willMissDeadline ? "#dc2626" : "#16a34a" }} />
            <strong className="text-[12px]">
              AI delivery prediction{pred.confidence != null ? ` · confidence ${pred.confidence}%` : ""}
            </strong>
          </div>
          <div className="text-[12px]">
            {pred.willMissDeadline ? (
              <>
                Likely to miss the customer date
                {pred.daysLikelyOver != null ? (
                  <>
                    {" "}
                    by <strong>~{pred.daysLikelyOver} days.</strong>
                  </>
                ) : (
                  "."
                )}{" "}
                {pred.reasoning}
              </>
            ) : (
              <>On track to meet the customer date. {pred.reasoning}</>
            )}
          </div>
        </div>
      )}

      {/* 18 elements */}
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold text-text">PPAP elements</h3>
        <p className="mb-3 text-[12px] text-muted">AIAG PPAP 4th ed. — 18 elements. Element 18 is the PSW.</p>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {ppap.elements.map((el) => (
            <ElementRow key={el.id} submissionId={ppap.id} version={ppap.lockVersion} el={el} canManage={canManage && !decided} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ElementRow({
  submissionId,
  version,
  el,
  canManage,
}: {
  submissionId: string;
  version: number;
  el: PpapElementDto;
  canManage: boolean;
}): React.ReactElement {
  const toast = useToast();
  const update = useUpdatePpapElement(submissionId);
  const [comment, setComment] = useState(el.comment ?? "");
  const dirty = comment !== (el.comment ?? "");

  const save = (status: PpapElementStatus, nextComment: string | null): void => {
    update.mutate(
      { no: el.id, body: { status, comment: nextComment, version } },
      { onError: (err) => toast.error(errorMessage(err)) },
    );
  };

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border p-2.5">
      <ElementMarker status={el.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-semibold text-muted">#{el.id}</span>
          <span className="truncate text-[12.5px] font-semibold" title={el.name}>
            {el.name}
          </span>
        </div>

        {canManage ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <select
              className="k-input"
              value={el.status}
              onChange={(e) => save(e.target.value as PpapElementStatus, el.comment)}
              disabled={update.isPending}
              aria-label={`Status for element ${el.id}`}
              style={{ height: 28, fontSize: 12 }}
            >
              {ELEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ELEMENT_STYLES[s].label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <input
                className="k-input"
                placeholder="Add a review comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ height: 28, fontSize: 12 }}
              />
              {dirty && (
                <button
                  type="button"
                  className="shrink-0 rounded-sm px-2 py-1 text-[11px] font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                  onClick={() => save(el.status, comment === "" ? null : comment)}
                  disabled={update.isPending}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1">
              <ElementStatusBadge status={el.status} />
            </div>
            {el.comment !== null && el.comment !== "" && (
              <div
                className="mt-1.5 rounded-sm p-1.5 text-[11px] text-muted"
                style={{ background: "rgba(234,88,12,0.05)", borderLeft: "2px solid #ea580c" }}
              >
                {el.comment}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} /> PPAP
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-16" />
      <Skeleton className="h-20" />
      <Skeleton className="h-80" />
    </div>
  );
}
