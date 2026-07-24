"use client";

import { useState } from "react";
import { Plus, X, Check, Calendar } from "lucide-react";
import type { NcrActionDto, NcrActionKind } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { Button, Input, StatusBadge, Skeleton, useToast } from "@/components/ui";
import { useNcrActions, useCreateNcrAction, useUpdateNcrActionStatus } from "@/hooks/use-ncrs";

const GROUPS: { key: NcrActionKind; title: string; subtitle: string }[] = [
  { key: "containment", title: "Containment Actions", subtitle: "Immediate — stop the bleed" },
  { key: "corrective", title: "Corrective Actions", subtitle: "Permanent fix" },
  { key: "preventive", title: "Preventive Actions", subtitle: "Prevent recurrence" },
];

/**
 * NCR Actions tab (04 §5) — containment / corrective / preventive lists, each
 * backed by the real actions API (list / create / advance-status). Toggling an
 * action sends its `lockVersion`; a concurrent change surfaces as a toast, not a
 * silent overwrite (optimistic-concurrency, rule 6).
 */
export function NcrActionsTab({ ncrId }: { ncrId: string }): React.ReactElement {
  const query = useNcrActions(ncrId);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {GROUPS.map((g) => (
          <Skeleton key={g.key} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const all = query.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((g) => (
        <ActionGroup key={g.key} group={g} ncrId={ncrId} actions={all.filter((a) => a.kind === g.key)} />
      ))}
    </div>
  );
}

function ActionGroup({
  group,
  ncrId,
  actions,
}: {
  group: (typeof GROUPS)[number];
  ncrId: string;
  actions: NcrActionDto[];
}): React.ReactElement {
  const toast = useToast();
  const create = useCreateNcrAction(ncrId);
  const updateStatus = useUpdateNcrActionStatus(ncrId);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");

  const submit = (): void => {
    if (description.trim() === "") return;
    create.mutate(
      {
        kind: group.key,
        description: description.trim(),
        ...(due !== "" ? { dueAt: new Date(due).toISOString() } : {}),
      },
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

  const toggle = (a: NcrActionDto): void => {
    const next = a.status === "done" ? "pending" : "done";
    updateStatus.mutate(
      { id: a.id, body: { status: next, version: a.lockVersion } },
      { onError: (err) => toast.error(errorMessage(err)) },
    );
  };

  return (
    <div className="k-surface overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <div className="text-[14px] font-semibold">{group.title}</div>
          <div className="mt-0.5 text-[11px] text-muted">{group.subtitle}</div>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={12} /> : <Plus size={12} />}
          {adding ? "Cancel" : "Add"}
        </Button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2.5 border-b border-border px-5 py-3.5" style={{ background: "var(--bg-subtle)" }}>
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
        <div className="px-5 py-4 text-[12px] text-subtle">No actions yet.</div>
      ) : (
        actions.map((a) => (
          <div key={a.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
            <button
              type="button"
              onClick={() => toggle(a)}
              aria-label={a.status === "done" ? "Mark not done" : "Mark done"}
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 20,
                height: 20,
                border: a.status === "done" ? "none" : "2px solid var(--border-strong)",
                background: a.status === "done" ? "var(--success-500)" : "transparent",
                color: "white",
              }}
            >
              {a.status === "done" && <Check size={12} strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className="text-[13px] font-medium"
                style={{
                  textDecoration: a.status === "done" ? "line-through" : "none",
                  color: a.status === "done" ? "var(--text-muted)" : "var(--text)",
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
          </div>
        ))
      )}
    </div>
  );
}
