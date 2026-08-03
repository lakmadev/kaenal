"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, GitBranch, TriangleAlert, Users, X } from "lucide-react";
import type { EightDDto, EightDStepStatus } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useEightD, useUpdateEightDStep, useTransitionEightD } from "@/hooks/use-eightd";
import { UserCell } from "@/features/documents/document-bits";
import { PageHeader } from "@/components/page-header";
import { Button, Card, EmptyState, Skeleton, useToast } from "@/components/ui";
import { DisciplineRail, EightDStatusBadge, StepStatusBadge, disciplineFor } from "./eightd-bits";

export function EightDDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: report, isLoading, isError } = useEightD(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || report === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/8d")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="8D report not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return <DetailView report={report} canManage={hasCapability(me, "ncr:manage")} meId={me?.userId} />;
}

function statusOfStep(report: EightDDto, n: number): EightDStepStatus {
  return report.steps[disciplineFor(n).key]?.status ?? "pending";
}

function DetailView({ report, canManage, meId }: { report: EightDDto; canManage: boolean; meId: string | undefined }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const transition = useTransitionEightD(report.id);

  const [active, setActive] = useState(report.currentStep);
  // Follow the report's current step when it advances (after a completion).
  useEffect(() => setActive(report.currentStep), [report.currentStep]);

  const done = Object.values(report.steps).filter((s) => s.status === "complete").length;
  const decided = report.status !== "active";
  const allComplete = done === 8;

  const runTransition = (to: "completed" | "cancelled"): void => {
    transition.mutate(
      { to, version: report.lockVersion },
      {
        onSuccess: () => toast.success(to === "completed" ? "8D completed" : "8D cancelled"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/8d")} />
      <PageHeader
        title={`${report.code} — ${report.title}`}
        description={`8D problem solving · ${done}/8 disciplines complete`}
        actions={
          canManage && !decided ? (
            <>
              <Button onClick={() => runTransition("cancelled")} loading={transition.isPending}>
                <X size={14} /> Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!allComplete || transition.isPending}
                title={allComplete ? undefined : "All eight disciplines must be complete first"}
                onClick={() => runTransition("completed")}
              >
                <Check size={14} /> Complete 8D
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Header strip */}
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <EightDStatusBadge status={report.status} />
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Users size={13} /> Lead <UserCell userId={report.teamLeadId} meId={meId} emptyLabel="unassigned" />
          {report.championId !== null && (
            <>
              · Champion <UserCell userId={report.championId} meId={meId} />
            </>
          )}
          {report.memberIds.length > 0 && <>· {report.memberIds.length} members</>}
        </span>
        <span className="text-[11px] text-muted">
          {report.startedAt !== null ? `Started ${longDate(report.startedAt)}` : ""}
          {report.targetAt !== null ? ` · Target ${longDate(report.targetAt)}` : ""}
        </span>
        {report.ncrId !== null && (
          <button
            onClick={() => router.push(`/ncrs/${report.ncrId}`)}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            <GitBranch size={13} /> Linked NCR
          </button>
        )}
      </Card>

      {/* Discipline rail */}
      <Card className="p-3">
        <DisciplineRail active={active} statusOf={(n) => statusOfStep(report, n)} onSelect={setActive} />
      </Card>

      {/* Active discipline */}
      <StepPanel report={report} n={active} canManage={canManage && !decided} />
    </div>
  );
}

function StepPanel({ report, n, canManage }: { report: EightDDto; n: number; canManage: boolean }): React.ReactElement {
  const toast = useToast();
  const update = useUpdateEightDStep(report.id);
  const discipline = disciplineFor(n);
  const step = report.steps[discipline.key];
  const status: EightDStepStatus = step?.status ?? "pending";
  const stepData = useMemo(() => step?.data ?? {}, [step]);

  // Local buffer for the freeform fields, seeded from the step data.
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const f of discipline.fields) seed[f.key] = typeof stepData[f.key] === "string" ? (stepData[f.key] as string) : "";
    setDraft(seed);
  }, [discipline, stepData]);

  const dirty = discipline.fields.some((f) => draft[f.key] !== (typeof stepData[f.key] === "string" ? stepData[f.key] : ""));

  const save = (nextStatus: EightDStepStatus): void => {
    const data: Record<string, string> = {};
    for (const f of discipline.fields) if ((draft[f.key] ?? "") !== "") data[f.key] = draft[f.key] ?? "";
    update.mutate(
      { step: n, body: { status: nextStatus, data, version: report.lockVersion } },
      {
        onSuccess: () =>
          toast.success(nextStatus === "complete" ? `${discipline.code} complete` : `${discipline.code} saved`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-semibold">
              {discipline.code} · {discipline.title}
            </h3>
            <StepStatusBadge status={status} />
          </div>
          <p className="text-[12px] text-muted">{discipline.desc}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {discipline.fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-text">{f.label}</span>
            {canManage ? (
              <textarea
                className="k-input w-full"
                rows={f.rows ?? 3}
                placeholder={f.placeholder}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            ) : (
              <div className="rounded-md border border-border p-2.5 text-[12.5px]" style={{ minHeight: 40, whiteSpace: "pre-wrap" }}>
                {typeof stepData[f.key] === "string" && stepData[f.key] !== "" ? (stepData[f.key] as string) : <span className="text-subtle">Not recorded yet.</span>}
              </div>
            )}
          </label>
        ))}
      </div>

      {canManage && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {status !== "complete" && (
            <Button onClick={() => save(status === "pending" ? "in_progress" : status)} loading={update.isPending} disabled={!dirty && status !== "pending"}>
              Save draft
            </Button>
          )}
          {status !== "complete" ? (
            <Button variant="primary" onClick={() => save("complete")} loading={update.isPending}>
              <Check size={14} /> Complete {discipline.code}
            </Button>
          ) : (
            <Button onClick={() => save("in_progress")} loading={update.isPending}>
              Re-open {discipline.code}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} /> 8D reports
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
