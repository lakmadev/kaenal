"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-react";
import type { FileDto, PortalPpapDto } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { EmptyState, Skeleton, useToast } from "@/components/ui";
import { usePortalPpap, useResubmitPpap } from "@/hooks/use-portal";
import { PortalEvidenceAttach } from "./portal-evidence-attach";
import { PortalElementBadge, PortalPpapStatus, TEAL } from "./portal-bits";

const RESUBMITTABLE = new Set(["pending", "in_review", "interim"]);

export function PortalPpapDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: ppap, isLoading, isError } = usePortalPpap(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || ppap === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Back onClick={() => router.push("/portal/ppap")} />
        <div className="mt-4 rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <EmptyState icon={TriangleAlert} title="Not found" body="This PPAP submission isn't available." />
        </div>
      </div>
    );
  }
  return <View ppap={ppap} />;
}

function View({ ppap }: { ppap: PortalPpapDto }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const resubmit = useResubmitPpap(ppap.id);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<FileDto[]>([]);

  const canResubmit = RESUBMITTABLE.has(ppap.status);
  const changesRequested = ppap.elements.filter((e) => e.status === "changes_requested").length;

  const submit = (): void => {
    resubmit.mutate(
      {
        note: note.trim() === "" ? null : note.trim(),
        ...(evidence.length > 0 ? { fileIds: evidence.map((f) => f.id) } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Package re-submitted for review");
          setNote("");
          setEvidence([]);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <Back onClick={() => router.push("/portal/ppap")} />

      <div className="rounded-xl border p-5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <div className="mb-1 mono text-[12px] text-muted">{ppap.code ?? ppap.id.slice(0, 8)}</div>
        <h1 className="mb-2 text-[19px] font-bold tracking-tight">
          {ppap.partNumber}
          {ppap.partRev !== null ? ` · rev ${ppap.partRev}` : ""}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <PortalPpapStatus status={ppap.status} />
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "var(--bg-subtle)" }}>
            Level {ppap.level}
          </span>
          <span className="text-[11px] text-muted">
            {ppap.programName !== null ? `${ppap.programName} · ` : ""}
            {ppap.customer !== null ? `${ppap.customer} · ` : ""}
            Submitted {longDate(ppap.submittedDate)} · Due {longDate(ppap.dueDate)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="text-[12px] font-semibold">
            {ppap.completeness.approved}/{ppap.completeness.required} elements approved
          </div>
          {changesRequested > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(234,88,12,0.12)", color: "#9a3412" }}>
              {changesRequested} need changes
            </span>
          )}
        </div>
      </div>

      {/* Re-submit */}
      {canResubmit && (
        <div className="rounded-xl border p-5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <h2 className="text-[14px] font-semibold">Re-submit package</h2>
          <p className="mb-2.5 text-[12px] text-muted">
            After addressing the feedback below, re-submit to send the package back for review.
          </p>
          <textarea
            className="k-input w-full"
            rows={3}
            placeholder="What changed since the last submission? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: "vertical", minHeight: 72 }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PortalEvidenceAttach files={evidence} onChange={setEvidence} disabled={resubmit.isPending} />
            <button
              onClick={submit}
              disabled={resubmit.isPending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: TEAL }}
            >
              <RefreshCw size={14} /> Re-submit for review
            </button>
          </div>
        </div>
      )}

      {/* Element feedback grid */}
      <div className="rounded-xl border p-5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <h2 className="text-[14px] font-semibold">Element feedback</h2>
        <p className="mb-3 text-[12px] text-muted">AIAG PPAP — 18 elements. Element 18 is the PSW.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {ppap.elements.map((el) => (
            <div key={el.id} className="rounded-md border p-2.5" style={{ borderColor: "#e2e8f0" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold text-muted">#{el.id}</span>
                  <span className="truncate text-[12.5px] font-semibold" title={el.name}>
                    {el.name}
                  </span>
                </div>
                <PortalElementBadge status={el.status} />
              </div>
              {el.comment !== null && el.comment !== "" && (
                <div className="mt-1.5 rounded-sm p-1.5 text-[11px] text-muted" style={{ background: "rgba(234,88,12,0.05)", borderLeft: "2px solid #ea580c" }}>
                  {el.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} /> PPAP
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
