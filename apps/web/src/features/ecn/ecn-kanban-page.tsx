"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Check, X, Send, Ban, RotateCcw, Square } from "lucide-react";
import type { EcnApprovalStage, EcnDto, EcnStage } from "@kaenal/types";
import { ECN_GATED_STAGES } from "@kaenal/core";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api-error";
import { canActOnEcnColumn, ecnDropAction, nextEcnStage } from "@/lib/ecn-kanban";
import { Skeleton, useToast } from "@/components/ui";
import { useMe, useCan } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import {
  useCloseEcn,
  useDecideEcnApproval,
  useEcns,
  useEcnsSummary,
  useResubmitEcn,
  useSubmitEcn,
  useWithdrawEcn,
} from "@/hooks/use-ecn";
import { ECN_KANBAN_COLUMNS, EcnRiskChip, STAGE_COLOR, STAGE_LABEL } from "./ecn-bits";
import { EcnRejectDialog } from "./ecn-reject-dialog";

const GATED_SET = new Set<EcnStage>(ECN_GATED_STAGES);

/**
 * `ECNKanban` (`qms-modules.jsx:593-633`), corrected to 9 columns (Draft,
 * Feasibility, Risk review, PPAP, CAB approval, Pilot, Implementation,
 * Closed, Rejected — DESIGN-06 §0/§4.6). Drag-to-advance for `ecn:approve`
 * holders on the 5 gated columns and `ecn:manage` holders on Draft/
 * Implementation/Rejected; every card also carries the same action as a real
 * keyboard-operable button (DESIGN-06 §4.6's own WCAG note: drag needs a
 * non-drag equivalent). A caller lacking the needed capability for a given
 * column sees no grab handle and no action button at all (rule 10).
 */
