"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Send, TriangleAlert } from "lucide-react";
import type { FileDto, PortalScarDto } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { SCAR_D_STEPS } from "@kaenal/core";
import { usePortalScar, useRespondScar } from "@/hooks/use-portal";
import { PortalEvidenceAttach } from "./portal-evidence-attach";
import { PortalScarStatus, PortalSeverity, stageLabel, TEAL, TEAL_DARK } from "./portal-bits";

const RESPONDABLE = new Set(["draft", "open", "responded"]);

export function PortalScarDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: scar, isLoading, isError } = usePortalScar(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || scar === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Back onClick={() => router.push("/portal/scars")} />
        <div className="mt-4 rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <EmptyState icon={TriangleAlert} title="Not found" body="This corrective action isn't available." />
        </div>
      </div>
    );
  }

  return <View scar={scar} />;
}

function View({ scar }: { scar: PortalScarDto }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const respond = useRespondScar(scar.id);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<FileDto[]>([]);
  const canRespond = RESPONDABLE.has(scar.status);

  const submit = (acknowledge: boolean): void => {
    if (note.trim() === "") {
      toast.error("Enter a response first");
      return;
    }
    respond.mutate(
      {
        note: note.trim(),
        acknowledge,
        ...(evidence.length > 0 ? { fileIds: evidence.map((f) => f.id) } : {}),
      },
      {
        onSuccess: () => {
          toast.success(acknowledge ? "Response submitted and acknowledged" : "Response submitted");
          setNote("");
          setEvidence([]);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <Back onClick={() => router.push("/portal/scars")} />

      <div className="rounded-xl border p-5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <div className="mb-1 mono text-[12px] text-muted">{scar.code}</div>
        <h1 className="mb-2 text-[19px] font-bold tracking-tight">{scar.title ?? "Corrective action"}</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <PortalScarStatus status={scar.status} />
          <PortalSeverity severity={scar.severity} />
          {scar.overdue && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(220,38,38,0.1)", color: "#b91c1c" }}>
              <TriangleAlert size={10} /> Overdue
            </span>
          )}
          <span className="text-[11px] text-muted">
            Raised {longDate(scar.raisedDate)} · Response due {longDate(scar.supplierResponseDue)}
            {scar.daysOpen !== null ? ` · ${scar.daysOpen}d open` : ""}
          </span>
        </div>
      </div>

      {/* Acknowledgement state */}
      {scar.supplierAcknowledged && (
        <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <Check size={15} style={{ color: "#16a34a" }} />
          <span className="text-[12.5px]">
            You acknowledged this SCAR{scar.ackDate !== null ? ` on ${longDate(scar.ackDate)}` : ""}.
          </span>
        </div>
      )}

      {/* 8D progress */}
      <div className="rounded-xl border p-5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <h2 className="text-[14px] font-semibold">8D progress — {stageLabel(scar.currentD)}</h2>
        <p className="mb-3 text-[12px] text-muted">The Kaenal quality team advances these steps as your response is reviewed.</p>
        <ol className="flex flex-col gap-1.5">
          {SCAR_D_STEPS.map((step) => {
            const done = step.id < scar.currentD;
            const here = step.id === scar.currentD;
            return (
              <li
                key={step.id}
                className="flex items-center gap-2.5 rounded-md border p-2"
                style={{ borderColor: here ? TEAL : "#e2e8f0", background: here ? "rgba(13,148,136,0.05)" : done ? "rgba(34,197,94,0.04)" : "transparent" }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: done ? "#16a34a" : here ? TEAL : "var(--bg-subtle)", color: step.id <= scar.currentD ? "white" : "var(--text-muted)" }}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : step.id}
                </span>
                <span className="text-[12.5px] font-medium">
                  D{step.id} · {step.name}
                </span>
                {here && <span className="ml-auto text-[10.5px] font-semibold" style={{ color: TEAL_DARK }}>Current</span>}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Respond */}
      <div className="rounded-xl border p-5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <h2 className="text-[14px] font-semibold">Your response</h2>
        {canRespond ? (
          <>
            <p className="mb-2.5 text-[12px] text-muted">
              Describe your containment, root cause, or corrective action. The Kaenal quality team is notified.
            </p>
            <textarea
              className="k-input w-full"
              rows={4}
              placeholder="e.g. Remaining lot quarantined; 5-Why points to fixture wear — corrective action attached."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ resize: "vertical", minHeight: 92 }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PortalEvidenceAttach files={evidence} onChange={setEvidence} disabled={respond.isPending} />
              <div className="ml-auto flex gap-2">
                <Button onClick={() => submit(false)} loading={respond.isPending}>
                  <Send size={14} /> Submit response
                </Button>
                {!scar.supplierAcknowledged && (
                  <button
                    onClick={() => submit(true)}
                    disabled={respond.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                    style={{ background: TEAL }}
                  >
                    <Check size={14} /> Submit & acknowledge
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-muted">This corrective action is closed and no longer accepts responses.</p>
        )}
      </div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} /> Corrective actions
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
