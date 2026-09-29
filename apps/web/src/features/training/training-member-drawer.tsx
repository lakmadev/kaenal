"use client";

import { useEffect, useMemo, useRef } from "react";
import { Download, Plus, X } from "lucide-react";
import type { CompetencyDto, TrainingMatrixCellDto, TrainingRecordDto } from "@kaenal/types";
import { useTrainingRecords } from "@/hooks/use-training";
import { useDownloadFile } from "@/hooks/use-files";
import { Avatar } from "@/components/avatar";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { apiErrorInfo, errorMessage } from "@/lib/api-error";
import { shortDate } from "@/lib/format";

const STATE_LABEL: Record<TrainingMatrixCellDto["state"], string> = {
  ok: "Certified",
  warn: "Expiring",
  overdue: "Overdue",
  gap: "Gap — mandatory, never trained",
  na: "N/A",
};

const STATE_COLOR: Record<TrainingMatrixCellDto["state"], { bg: string; fg: string }> = {
  ok: { bg: "var(--success-100)", fg: "var(--success-700)" },
  warn: { bg: "rgba(245,158,11,0.14)", fg: "#92400e" },
  overdue: { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
  gap: { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
  na: { bg: "var(--bg-subtle)", fg: "var(--text-muted)" },
};

/**
 * Board 7 — the training matrix's member drawer. No jsx precedent (the mock
 * has no click-through state); the shell follows `GraphDetailDrawer`'s
 * right-side slide-in, the row shape follows `CalibrationManagement`'s own
 * History table (Date/Result/Evidence), per DESIGN-05 §4.7. Reads the member's
 * FULL history (T1 AC9), including rows against an archived competency (T5's
 * own history-preservation promise) — grouped per competency with a
 * current-state chip, newest record first within each group.
 */
export function TrainingMemberDrawer({
  memberId,
  memberName,
  title,
  cells,
  competencies,
  canManage,
  focusCompetencyId,
  onClose,
  onRecordTraining,
}: {
  memberId: string;
  memberName: string;
  title: string | null;
  cells: readonly TrainingMatrixCellDto[];
  competencies: readonly CompetencyDto[];
  canManage: boolean;
  focusCompetencyId?: string | null | undefined;
  onClose: () => void;
  onRecordTraining: (competencyId?: string) => void;
}): React.ReactElement {
  const records = useTrainingRecords({ memberId, limit: 200 });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Group every history row by competency (including archived competencies —
  // T1 AC9's own promise), newest first within each group.
  const grouped = useMemo(() => {
    const rows = records.data?.items ?? [];
    const byCompetency = new Map<string, TrainingRecordDto[]>();
    for (const r of rows) {
      const list = byCompetency.get(r.competencyId) ?? [];
      list.push(r);
      byCompetency.set(r.competencyId, list);
    }
    for (const list of byCompetency.values()) list.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
    return byCompetency;
  }, [records.data]);

  const competencyById = useMemo(() => new Map(competencies.map((c) => [c.id, c])), [competencies]);
  const cellByCompetency = useMemo(() => new Map(cells.map((c) => [c.competencyId, c])), [cells]);

  // Every competency this member has either a live cell for (non-archived) or
  // a history row against (possibly archived) — so an archived competency's
  // past records still show, per T5's promise.
  const competencyIds = useMemo(() => {
    const ids = new Set<string>([...cellByCompetency.keys(), ...grouped.keys()]);
    return [...ids];
  }, [cellByCompetency, grouped]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${memberName}'s training history`}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-xl)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
      }}
    >
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Avatar name={memberName} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{memberName}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{title ?? "—"}</div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="k-btn-plain" style={{ padding: 6, borderRadius: "var(--r-md)" }} aria-label="Close">
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "16px 18px", minHeight: 0, overflowY: "auto" }}>
        {records.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : records.isError ? (
          <EmptyState
            title="Couldn't load this member's training history"
            body={apiErrorInfo(records.error)?.message ?? "Something went wrong."}
            action={
              <Button variant="ghost" size="sm" onClick={() => void records.refetch()}>
                Retry
              </Button>
            }
          />
        ) : competencyIds.length === 0 ? (
          <EmptyState title="No training recorded" body="Nothing has been recorded for this member yet." />
        ) : (
          <div className="flex flex-col gap-4">
            {competencyIds.map((competencyId) => {
              const competency = competencyById.get(competencyId);
              const cell = cellByCompetency.get(competencyId);
              const history = grouped.get(competencyId) ?? [];
              const state = cell?.state;
              return (
                <CompetencyGroup
                  key={competencyId}
                  name={competency?.name ?? "(archived competency)"}
                  archived={competency?.archivedAt != null}
                  state={state}
                  history={history}
                  highlighted={focusCompetencyId === competencyId}
                  canManage={canManage}
                  onRecordTraining={() => onRecordTraining(competencyId)}
                />
              );
            })}
          </div>
        )}
      </div>

      {canManage && (
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
          <Button variant="primary" onClick={() => onRecordTraining()}>
            <Plus size={14} aria-hidden /> Record training
          </Button>
        </div>
      )}
    </div>
  );
}

function CompetencyGroup({
  name,
  archived,
  state,
  history,
  highlighted,
  canManage,
  onRecordTraining,
}: {
  name: string;
  archived: boolean;
  state: TrainingMatrixCellDto["state"] | undefined;
  history: TrainingRecordDto[];
  highlighted: boolean;
  canManage: boolean;
  onRecordTraining: () => void;
}): React.ReactElement {
  return (
    <div
      className="k-surface p-3"
      style={highlighted ? { outline: "2px solid var(--accent)", outlineOffset: 2 } : undefined}
    >
      <div className="mb-2 flex items-center gap-2">
        <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{name}</span>
        {archived && (
          <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
            Archived
          </span>
        )}
        {state !== undefined && (
          <span className="k-chip" style={{ background: STATE_COLOR[state].bg, color: STATE_COLOR[state].fg }}>
            {STATE_LABEL[state]}
          </span>
        )}
        {canManage && !archived && (
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onRecordTraining}>
            <Plus size={12} aria-hidden /> Record
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>No completion recorded — this is a gap.</p>
      ) : (
        <table className="k-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Completed</th>
              <th>Expires</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 12 }}>{shortDate(r.completedAt)}</td>
                <td style={{ fontSize: 12 }}>{r.expiresAt !== null ? shortDate(r.expiresAt) : "Never"}</td>
                <td>
                  <EvidenceLink fileId={r.evidenceFileId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EvidenceLink({ fileId }: { fileId: string | null }): React.ReactElement {
  const toast = useToast();
  const download = useDownloadFile();
  if (fileId === null) return <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>—</span>;
  return (
    <button
      type="button"
      className="k-btn-plain"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--accent)" }}
      disabled={download.isPending}
      onClick={() =>
        download.mutate(
          { id: fileId, disposition: "attachment" },
          {
            onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
            onError: (e) => toast.error(errorMessage(e)),
          },
        )
      }
    >
      <Download size={12} aria-hidden /> Download
    </button>
  );
}
