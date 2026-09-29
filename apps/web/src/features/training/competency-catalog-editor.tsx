"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import type { CompetencyDto } from "@kaenal/types";
import {
  useArchiveCompetency,
  useCompetencies,
  useCreateCompetency,
  useReorderCompetencies,
  useUnarchiveCompetency,
  useUpdateCompetency,
} from "@/hooks/use-training";
import { Button, Dialog, DialogContent, EmptyState, Skeleton, useToast } from "@/components/ui";
import { apiErrorInfo, errorMessage } from "@/lib/api-error";

interface Draft {
  id: string | null;
  code: string;
  name: string;
  mandatory: boolean;
  validMonths: string;
}

const EMPTY_DRAFT: Draft = { id: null, code: "", name: "", mandatory: false, validMonths: "" };

/**
 * Board 9 — the competency catalog admin surface (T5, T1 AC3/AC6). No jsx
 * precedent — `TrainingMatrix`'s columns are a read-only display of a
 * hardcoded array; entry point is the Training page's "Manage competencies"
 * header button, gated `training:manage`. Nearest existing pattern:
 * `risk-controls-editor.tsx` (inline add/edit rows + Up/Down reorder), per
 * DESIGN-05 §4.9. Archive (never delete, per the design's Round-2 correction)
 * is a plain neutral-ink action since it is fully reversible.
 */
