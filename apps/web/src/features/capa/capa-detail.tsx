"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Undo2,
  Lock,
  Clock,
  Calendar,
  Brain,
  ShieldCheck,
  History,
  ClipboardList,
  ChevronRight,
  TriangleAlert,
  Link2,
} from "lucide-react";
import type { CapaDto } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { longDate, titleCase } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useCapa, useAdvanceCapa, useRevertCapa } from "@/hooks/use-capas";
import {
  Button,
  Dialog,
  DialogContent,
  Field,
  StatusBadge,
  PriorityBadge,
  RiskBadge,
  Skeleton,
  EmptyState,
  useToast,
} from "@/components/ui";
import { CAPA_PHASES, phaseIndex, TypeChip, PhaseTracker, OwnerCell } from "./capa-bits";
import { CapaActionPlan } from "./capa-actions";

type Tab = "plan" | "rca" | "effectiveness" | "history";

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
  { id: "plan", label: "Action plan", icon: ClipboardList },
  { id: "rca", label: "Root cause", icon: Brain },
  { id: "effectiveness", label: "Effectiveness", icon: ShieldCheck },
  { id: "history", label: "Activity", icon: History },
];

export function CapaDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: capa, isLoading, isError } = useCapa(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || capa === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/capa")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="CAPA not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return <CapaDetailView capa={capa} meId={me?.userId} canManage={hasCapability(me, "capa:manage")} />;
}

