"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, GitBranch, Pencil, RotateCcw, Send, Square, TriangleAlert, X, Ban } from "lucide-react";
import type { EcnApprovalStage, EcnDto } from "@kaenal/types";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import {
  useCloseEcn,
  useDecideEcnApproval,
  useEcn,
  useEcnApprovals,
  useResubmitEcn,
  useSubmitEcn,
  useWithdrawEcn,
} from "@/hooks/use-ecn";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, useToast } from "@/components/ui";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { apiErrorInfo, errorMessage } from "@/lib/api-error";
import { longDate, shortDate } from "@/lib/format";
import { CHANGE_TYPE_LABEL, ECN_APPROVAL_STAGES, EcnRiskChip, STAGE_LABEL, stageProgress } from "./ecn-bits";
import { EcnEditDialog } from "./ecn-edit-dialog";
import { EcnRejectDialog } from "./ecn-reject-dialog";
import { EcnAffectedRecords } from "./ecn-affected-records";

const SKIP_REASON_LABEL: Record<string, string> = {
  not_approved: "not currently approved",
  version_exists: "that next version already exists",
  bad_version_format: "its version number isn't in the expected X.Y format",
  concurrent_modification: "it changed at the same moment (concurrent edit)",
};

/**
 * `/ecn?id=` — the ECN detail view (E4, `EcnDetailApproval.dc.html` — no jsx
 * board exists for this view, P19 §3 itself calls for one, DESIGN-06 §4.5).
 * The 5-row approval tracker, submit/withdraw/close/resubmit actions (States
 * G/H), per-gate approve/reject (visibly disabled, not hidden, for a
 * non-approver or when it isn't that gate's turn — the one named departure
 * from `document-detail.tsx`'s own hide-and-replace pattern, DESIGN-06 §3),
 * the affected-records panel, and the persisted auto-revise banner.
 */