export function EcnKanbanBoard({
  canManage,
  onOpen,
}: {
  canManage: boolean;
  onOpen: (id: string) => void;
}): React.ReactElement {
  const toast = useToast();
  const { data: me } = useMe();
  const canApprove = useCan("ecn:approve");
  const members = useMemberLookup();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const all = useEcns({ limit: 100 });
  const summary = useEcnsSummary();
  const submit = useSubmitEcn();
  const withdraw = useWithdrawEcn();
  const resubmit = useResubmitEcn();
  const close = useCloseEcn();
  const decide = useDecideEcnApproval();

  const [override, setOverride] = useState<Record<string, EcnStage>>({});
  const [rejectTarget, setRejectTarget] = useState<EcnDto | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ecns = useMemo(() => all.data?.items ?? [], [all.data]);

  useEffect(() => {
    setOverride((prev) => {
      let changed = false;
      const next: Record<string, EcnStage> = {};
      for (const [id, stage] of Object.entries(prev)) {
        const real = ecns.find((e) => e.id === id);
        if (real !== undefined && real.stage === stage) changed = true;
        else next[id] = stage;
      }
      return changed ? next : prev;
    });
  }, [ecns]);

  const displayStage = (e: EcnDto): EcnStage => override[e.id] ?? e.stage;

  /** Whether the actor may drag/act on cards currently in this column
   *  (`@/lib/ecn-kanban`'s pure decision table, unit-tested there). */
  function canActFrom(stage: EcnStage): boolean {
    return canActOnEcnColumn(stage, { canManage, canApprove });
  }

  function revert(id: string, err: unknown): void {
    setOverride((p) => {
      const { [id]: _drop, ...rest } = p;
      return rest;
    });
    toast.error(errorMessage(err));
  }

  function runReject(ecn: EcnDto, comment: string): void {
    setOverride((p) => ({ ...p, [ecn.id]: "rejected" }));
    decide.mutate(
      { id: ecn.id, stage: ecn.stage as EcnApprovalStage, body: { decision: "reject", comment, lockVersion: ecn.lockVersion } },
      {
        onSuccess: () => setRejectTarget(null),
        onError: (err) => revert(ecn.id, err),
      },
    );
  }

  /** Every drop's legality comes from `@/lib/ecn-kanban`'s pure
   *  `ecnDropAction` table (unit-tested there) — a `null` action is rejected
   *  client-side before any API call, exactly matching what `ecnMachine`
   *  would reject server-side regardless. */
  function moveTo(ecn: EcnDto, target: EcnStage): void {
    const from = displayStage(ecn);
    if (!canActFrom(from)) return;
    const action = ecnDropAction(from, target);
    if (action === null) return;

    if (action === "reject") {
      setRejectTarget(ecn);
      return;
    }

    setOverride((p) => ({ ...p, [ecn.id]: target }));
    const body = { lockVersion: ecn.lockVersion };
    const onError = (err: unknown): void => revert(ecn.id, err);
    switch (action) {
      case "approve":
        decide.mutate({ id: ecn.id, stage: from as EcnApprovalStage, body: { decision: "approve", ...body } }, { onError });
        return;
      case "submit":
        submit.mutate({ id: ecn.id, body }, { onError });
        return;
      case "withdraw":
        withdraw.mutate({ id: ecn.id, body }, { onError });
        return;
      case "close":
        close.mutate({ id: ecn.id, body }, { onError });
        return;
      case "resubmit":
        resubmit.mutate({ id: ecn.id, body }, { onError });
    }
  }

  function withdrawCard(ecn: EcnDto): void {
    setOverride((p) => ({ ...p, [ecn.id]: "rejected" }));
    withdraw.mutate({ id: ecn.id, body: { lockVersion: ecn.lockVersion } }, { onError: (err) => revert(ecn.id, err) });
  }

  function onDragEnd(e: DragEndEvent): void {
    setDraggingId(null);
    const id = String(e.active.id);
    const target = e.over?.id as EcnStage | undefined;
    if (target === undefined) return;
    const ecn = ecns.find((x) => x.id === id);
    if (ecn === undefined) return;
    moveTo(ecn, target);
  }

  if (all.isPending || summary.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  const counts = summary.data;
  const draggingEcn = draggingId !== null ? ecns.find((e) => e.id === draggingId) : undefined;
  const draggingFrom = draggingEcn !== undefined ? displayStage(draggingEcn) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDraggingId(String(e.active.id))}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ECN_KANBAN_COLUMNS.map((stage) => {
            const items = ecns.filter((e) => displayStage(e) === stage);
            const count = counts?.[stage] ?? items.length;
            // During an active drag, only the one legal target for the
            // dragged card's own column accepts the drop (E2 AC1's
            // "immediately-next column only" rule) — every other column is
            // disabled, so no other column highlights (DESIGN-06 §4.6 State A).
            const legalDuringDrag = draggingFrom === null || ecnDropAction(draggingFrom, stage) !== null;
            return (
              <Column key={stage} stage={stage} count={count} droppable={legalDuringDrag}>
                {items.map((e) => (
                  <EcnCard
                    key={e.id}
                    ecn={e}
                    ownerName={members.nameOf(e.owner)}
                    isOwner={me?.userId !== undefined && e.owner === me.userId}
                    canAct={canActFrom(e.stage)}
                    onOpen={() => onOpen(e.id)}
                    onSubmit={() => moveTo(e, "feasibility")}
                    onWithdraw={() => withdrawCard(e)}
                    onApprove={() => {
                      const next = nextEcnStage(e.stage);
                      if (next !== null) moveTo(e, next);
                    }}
                    onReject={() => setRejectTarget(e)}
                    onClose={() => moveTo(e, "closed")}
                    onResubmit={() => moveTo(e, "draft")}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>

      <EcnRejectDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        loading={decide.isPending}
        onConfirm={(comment) => {
          if (rejectTarget !== null) runReject(rejectTarget, comment);
        }}
      />
    </>
  );
}

function Column({
  stage,
  count,
  droppable,
  children,
}: {
  stage: EcnStage;
  count: number;
  droppable: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !droppable });
  return (
    <div style={{ flex: "0 0 240px" }} className="flex flex-col">
      <div className="mb-2.5 flex items-center gap-1.5 px-1.5">
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: STAGE_COLOR[stage] }} aria-hidden />
        <span className="text-[12px] font-bold">{STAGE_LABEL[stage]}</span>
        <span className="ml-auto text-[11px] text-muted">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-[80px] flex-1 flex-col gap-1.5 rounded-md p-2.5 transition-colors")}
        style={{
          background: isOver && droppable ? "var(--accent-soft)" : "var(--bg-subtle)",
          outline: isOver && droppable ? "2px dashed var(--accent)" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EcnCard({
  ecn,
  ownerName,
  isOwner,
  canAct,
  onOpen,
  onSubmit,
  onWithdraw,
  onApprove,
  onReject,
  onClose,
  onResubmit,
}: {
  ecn: EcnDto;
  ownerName: string;
  isOwner: boolean;
  canAct: boolean;
  onOpen: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
  onResubmit: () => void;
}): React.ReactElement {
  const draggable = canAct && ecn.stage !== "closed";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ecn.id, disabled: !draggable });
  const gated = GATED_SET.has(ecn.stage);
  // Four-eyes (§3.2): the ECN's own owner can't approve/reject its own gated
  // stage — the server is the final guard, but the button is hidden here too
  // (rule 10 — never a control that looks usable but silently 403s).
  const canDecide = canAct && gated && !isOwner;

  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={cn("k-surface flex flex-col gap-1.5 p-2.5 text-left", isDragging && "opacity-40")}
      style={{ borderLeft: `3px solid ${ecn.changeRisk === "high" ? "#dc2626" : ecn.changeRisk === "medium" ? "#f59e0b" : "#22c55e"}` }}
    >
      <div className="flex items-center gap-1.5">
        {draggable && (
          <span
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${ecn.code} to another column`}
            className="cursor-grab p-0.5 text-subtle active:cursor-grabbing"
            style={{ minWidth: 20, minHeight: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <GripVertical size={13} aria-hidden />
          </span>
        )}
        <span className="mono text-[10.5px] text-muted">{ecn.code}</span>
        <span className="ml-auto">
          <EcnRiskChip risk={ecn.changeRisk} />
        </span>
      </div>
      <div className="text-[12px] font-medium leading-snug">{ecn.title}</div>
      <div className="text-[11px] text-muted">{ownerName}</div>

      {canAct && (
        <div className="mt-1 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {ecn.stage === "draft" && (
            <>
              <CardAction icon={Send} label="Submit" onClick={onSubmit} />
              <CardAction icon={Ban} label="Withdraw" onClick={onWithdraw} />
            </>
          )}
          {canDecide && (
            <>
              <CardAction icon={Check} label="Approve" onClick={onApprove} />
              <CardAction icon={X} label="Reject" onClick={onReject} />
            </>
          )}
          {gated && !canDecide && (
            <span className="px-1 text-[10.5px] text-subtle">Owner can&apos;t decide (four-eyes)</span>
          )}
          {ecn.stage === "implementation" && <CardAction icon={Square} label="Close" onClick={onClose} />}
          {ecn.stage === "rejected" && <CardAction icon={RotateCcw} label="Resubmit" onClick={onResubmit} />}
        </div>
      )}
    </div>
  );
}

function CardAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-btn k-btn-ghost k-btn-sm"
      style={{ height: 22, padding: "0 6px", fontSize: 10.5 }}
    >
      <Icon size={11} aria-hidden /> {label}
    </button>
  );
}
