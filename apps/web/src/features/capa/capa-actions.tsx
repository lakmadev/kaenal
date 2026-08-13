"use client";

import { useState } from "react";
import { Plus, X, Check, Calendar, ChevronRight, ClipboardList } from "lucide-react";
import type { CapaActionDto, CapaActionStatus } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { Button, Input, StatusBadge, Skeleton, EmptyState, useToast } from "@/components/ui";
import { useCapaActions, useCreateCapaAction, useUpdateCapaActionStatus } from "@/hooks/use-capas";

/** The CAPA action status ladder (pending → in_progress → done → verified). */
const NEXT_STATUS: Record<CapaActionStatus, CapaActionStatus | null> = {
  pending: "in_progress",
  in_progress: "done",
  done: "verified",
  verified: null,
};
const NEXT_LABEL: Record<CapaActionStatus, string> = {
  pending: "Start",
  in_progress: "Mark done",
  done: "Verify",
  verified: "",
};
const isComplete = (s: CapaActionStatus): boolean => s === "done" || s === "verified";

/**
 * CAPA Action plan tab (04 §5) — the corrective/preventive actions of a CAPA,
 * backed by the real actions API (list / create / advance-status). Each advance
 * sends the action's `lockVersion`; a concurrent change surfaces as a toast, not
 * a silent overwrite (optimistic concurrency, rule 6). Faithful to `capa.jsx`'s
 * `CapaActionPlan`, adapted to the four-state server model.
 */
export function CapaActionPlan({ capaId, canManage }: { capaId: string; canManage: boolean }): React.ReactElement {
  const query = useCapaActions(capaId);
  const toast = useToast();
  const create = useCreateCapaAction(capaId);
  const updateStatus = useUpdateCapaActionStatus(capaId);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");

  if (query.isLoading) return <Skeleton className="h-40 rounded-xl" />;

  const actions = query.data?.items ?? [];
  const completed = actions.filter((a) => isComplete(a.status)).length;

  const submit = (): void => {
    if (description.trim() === "") return;
    create.mutate(
      { description: description.trim(), ...(due !== "" ? { dueAt: new Date(due).toISOString() } : {}) },
      {
        onSuccess: () => {
          toast.success("Action added");
          setDescription("");
          setDue("");
          setAdding(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const advance = (a: CapaActionDto): void => {
    const next = NEXT_STATUS[a.status];
    if (next === null) return;
    updateStatus.mutate(
      { id: a.id, body: { status: next, version: a.lockVersion } },
      { onError: (err) => toast.error(errorMessage(err)) },
    );
  };

  return (
    <div className="k-surface overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
        <div className="text-[13px] font-semibold">
          Action plan{actions.length > 0 && ` (${completed}/${actions.length} complete)`}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            {adding ? <X size={12} /> : <Plus size={12} />}
            {adding ? "Cancel" : "Add action"}
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-2.5 border-b border-border px-[18px] py-3.5" style={{ background: "var(--bg-subtle)" }}>
          <Input
            autoFocus
            placeholder="What action will be taken?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <div className="flex items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="k-overline">Due</span>
              <input type="date" className="k-input" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <Button
              variant="primary"
              size="sm"
              className="ml-auto"
              loading={create.isPending}
              onClick={submit}
              disabled={description.trim() === ""}
            >
              Add action
            </Button>
          </div>
        </div>
      )}

      {actions.length === 0 && !adding ? (
        <EmptyState icon={ClipboardList} title="No actions yet" body="Add corrective or preventive actions to this CAPA." />
      ) : (
        actions.map((a) => {
          const done = isComplete(a.status);
          const next = NEXT_STATUS[a.status];
          return (
            <div key={a.id} className="flex items-center gap-3 border-b border-border px-[18px] py-3 last:border-b-0">
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  border: done ? "none" : "2px solid var(--border-strong)",
                  background: done ? "var(--success-500)" : "transparent",
                  color: "white",
                }}
              >
                {done && <Check size={12} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[13px] font-medium"
                  style={{
                    textDecoration: done ? "line-through" : "none",
                    color: done ? "var(--text-muted)" : "var(--text)",
                  }}
                >
                  {a.description}
                </div>
                {a.dueAt !== null && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                    <Calendar size={11} /> {shortDate(a.dueAt)}
                  </div>
                )}
              </div>
              <StatusBadge status={a.status} />
              {canManage && next !== null && (
                <Button
                  size="sm"
                  loading={updateStatus.isPending}
                  onClick={() => advance(a)}
                  aria-label={`${NEXT_LABEL[a.status]} action`}
                >
                  {NEXT_LABEL[a.status]} <ChevronRight size={12} />
                </Button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