export function EcnDetailPage({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: ecn, isLoading, isError, error, refetch } = useEcn(id);

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    const info = apiErrorInfo(error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-5xl p-6">
          <BackLink onClick={() => router.push("/ecn")} />
          <div className="k-surface mt-4">
            <EmptyState icon={GitBranch} title="No access" body="You don't have permission to view this ECN." />
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/ecn")} />
        <div className="k-surface mt-4">
          <EmptyState
            icon={GitBranch}
            title="Couldn't load this ECN"
            body={info?.message ?? "Something went wrong."}
            action={
              <Button variant="ghost" onClick={() => void refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (ecn === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/ecn")} />
        <div className="k-surface mt-4">
          <EmptyState icon={GitBranch} title="ECN not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return (
    <EcnDetailView
      ecn={ecn}
      meId={me?.userId}
      canManage={hasCapability(me, "ecn:manage")}
      canApprove={hasCapability(me, "ecn:approve")}
      onBack={() => router.push("/ecn")}
    />
  );
}

function EcnDetailView({
  ecn,
  meId,
  canManage,
  canApprove,
  onBack,
}: {
  ecn: EcnDto;
  meId: string | undefined;
  canManage: boolean;
  canApprove: boolean;
  onBack: () => void;
}): React.ReactElement {
  const toast = useToast();
  const members = useMemberLookup();
  const approvals = useEcnApprovals(ecn.id);
  const submit = useSubmitEcn();
  const withdraw = useWithdrawEcn();
  const resubmit = useResubmitEcn();
  const close = useCloseEcn();
  const decide = useDecideEcnApproval();

  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const busy = submit.isPending || withdraw.isPending || resubmit.isPending || close.isPending || decide.isPending;
  const isOwner = meId !== undefined && ecn.owner === meId;
  const progress = stageProgress(ecn.stage);

  function run(action: "submit" | "withdraw" | "resubmit" | "close", okMsg: string): void {
    const mutation = action === "submit" ? submit : action === "withdraw" ? withdraw : action === "resubmit" ? resubmit : close;
    mutation.mutate(
      { id: ecn.id, body: { lockVersion: ecn.lockVersion } },
      { onSuccess: () => toast.success(okMsg), onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  function approve(): void {
    decide.mutate(
      { id: ecn.id, stage: ecn.stage as EcnApprovalStage, body: { decision: "approve", lockVersion: ecn.lockVersion } },
      { onSuccess: () => toast.success(`${STAGE_LABEL[ecn.stage]} approved`), onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  function reject(comment: string): void {
    decide.mutate(
      { id: ecn.id, stage: ecn.stage as EcnApprovalStage, body: { decision: "reject", comment, lockVersion: ecn.lockVersion } },
      {
        onSuccess: () => {
          toast.success(`${ecn.code} rejected`);
          setRejectOpen(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  const isGated = ECN_APPROVAL_STAGES.includes(ecn.stage as EcnApprovalStage);
  const decideDisabledReason = !canApprove
    ? "You don't have the ecn:approve capability."
    : isOwner
      ? "The ECN's own owner or creator can't approve or reject it (four-eyes)."
      : undefined;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <OfflineBanner />
      <BackLink onClick={onBack} />

      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                {ecn.code}
              </span>
              <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                {CHANGE_TYPE_LABEL[ecn.changeType]}
              </span>
              <EcnRiskChip risk={ecn.changeRisk} />
              <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                {STAGE_LABEL[ecn.stage]}
                {progress !== null ? ` · step ${progress.step} of ${progress.of}` : ""}
              </span>
            </div>
            <h1 className="text-[20px] font-bold tracking-tight">{ecn.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={13} aria-hidden /> Edit
            </Button>

            {ecn.stage === "draft" && canManage && (
              <>
                <Button variant="ghost" loading={busy} onClick={() => run("withdraw", `${ecn.code} withdrawn`)}>
                  <Ban size={14} aria-hidden /> Withdraw
                </Button>
                <Button variant="primary" loading={busy} onClick={() => run("submit", `${ecn.code} submitted for approval`)}>
                  <Send size={14} aria-hidden /> Submit
                </Button>
              </>
            )}

            {isGated && (
              <>
                <Button
                  variant="ghost"
                  loading={busy}
                  disabled={decideDisabledReason !== undefined}
                  disabledReason={decideDisabledReason}
                  onClick={() => setRejectOpen(true)}
                >
                  <X size={14} aria-hidden /> Reject
                </Button>
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={decideDisabledReason !== undefined}
                  disabledReason={decideDisabledReason}
                  onClick={approve}
                >
                  <Check size={14} aria-hidden /> Approve
                </Button>
              </>
            )}

            {ecn.stage === "implementation" && canManage && (
              <Button variant="primary" loading={busy} onClick={() => run("close", `${ecn.code} closed`)}>
                <Square size={14} aria-hidden /> Close
              </Button>
            )}

            {ecn.stage === "rejected" && canManage && (
              <Button variant="primary" loading={busy} onClick={() => run("resubmit", `${ecn.code} resubmitted — back to Draft`)}>
                <RotateCcw size={14} aria-hidden /> Resubmit
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field k="Owner" v={members.nameOf(ecn.owner)} />
          <Field k="Effective date" v={shortDate(ecn.effectiveDate)} />
          <Field k="Affected records" v={String(ecn.linkedDocumentCount)} />
          <Field k="Last updated" v={longDate(ecn.updatedAt)} />
        </div>

        {ecn.description !== "" && (
          <div className="mt-4">
            <div className="k-overline mb-1.5">Description</div>
            <p className="text-[13px] leading-relaxed text-muted">{ecn.description}</p>
          </div>
        )}
      </div>

      {ecn.stage === "rejected" && (
        <div
          className="flex items-start gap-2.5 rounded-md p-3.5 text-[12.5px] leading-relaxed"
          style={{ border: "1px solid rgba(220,38,38,.28)", background: "var(--danger-bg)", color: "var(--danger-fg)" }}
          role="status"
        >
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            This ECN was rejected at a gate below. {canManage ? "Resubmit it to reset every gate and return to Draft." : ""}
          </div>
        </div>
      )}

      {ecn.autoReviseResult !== null && <AutoReviseBanner result={ecn.autoReviseResult} />}

      <Card>
        <CardHeader>
          <CardTitle>Approval tracker</CardTitle>
        </CardHeader>
        <CardContent>
          {approvals.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : approvals.isError ? (
            <div className="p-3 text-[12px] text-muted">
              Couldn&apos;t load the approval tracker.{" "}
              <button type="button" className="underline" onClick={() => void approvals.refetch()}>
                Retry
              </button>
            </div>
          ) : (
            <table className="k-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Decision</th>
                  <th>Approver</th>
                  <th>Decided at</th>
                </tr>
              </thead>
              <tbody>
                {ECN_APPROVAL_STAGES.map((stage) => {
                  const row = (approvals.data ?? []).find((a) => a.stage === stage);
                  const isCurrent = ecn.stage === stage;
                  return (
                    <tr key={stage} style={isCurrent ? { background: "var(--accent-soft)" } : undefined}>
                      <td style={{ fontSize: 12.5, fontWeight: isCurrent ? 600 : 400 }}>
                        {STAGE_LABEL[stage]}
                        {isCurrent && <span className="ml-1.5 text-[10.5px] text-muted">(current stage)</span>}
                      </td>
                      <td>
                        <DecisionChip decision={row?.decision ?? "pending"} stageLabel={STAGE_LABEL[stage]} />
                      </td>
                      <td style={{ fontSize: 12 }}>{row?.approver != null ? members.nameOf(row.approver) : "—"}</td>
                      <td style={{ fontSize: 11.5 }}>{row?.decidedAt != null ? longDate(row.decidedAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <EcnAffectedRecords ecn={ecn} canManage={canManage} />
        </CardContent>
      </Card>

      {editOpen && <EcnEditDialog ecn={ecn} onClose={() => setEditOpen(false)} />}
      <EcnRejectDialog open={rejectOpen} onOpenChange={setRejectOpen} loading={decide.isPending} onConfirm={reject} />
    </div>
  );
}

function AutoReviseBanner({ result }: { result: NonNullable<EcnDto["autoReviseResult"]> }): React.ReactElement {
  const total = result.revised.length + result.skipped.length;
  return (
    <div className="k-surface p-4" role="status">
      <div className="mb-1.5 text-[13px] font-semibold">
        Auto-revise on implementation — {result.revised.length} of {total} affected document{total === 1 ? "" : "s"} revised
      </div>
      {result.skipped.length > 0 && (
        <ul className="flex flex-col gap-1 text-[12px] text-muted">
          {result.skipped.map((s) => (
            <li key={s.documentId}>
              Document {s.documentId.slice(0, 8)}… was skipped — {SKIP_REASON_LABEL[s.reason] ?? s.reason}.
            </li>
          ))}
        </ul>
      )}
      {result.skipped.length === 0 && <p className="text-[12px] text-muted">Every affected document was revised.</p>}
    </div>
  );
}

function DecisionChip({ decision, stageLabel }: { decision: string; stageLabel: string }): React.ReactElement {
  const style =
    decision === "approved"
      ? { background: "rgba(34,197,94,0.14)", color: "#15803d" }
      : decision === "rejected"
        ? { background: "rgba(220,38,38,0.12)", color: "#b91c1c" }
        : { background: "var(--bg-subtle)", color: "var(--text-muted)" };
  return (
    <span className="k-chip" style={style} aria-label={`${stageLabel} — ${decision}`}>
      {decision}
    </span>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="k-overline" style={{ marginBottom: 2 }}>
        {k}
      </div>
      <div style={{ fontSize: 12.5 }}>{v}</div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-text">
      <ArrowLeft size={13} aria-hidden /> Back to engineering changes
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
