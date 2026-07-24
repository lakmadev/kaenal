"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Calendar } from "lucide-react";
import type { NcrDto, NcrStatus, NcrTransition } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { PriorityBadge, useToast } from "@/components/ui";
import { useTransitionNcr, useVerifyNcr } from "@/hooks/use-ncrs";

/** Board columns (matches the prototype). `verified` is reached via the four-eyes
 *  verify endpoint, not a plain transition; the rest are transitions. */
const COLUMNS: { key: NcrStatus; label: string; dot: string }[] = [
  { key: "open", label: "Open", dot: "#3b82f6" },
  { key: "assigned", label: "Assigned", dot: "#6366f1" },
  { key: "in_progress", label: "In Progress", dot: "#f59e0b" },
  { key: "resolved", label: "Resolved", dot: "#22c55e" },
  { key: "verified", label: "Verified", dot: "#10b981" },
  { key: "closed", label: "Closed", dot: "#64748b" },
];

/**
 * Kanban (04 §5 NCR): drag a card to a column to transition it. The move is
 * optimistic (the card jumps immediately via a local override); on any failure —
 * a 409 stale-write, or an illegal transition the server rejects — the card
 * snaps back and a toast explains (04 §9). The server is the source of truth for
 * which transitions are legal; the client just attempts and reconciles.
 */
export function NcrKanban({ ncrs, meId }: { ncrs: NcrDto[]; meId: string | undefined }): React.ReactElement {
  const toast = useToast();
  const router = useRouter();
  const transition = useTransitionNcr();
  const verify = useVerifyNcr();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Optimistic overrides: ncrId → the status we moved it to, held until the
  // refetched data catches up (flicker-free) or the mutation fails (revert).
  const [override, setOverride] = useState<Record<string, NcrStatus>>({});

  useEffect(() => {
    setOverride((prev) => {
      let changed = false;
      const next: Record<string, NcrStatus> = {};
      for (const [id, status] of Object.entries(prev)) {
        const real = ncrs.find((n) => n.id === id);
        if (real !== undefined && real.status === status) changed = true; // server caught up → drop
        else next[id] = status;
      }
      return changed ? next : prev;
    });
  }, [ncrs]);

  const displayStatus = (n: NcrDto): NcrStatus => override[n.id] ?? n.status;

  function onDragEnd(e: DragEndEvent): void {
    const id = String(e.active.id);
    const target = e.over?.id as NcrStatus | undefined;
    if (target === undefined) return;
    const ncr = ncrs.find((n) => n.id === id);
    if (ncr === undefined || displayStatus(ncr) === target) return;

    const revert = (err: unknown): void => {
      setOverride((p) => {
        const { [id]: _drop, ...rest } = p;
        return rest;
      });
      toast.error(errorMessage(err));
    };

    setOverride((p) => ({ ...p, [id]: target }));

    if (target === "verified") {
      verify.mutate({ id, body: { version: ncr.lockVersion } }, { onError: revert });
      return;
    }
    if (target === "assigned") {
      if (meId === undefined) {
        revert(new Error("Can't assign — no current user."));
        return;
      }
      transition.mutate(
        { id, body: { to: "assigned", version: ncr.lockVersion, ownerId: meId } },
        { onError: revert },
      );
      return;
    }
    transition.mutate({ id, body: { to: target as NcrTransition, version: ncr.lockVersion } }, { onError: revert });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))` }}>
        {COLUMNS.map((col) => {
          const items = ncrs.filter((n) => displayStatus(n) === col.key);
          return (
            <Column key={col.key} col={col} count={items.length}>
              {items.map((n) => (
                <Card key={n.id} ncr={n} onOpen={() => router.push(`/ncrs/${n.id}`)} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}

function Column({
  col,
  count,
  children,
}: {
  col: { key: NcrStatus; label: string; dot: string };
  count: number;
  children: React.ReactNode;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className="flex min-h-[400px] flex-col gap-2">
      <div className="flex items-center gap-2 px-1.5">
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.dot }} />
        <span className="text-[12px] font-semibold uppercase tracking-wide">{col.label}</span>
        <span
          className="rounded-full px-1.5 text-[11px] text-muted"
          style={{ background: "var(--bg-subtle)" }}
        >
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-lg p-1 transition-colors",
          isOver && "outline-2 outline-dashed",
        )}
        style={isOver ? { outline: "2px dashed var(--accent)", background: "var(--bg-subtle)" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function Card({ ncr, onOpen }: { ncr: NcrDto; onOpen: () => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ncr.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={cn("k-surface flex cursor-grab flex-col gap-2 p-3 text-left active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <div className="flex items-center justify-between">
        <span className="mono text-[11px] font-semibold text-muted">{ncr.code}</span>
        <PriorityBadge priority={ncr.priority} />
      </div>
      <div className="text-[12.5px] font-medium leading-snug">{ncr.title}</div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Calendar size={11} />
          {shortDate(ncr.dueAt)}
        </span>
      </div>
    </div>
  );
}