function CapaDetailView({
  capa,
  meId,
  canManage,
}: {
  capa: CapaDto;
  meId: string | undefined;
  canManage: boolean;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const advance = useAdvanceCapa();
  const revert = useRevertCapa();
  const [tab, setTab] = useState<Tab>("plan");
  const [revertOpen, setRevertOpen] = useState(false);

  const idx = phaseIndex(capa.status);
  const nextPhase = CAPA_PHASES[idx + 1];
  const prevPhase = idx > 0 ? CAPA_PHASES[idx - 1] : undefined;
  const atEnd = nextPhase === undefined;
  const atStart = prevPhase === undefined;
  const busy = advance.isPending || revert.isPending;

  const runAdvance = (): void => {
    if (nextPhase === undefined) return;
    advance.mutate(
      { id: capa.id, body: { to: nextPhase.id, version: capa.lockVersion } },
      {
        onSuccess: () =>
          toast.success(nextPhase.id === "closed" ? `${capa.code} closed — workflow complete` : `Advanced to ${nextPhase.label}`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const runRevert = (reason: string): void => {
    if (prevPhase === undefined) return;
    revert.mutate(
      { id: capa.id, body: { to: prevPhase.id, version: capa.lockVersion, reason } },
      {
        onSuccess: () => {
          toast.success(`Reverted to ${prevPhase.label}`);
          setRevertOpen(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/capa")} />

      {/* Header */}
      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <TypeChip type={capa.type} />
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                {capa.code}
              </span>
              <StatusBadge status={capa.status} />
              <PriorityBadge priority={capa.priority} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight">{capa.title}</h1>
            {capa.description !== null && capa.description !== "" && (
              <p className="mt-1.5 max-w-2xl text-[13px] text-muted">{capa.description}</p>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {!atStart && (
                <Button variant="ghost" loading={busy} onClick={() => setRevertOpen(true)}>
                  <Undo2 size={14} /> Revert
                </Button>
              )}
              <Button variant="primary" loading={busy} disabled={atEnd} onClick={runAdvance}>
                {atEnd ? <Lock size={14} /> : <ArrowRight size={14} />}
                {atEnd ? "Closed" : `Advance to ${nextPhase?.label}`}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Phase tracker */}
      <div className="k-surface p-[18px]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="k-overline">Current phase</div>
            <div className="text-[16px] font-bold">{CAPA_PHASES[idx]?.label ?? titleCase(capa.status)}</div>
          </div>
          <div className="flex flex-wrap gap-4 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} /> Opened {longDate(capa.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} /> Due {longDate(capa.dueAt)}
            </span>
          </div>
        </div>
        <PhaseTracker phase={capa.status} />
      </div>

      {/* Body: tabs + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="k-tabs mb-3.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" className={cn("k-tab", tab === t.id && "active")} onClick={() => setTab(t.id)}>
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === "plan" && <CapaActionPlan capaId={capa.id} canManage={canManage} />}
          {tab === "rca" && (
            <div className="k-surface">
              <EmptyState
                icon={Brain}
                title="Root cause not yet documented"
                body="Root-cause analysis (5-Whys / fishbone) is captured on a linked 8D. The dedicated RCA editor lands with the 8D module."
              />
            </div>
          )}
          {tab === "effectiveness" && (
            <div className="k-surface">
              <EmptyState
                icon={ShieldCheck}
                title="Effectiveness checks not scheduled"
                body="Effectiveness checks are scheduled after action-plan completion."
              />
            </div>
          )}
          {tab === "history" && (
            <div className="k-surface">
              <EmptyState icon={History} title="Activity timeline" body="The audit trail view lands with the shared history component." />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="k-surface p-4">
            <div className="k-overline mb-2.5">Details</div>
            <div className="flex flex-col gap-2.5">
              <Meta label="Owner">
                <OwnerCell ownerId={capa.ownerId} meId={meId} />
              </Meta>
              <Meta label="Sponsor">
                <OwnerCell ownerId={capa.sponsorId} meId={meId} unassignedLabel="None" />
              </Meta>
              <Meta label="Type">
                <span className="text-[12.5px]">{titleCase(capa.type)}</span>
              </Meta>
              <Meta label="Priority">
                <PriorityBadge priority={capa.priority} />
              </Meta>
              <Meta label="Risk">
                <RiskBadge risk={capa.risk} />
              </Meta>
              <Meta label="Opened">
                <span className="mono text-[12px]">{longDate(capa.createdAt)}</span>
              </Meta>
              <Meta label="Due">
                <span className="mono text-[12px]">{longDate(capa.dueAt)}</span>
              </Meta>
              {capa.effectivenessCheckAt !== null && (
                <Meta label="Eff. check">
                  <span className="mono text-[12px]">{longDate(capa.effectivenessCheckAt)}</span>
                </Meta>
              )}
            </div>
          </div>

          {capa.sourceKind !== null && capa.sourceId !== null && (
            <div className="k-surface p-4">
              <div className="k-overline mb-2.5">Linked items</div>
              <LinkedItem
                label={titleCase(capa.sourceKind)}
                id={capa.sourceId}
                {...(capa.sourceKind === "ncr" ? { onClick: () => router.push(`/ncrs/${capa.sourceId}`) } : {})}
              />
            </div>
          )}
        </aside>
      </div>

      <RevertDialog
        open={revertOpen}
        onOpenChange={setRevertOpen}
        toLabel={prevPhase?.label ?? ""}
        loading={revert.isPending}
        onConfirm={runRevert}
      />
    </div>
  );
}

function RevertDialog({
  open,
  onOpenChange,
  toLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  toLabel: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
}): React.ReactElement {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Revert to ${toLabel}`}
        description="Reverting a CAPA moves it back a phase. This is an audited exception and requires a reason."
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" required>
            {(a) => (
              <textarea
                {...a}
                className="k-input"
                rows={3}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this CAPA moving back a phase?"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={loading} disabled={reason.trim() === ""} onClick={() => onConfirm(reason.trim())}>
              Revert
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkedItem({ label, id, onClick }: { label: string; id: string; onClick?: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={onClick === undefined}
      className="flex w-full items-center gap-2 rounded-[3px] border border-border bg-surface px-2.5 py-2 text-left enabled:hover:border-border-strong disabled:cursor-default"
    >
      <span
        className="flex items-center justify-center rounded-md"
        style={{ width: 26, height: 26, background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Link2 size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
          {id.slice(0, 8)}
        </div>
      </div>
      {onClick !== undefined && <ChevronRight size={14} className="text-muted" />}
    </button>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="k-overline">{label}</span>
      {children}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="k-btn k-btn-plain self-start px-0 text-[13px] text-muted">
      <ArrowLeft size={14} /> Back to CAPAs
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
