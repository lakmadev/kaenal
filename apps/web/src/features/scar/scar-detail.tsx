"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TriangleAlert, Building2, Check, ChevronRight, DollarSign, Link2 } from "lucide-react";
import type { ChargebackStatus, ScarDto } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useScar, useAdvanceScar, useAcknowledgeScar, useChargebackScar, useAssignScar } from "@/hooks/use-scar";
import { PageHeader } from "@/components/page-header";
import { AssigneePicker } from "@/components/assignee-picker";
import { Button, Card, EmptyState, Skeleton, useToast } from "@/components/ui";
import { SCAR_D_STEPS } from "@kaenal/core";
import {
  ChargebackBadge,
  DSteps,
  OverdueChip,
  ScarStatusBadge,
  SeverityChip,
  formatMoney,
  stageLabel,
} from "./scar-bits";

export function ScarDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: scar, isLoading, isError } = useScar(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || scar === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/scars")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="SCAR not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return <ScarDetailView scar={scar} meId={me?.userId} canManage={hasCapability(me, "scar:manage")} />;
}

function ScarDetailView({
  scar,
  meId,
  canManage,
}: {
  scar: ScarDto;
  meId: string | undefined;
  canManage: boolean;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const advance = useAdvanceScar(scar.id);
  const acknowledge = useAcknowledgeScar(scar.id);
  const assign = useAssignScar(scar.id);

  const runAssign = (owner: string | null): void =>
    assign.mutate(
      { version: scar.lockVersion, owner },
      {
        onSuccess: () => toast.success(owner === null ? "Unassigned" : "Owner updated"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  const active = scar.status === "draft" || scar.status === "open" || scar.status === "responded";
  const atFinalD = scar.currentD >= 8;

  const runAdvance = (): void => {
    advance.mutate(
      { version: scar.lockVersion },
      {
        onSuccess: (s) => toast.success(`Advanced to ${stageLabel(s.currentD)}`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const runAcknowledge = (): void => {
    acknowledge.mutate(
      { version: scar.lockVersion },
      {
        onSuccess: () => toast.success("Supplier acknowledgement recorded"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/scars")} />
      <PageHeader
        title={`${scar.code}${scar.title !== null ? ` — ${scar.title}` : ""}`}
        description={[scar.supplierName, `${scar.severity} severity`, stageLabel(scar.currentD)]
          .filter((v): v is string => v !== null && v !== "")
          .join(" · ")}
        actions={
          canManage && active && !atFinalD ? (
            <Button variant="primary" onClick={runAdvance} loading={advance.isPending}>
              Advance 8D <ChevronRight size={14} />
            </Button>
          ) : undefined
        }
      />

      {/* Header strip */}
      <Card className="grid items-center gap-4 p-4" style={{ gridTemplateColumns: "1fr auto" }}>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <ScarStatusBadge status={scar.status} />
            <SeverityChip severity={scar.severity} />
            {scar.overdue && <OverdueChip />}
            <span className="text-[11px] text-muted">
              Raised {longDate(scar.raisedDate)} · Due {longDate(scar.dueDate)}
              {scar.daysOpen !== null ? ` · ${scar.daysOpen}d open` : ""}
              {scar.affectedLots !== null ? ` · ${scar.affectedLots} lots affected` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DSteps current={scar.currentD} size={22} />
            <span className="text-[12px] font-semibold">{stageLabel(scar.currentD)}</span>
          </div>
        </div>
        <Button onClick={() => router.push(`/suppliers/${scar.supplierId}`)}>
          <Building2 size={14} /> Supplier 360
        </Button>
      </Card>

      {/* Supplier acknowledgement */}
      <div
        className="flex items-center justify-between rounded-lg p-3.5"
        style={{
          background: scar.supplierAcknowledged ? "rgba(34,197,94,0.05)" : "rgba(245,158,11,0.05)",
          border: `1px solid ${scar.supplierAcknowledged ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
        }}
      >
        <div className="flex items-center gap-2">
          <Check size={15} style={{ color: scar.supplierAcknowledged ? "#16a34a" : "#94a3b8" }} />
          <span className="text-[12.5px]">
            {scar.supplierAcknowledged ? (
              <>
                Supplier acknowledged the SCAR{scar.ackDate !== null ? ` on ${longDate(scar.ackDate)}` : ""}.
              </>
            ) : (
              <>
                Awaiting supplier acknowledgement
                {scar.supplierResponseDue !== null ? ` · response due ${longDate(scar.supplierResponseDue)}` : ""}.
              </>
            )}
          </span>
        </div>
        {canManage && !scar.supplierAcknowledged && (
          <Button onClick={runAcknowledge} loading={acknowledge.isPending}>
            Record acknowledgement
          </Button>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        {/* 8D discipline tracker */}
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold">8D disciplines</h3>
          <p className="mb-3 text-[12px] text-muted">Corrective action worked with the supplier, D1 → D8.</p>
          <ol className="flex flex-col gap-1.5">
            {SCAR_D_STEPS.map((step) => {
              const done = step.id < scar.currentD;
              const here = step.id === scar.currentD;
              return (
                <li
                  key={step.id}
                  className="flex items-center gap-2.5 rounded-md border p-2"
                  style={{
                    borderColor: here ? "rgba(245,158,11,0.4)" : "var(--border)",
                    background: here ? "rgba(245,158,11,0.05)" : done ? "rgba(34,197,94,0.04)" : "transparent",
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: done ? "#16a34a" : here ? "#f59e0b" : "var(--bg-subtle)", color: step.id <= scar.currentD ? "white" : "var(--text-muted)" }}
                  >
                    {done ? <Check size={12} strokeWidth={3} /> : step.id}
                  </span>
                  <span className="text-[12.5px] font-medium">
                    D{step.id} · {step.name}
                  </span>
                  {here && <span className="ml-auto text-[10.5px] font-semibold text-[color:var(--warn,#b45309)]">Current</span>}
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="k-overline mb-2.5">Owner</div>
            <AssigneePicker
              userId={scar.owner}
              meId={meId}
              canManage={canManage}
              busy={assign.isPending}
              onAssign={runAssign}
            />
          </Card>
          <ChargebackPanel scar={scar} canManage={canManage} />
          <LinksPanel scar={scar} onOpenNcr={(ncrId) => router.push(`/ncrs/${ncrId}`)} />
        </div>
      </div>
    </div>
  );
}

const NEXT_CHARGEBACK: Record<"none" | ChargebackStatus, { to: ChargebackStatus; label: string } | null> = {
  none: { to: "pending", label: "Raise chargeback" },
  pending: { to: "debit_issued", label: "Issue debit memo" },
  debit_issued: { to: "closed", label: "Mark recovered" },
  closed: null,
};

function ChargebackPanel({ scar, canManage }: { scar: ScarDto; canManage: boolean }): React.ReactElement {
  const toast = useToast();
  const chargeback = useChargebackScar(scar.id);
  const current = scar.chargeback.status;
  const next = NEXT_CHARGEBACK[current ?? "none"];
  const [amount, setAmount] = useState(scar.chargeback.amount !== null ? String(scar.chargeback.amount) : "");

  const runTransition = (): void => {
    if (next === null) return;
    const body =
      current === null
        ? { status: next.to, amount: amount !== "" ? Number(amount) : null, version: scar.lockVersion }
        : { status: next.to, version: scar.lockVersion };
    chargeback.mutate(body, {
      onSuccess: () => toast.success(`Chargeback → ${next.label.toLowerCase()}`),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <DollarSign size={14} className="text-muted" />
        <h3 className="text-[13.5px] font-semibold">Chargeback</h3>
      </div>
      <div className="text-[24px] font-bold tabular-nums" style={{ color: "#7c3aed" }}>
        {formatMoney(scar.chargeback.amount, scar.chargeback.currency)}
      </div>
      <div className="mt-1.5">
        <ChargebackBadge status={current} />
      </div>

      {canManage && next !== null && (
        <div className="mt-3 flex flex-col gap-2">
          {current === null && (
            <input
              className="k-input"
              type="number"
              min={0}
              placeholder="Amount to recover"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ height: 30, fontSize: 12 }}
            />
          )}
          <Button variant="primary" onClick={runTransition} loading={chargeback.isPending}>
            {next.label}
          </Button>
        </div>
      )}
      {current === "closed" && <p className="mt-2 text-[11px] text-muted">Cost recovered — the debit memo is final.</p>}
    </Card>
  );
}

function LinksPanel({ scar, onOpenNcr }: { scar: ScarDto; onOpenNcr: (ncrId: string) => void }): React.ReactElement {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Link2 size={14} className="text-muted" />
        <h3 className="text-[13.5px] font-semibold">Linked records</h3>
      </div>
      {scar.ncrId !== null ? (
        <button
          onClick={() => onOpenNcr(scar.ncrId!)}
          className="flex w-full items-center justify-between rounded-md border border-border p-2 text-left hover:bg-[color:var(--bg-subtle)]"
        >
          <span className="text-[12px] font-medium">Originating NCR</span>
          <ChevronRight size={14} className="text-subtle" />
        </button>
      ) : (
        <p className="text-[12px] text-muted">No linked NCR. 8D and other cross-links can be added from the records graph.</p>
      )}
    </Card>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} /> SCARs
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-16" />
      <Skeleton className="h-14" />
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