export function CompetencyCatalogEditor({ canManage, onClose }: { canManage: boolean; onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const active = useCompetencies({ limit: 100 });
  const archived = useCompetencies({ status: "archived", limit: 100 });
  const create = useCreateCompetency();
  const update = useUpdateCompetency();
  const archive = useArchiveCompetency();
  const unarchive = useUnarchiveCompetency();
  const reorder = useReorderCompetencies();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<CompetencyDto | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [err, setErr] = useState("");

  const rows = [...(active.data?.items ?? [])].sort((a, b) => a.seq - b.seq);
  const archivedRows = archived.data?.items ?? [];

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((r) => r.id);
    const tmp = ids[index];
    const other = ids[target];
    if (tmp === undefined || other === undefined) return;
    ids[index] = other;
    ids[target] = tmp;
    reorder.mutate(
      { ids },
      {
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  function submitDraft(): void {
    if (draft === null) return;
    const code = draft.code.trim();
    const name = draft.name.trim();
    if (code === "" || name === "") {
      setErr("Enter a code and a name.");
      return;
    }
    const validMonths = draft.validMonths.trim() === "" ? null : Number(draft.validMonths);
    if (validMonths !== null && (!Number.isInteger(validMonths) || validMonths <= 0)) {
      setErr("Valid months must be a positive whole number, or left blank.");
      return;
    }
    setErr("");
    if (draft.id === null) {
      create.mutate(
        { code, name, mandatory: draft.mandatory, validMonths },
        {
          onSuccess: () => setDraft(null),
          onError: (e) => setErr(apiErrorInfo(e)?.status === 409 ? "That code is already in use." : errorMessage(e)),
        },
      );
    } else {
      const existing = rows.find((r) => r.id === draft.id);
      if (existing === undefined) return;
      update.mutate(
        { id: draft.id, body: { code, name, mandatory: draft.mandatory, validMonths, lockVersion: existing.lockVersion } },
        {
          onSuccess: () => setDraft(null),
          onError: (e) => setErr(apiErrorInfo(e)?.status === 409 ? "That code is already in use." : errorMessage(e)),
        },
      );
    }
  }

  function doArchive(c: CompetencyDto): void {
    archive.mutate(
      { id: c.id, body: { lockVersion: c.lockVersion } },
      {
        onSuccess: () => setConfirmArchive(null),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  function doUnarchive(c: CompetencyDto): void {
    unarchive.mutate(
      { id: c.id, body: { lockVersion: c.lockVersion } },
      { onError: (e) => (apiErrorInfo(e)?.status === 409 ? toast.error("That code is now in use by another competency.") : toast.error(errorMessage(e))) },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Manage competencies" description="Add, edit, reorder or archive the tenant's training catalog.">
        <div className="flex flex-col gap-2" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          {active.isPending ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : active.isError ? (
            <EmptyState
              title="Couldn't load the catalog"
              body={apiErrorInfo(active.error)?.message ?? "Something went wrong."}
              action={
                <Button variant="ghost" size="sm" onClick={() => void active.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : rows.length === 0 && draft === null ? (
            <EmptyState
              title="No competencies defined"
              body={canManage ? "Add a competency to start building the catalog." : "No competencies have been added yet."}
              {...(canManage ? { action: <AddButton onClick={() => setDraft(EMPTY_DRAFT)} /> } : {})}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[12px]" style={{ background: "var(--bg-subtle)" }}>
                  {c.mandatory && (
                    <span style={{ color: "var(--danger-600)" }} aria-label="Mandatory">
                      *
                    </span>
                  )}
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="mono text-[10.5px] text-muted">{c.code}</span>
                  <span className="text-[10.5px] text-muted">{c.validMonths !== null ? `${c.validMonths}mo` : "no expiry"}</span>
                  {canManage && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="k-btn k-btn-icon k-btn-plain"
                        aria-label={`Move ${c.name} up`}
                        disabled={i === 0 || reorder.isPending}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="k-btn k-btn-icon k-btn-plain"
                        aria-label={`Move ${c.name} down`}
                        disabled={i === rows.length - 1 || reorder.isPending}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="k-btn k-btn-icon k-btn-plain"
                        aria-label={`Edit ${c.name}`}
                        onClick={() =>
                          setDraft({ id: c.id, code: c.code, name: c.name, mandatory: c.mandatory, validMonths: c.validMonths?.toString() ?? "" })
                        }
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="k-btn k-btn-icon k-btn-plain"
                        aria-label={`Archive ${c.name}`}
                        onClick={() => setConfirmArchive(c)}
                      >
                        <Archive size={12} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
              {canManage && draft === null && <AddButton onClick={() => setDraft(EMPTY_DRAFT)} />}
            </div>
          )}

          {draft !== null && (
            <div className="k-surface mt-1 flex flex-col gap-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="k-overline" style={{ fontSize: 10 }}>
                    Code
                  </span>
                  <input className="k-input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} autoFocus />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="k-overline" style={{ fontSize: 10 }}>
                    Valid months (blank = never expires)
                  </span>
                  <input
                    type="number"
                    min={1}
                    className="k-input"
                    value={draft.validMonths}
                    onChange={(e) => setDraft({ ...draft, validMonths: e.target.value })}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="k-overline" style={{ fontSize: 10 }}>
                  Name
                </span>
                <input className="k-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.mandatory} onChange={(e) => setDraft({ ...draft, mandatory: e.target.checked })} />
                <span style={{ fontSize: 12 }}>Mandatory — a gap for members with no record shows on the matrix and KPI</span>
              </label>
              {err !== "" && (
                <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
                  {err}
                </div>
              )}
              <div className="mt-1 flex gap-2">
                <Button variant="ghost" onClick={() => (setDraft(null), setErr(""))}>
                  Cancel
                </Button>
                <Button variant="primary" loading={create.isPending || update.isPending} onClick={submitDraft}>
                  Save competency
                </Button>
              </div>
            </div>
          )}

          <button type="button" className="k-btn k-btn-ghost mt-1 self-start" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide" : "Show"} archived ({archivedRows.length})
          </button>

          {showArchived && (
            <div className="flex flex-col gap-1">
              {archivedRows.length === 0 ? (
                <p style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>No archived competencies.</p>
              ) : (
                archivedRows.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[12px]" style={{ opacity: 0.7 }}>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                      Archived
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        className="k-btn k-btn-ghost k-btn-sm"
                        onClick={() => doUnarchive(c)}
                        disabled={unarchive.isPending}
                      >
                        <ArchiveRestore size={12} aria-hidden /> Un-archive
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {confirmArchive !== null && (
        <Dialog open onOpenChange={(o) => !o && setConfirmArchive(null)}>
          <DialogContent title={`Archive "${confirmArchive.name}"?`}>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-muted)" }}>
              It stops appearing on the training matrix, coverage KPIs, gap calculations and due/expiry notifications
              from now on. {confirmArchive.trainingRecordCount}{" "}
              {confirmArchive.trainingRecordCount === 1 ? "member's" : "members'"} existing training records against
              it are kept and stay visible in each member&rsquo;s own history — nothing is deleted. You can un-archive
              it at any time to bring it back.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmArchive(null)}>
                Cancel
              </Button>
              <Button variant="primary" loading={archive.isPending} onClick={() => doArchive(confirmArchive)}>
                Archive competency
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

function AddButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" className="k-btn k-btn-ghost self-start" onClick={onClick}>
      <Plus size={13} aria-hidden /> Add competency
    </button>
  );
}
