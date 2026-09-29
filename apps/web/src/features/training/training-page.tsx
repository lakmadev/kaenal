"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Settings2 } from "lucide-react";
import type { TrainingGapDto, TrainingMatrixCellDto, TrainingMatrixRowDto } from "@kaenal/types";
import { useCan, useMe } from "@/hooks/use-me";
import {
  useCompetencies,
  useSkillGapReportExport,
  useTrainingGaps,
  useTrainingMatrix,
  useTrainingRecord,
  useTrainingSummary,
} from "@/hooks/use-training";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/avatar";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Segmented, Skeleton } from "@/components/ui";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { apiErrorInfo } from "@/lib/api-error";
import { TrainingMemberDrawer } from "./training-member-drawer";
import { RecordTrainingDialog } from "./record-training-dialog";
import { CompetencyCatalogEditor } from "./competency-catalog-editor";

type MatrixFilter = "all" | "mandatory" | "gaps";

const STATE_COLOR: Record<TrainingMatrixCellDto["state"], { bg: string; label: string }> = {
  ok: { bg: "#22c55e", label: "Certified" },
  warn: { bg: "#f59e0b", label: "Expiring" },
  overdue: { bg: "#dc2626", label: "Overdue" },
  gap: { bg: "#dc2626", label: "Gap — mandatory, never trained" },
  na: { bg: "var(--bg-subtle)", label: "N/A" },
};

/**
 * `/training` — the training & competency matrix (SPRINT-05 T1-T5;
 * `qms-modules.jsx` `TrainingMatrix`, lines 1-166). KPI strip and matrix come
 * from `GET /v1/training/summary`/`GET /v1/training/matrix` (real counts, never
 * the jsx's static 412/88%/24/6 mock). The "Linked e-learning" card is
 * excluded entirely (Q-T1/DESIGN-05 §4.6) — no vendor decision exists.
 */
export function TrainingPage(): React.ReactElement {
  const { data: me, isLoading: meLoading } = useMe();
  const canView = useCan("training:view");
  const canManage = useCan("training:manage");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<MatrixFilter>("all");
  const [queryInput, setQueryInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [drawerMember, setDrawerMember] = useState<{ memberId: string; focusCompetencyId?: string } | null>(null);
  const [recordDialog, setRecordDialog] = useState<{ memberIds: string[]; competencyId?: string } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Debounce the free-text filter (genuine timer-driven side effect — no
  // render-time or event-handler equivalent exists for "wait, then fetch").
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  const summary = useTrainingSummary();
  const competencies = useCompetencies({ limit: 100 });
  const matrix = useTrainingMatrix({
    limit: 100,
    mandatoryOnly: filter === "mandatory" ? true : undefined,
    gapsOnly: filter === "gaps" ? true : undefined,
    q: debouncedQuery !== "" ? debouncedQuery : undefined,
  });
  const gaps = useTrainingGaps({ limit: 8 });
  const gapReport = useSkillGapReportExport();

  const recordIdParam = searchParams.get("recordId");
  const competencyIdParam = searchParams.get("competencyId");
  const deepLinkRecord = useTrainingRecord(recordIdParam);

  // Open the member drawer for a notification's `?recordId=` deep link (X1
  // AC5) once the record resolves — a genuine "URL changed, fetch, then open
  // a panel" effect, not derivable at render time (the record isn't loaded yet
  // on first render).
  useEffect(() => {
    if (deepLinkRecord.data === undefined) return;
    setDrawerMember({ memberId: deepLinkRecord.data.memberId, focusCompetencyId: deepLinkRecord.data.competencyId });
  }, [deepLinkRecord.data]);

  if (meLoading || summary.isPending || matrix.isPending || competencies.isPending) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canView && me !== undefined) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState title="No access" body="You don't have permission to view training & competency." />
        </Card>
      </div>
    );
  }

  if (summary.isError || matrix.isError || competencies.isError) {
    const info = apiErrorInfo(summary.error ?? matrix.error ?? competencies.error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-7xl p-6">
          <Card>
            <EmptyState title="No access" body="You don't have permission to view training & competency." />
          </Card>
        </div>
      );
    }
    const message = info?.message ?? "Something went wrong.";
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState
            title="Couldn't load the training module"
            body={info?.requestId !== undefined ? `${message} (request ${info.requestId})` : message}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  void summary.refetch();
                  void matrix.refetch();
                  void competencies.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const s = summary.data;
  const cols = [...(competencies.data?.items ?? [])].sort((a, b) => a.seq - b.seq);
  const rows = matrix.data?.items ?? [];
  const gapRows = gaps.data?.items ?? [];
  const meId = me?.userId;

  function openDrawer(row: TrainingMatrixRowDto, competencyId?: string): void {
    setDrawerMember({ memberId: row.memberId, ...(competencyId !== undefined ? { focusCompetencyId: competencyId } : {}) });
  }

  function closeDrawer(): void {
    setDrawerMember(null);
    if (recordIdParam !== null) router.replace("/training", { scroll: false });
  }

  const drawerRow = drawerMember !== null ? rows.find((r) => r.memberId === drawerMember.memberId) : undefined;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <OfflineBanner />
      <PageHeader
        title="Training & competency"
        description="Skill matrix, certifications and expirations across the tenant's tracked members."
        actions={
          <>
            {canView && (
              <ExportButton report={gapReport} disabled={s === undefined || s.membersTracked === 0} />
            )}
            {canManage && (
              <Button variant="ghost" onClick={() => setCatalogOpen(true)}>
                <Settings2 size={13} aria-hidden /> Manage competencies
              </Button>
            )}
            {canManage && (
              <Button variant="primary" onClick={() => setRecordDialog({ memberIds: [] })}>
                <Plus size={13} aria-hidden /> Assign training
              </Button>
            )}
          </>
        }
      />

      {s !== undefined && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Members tracked" value={String(s.membersTracked)} color="#2563eb" />
          <KpiTile label="Coverage" value={s.coverage !== null ? `${Math.round(s.coverage)}%` : "—"} color="#16a34a" />
          <KpiTile label="Expiring < 30 days" value={String(s.expiringSoon)} color="#f59e0b" />
          <KpiTile label="Overdue" value={String(s.overdue)} color="#dc2626" />
        </div>
      )}

      {cols.length === 0 ? (
        <Card>
          <EmptyState
            title="No competencies defined"
            body={canManage ? "Add a competency to start building the training matrix." : "No competencies have been added yet."}
            {...(canManage
              ? { action: <Button variant="primary" onClick={() => setCatalogOpen(true)}><Plus size={14} aria-hidden /> Add competency</Button> }
              : {})}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No members tracked yet" body="No members are visible to you yet." />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Competency matrix</CardTitle>
            <p className="text-[12px] text-muted">Rows: members. Columns: competencies. Click a cell to see history.</p>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                className="k-input"
                style={{ flex: 1, maxWidth: 280, height: 30 }}
                placeholder="Filter by name or role…"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
              />
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "mandatory", label: "Mandatory only" },
                  { value: "gaps", label: "Gaps" },
                ]}
              />
              <div className="ml-auto flex gap-3 text-[11px] text-muted">
                <Legend color="#22c55e" label="Certified" />
                <Legend color="#f59e0b" label="Expiring" />
                <Legend color="#dc2626" label="Overdue" />
                <Legend color="var(--bg-subtle)" label="N/A" outline />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "var(--surface)",
                        padding: "8px 10px",
                        borderBottom: "1px solid var(--border)",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        minWidth: 200,
                        zIndex: 1,
                      }}
                    >
                      Member
                    </th>
                    {cols.map((c) => (
                      <th
                        key={c.id}
                        style={{
                          padding: "8px 6px",
                          borderBottom: "1px solid var(--border)",
                          fontSize: 10,
                          fontWeight: 600,
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          height: 140,
                          verticalAlign: "bottom",
                          color: "var(--text)",
                          background: competencyIdParam === c.id ? "var(--accent-soft)" : undefined,
                        }}
                      >
                        {c.mandatory && <span style={{ color: "#dc2626" }}>*</span>}
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isOwnRow = meId !== undefined && row.memberId === meId;
                    const interactive = canManage || isOwnRow;
                    return (
                      <tr key={row.memberId}>
                        <td
                          style={{
                            position: "sticky",
                            left: 0,
                            background: "var(--surface)",
                            padding: "8px 10px",
                            borderBottom: "1px solid var(--border)",
                            zIndex: 1,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={row.memberName} size={26} />
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                                {row.memberName}
                                {isOwnRow ? " (you)" : ""}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{row.title ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        {cols.map((c) => {
                          const cell = row.cells.find((cl) => cl.competencyId === c.id);
                          if (cell === undefined) {
                            return <td key={c.id} style={{ padding: 4, borderBottom: "1px solid var(--border)" }} />;
                          }
                          const style = STATE_COLOR[cell.state];
                          const label = `${row.memberName}, ${c.name}, ${style.label}`;
                          const swatch = (
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                background: style.bg,
                                display: "inline-block",
                              }}
                            />
                          );
                          return (
                            <td key={c.id} style={{ padding: 4, textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                              {interactive ? (
                                <button
                                  type="button"
                                  aria-label={label}
                                  onClick={() => openDrawer(row, c.id)}
                                  style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", minWidth: 44, minHeight: 44 }}
                                >
                                  {swatch}
                                </button>
                              ) : (
                                <div aria-label={label} aria-disabled="true" style={{ display: "inline-block", cursor: "default" }}>
                                  {swatch}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {matrix.data?.nextCursor != null && (
              <p className="mt-2 text-center text-[12px] text-subtle">Showing the first {rows.length}. Pagination lands with the shared table.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expiring & overdue</CardTitle>
        </CardHeader>
        <CardContent>
          {gaps.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : gaps.isError ? (
            <EmptyState
              title="Couldn't load gaps"
              body={apiErrorInfo(gaps.error)?.message ?? "Something went wrong."}
              action={
                <Button variant="ghost" size="sm" onClick={() => void gaps.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : gapRows.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">No gaps, expiring or overdue certifications.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {gapRows.map((g) => (
                <GapRow
                  key={`${g.memberId}:${g.competencyId}`}
                  gap={g}
                  highlighted={competencyIdParam === g.competencyId}
                  canManage={canManage}
                  onSchedule={() => setRecordDialog({ memberIds: [g.memberId], competencyId: g.competencyId })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {drawerMember !== null && (
        <TrainingMemberDrawer
          memberId={drawerMember.memberId}
          memberName={drawerRow?.memberName ?? deepLinkRecord.data?.memberId ?? "Member"}
          title={drawerRow?.title ?? null}
          cells={drawerRow?.cells ?? []}
          competencies={cols}
          canManage={canManage}
          focusCompetencyId={drawerMember.focusCompetencyId ?? null}
          onClose={closeDrawer}
          onRecordTraining={(competencyId) => {
            setRecordDialog({ memberIds: [drawerMember.memberId], ...(competencyId !== undefined ? { competencyId } : {}) });
          }}
        />
      )}

      {recordDialog !== null && (
        <RecordTrainingDialog
          initialMemberIds={recordDialog.memberIds}
          {...(recordDialog.competencyId !== undefined ? { initialCompetencyId: recordDialog.competencyId } : {})}
          onClose={() => setRecordDialog(null)}
        />
      )}

      {catalogOpen && <CompetencyCatalogEditor canManage={canManage} onClose={() => setCatalogOpen(false)} />}
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <Card className="p-3">
      <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-[20px] font-bold" style={{ color }}>
        {value}
      </div>
    </Card>
  );
}

function Legend({ color, label, outline = false }: { color: string; label: string; outline?: boolean }): React.ReactElement {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, border: outline ? "1px solid var(--border)" : undefined }} />
      {label}
    </span>
  );
}

function ExportButton({ report, disabled }: { report: ReturnType<typeof useSkillGapReportExport>; disabled: boolean }): React.ReactElement {
  if (report.status === "completed" && report.downloadUrl !== null) {
    return (
      <a href={report.downloadUrl} download className="k-btn k-btn-ghost">
        <Download size={13} aria-hidden /> Download
      </a>
    );
  }
  if (report.isPreparing) {
    return (
      <Button variant="ghost" loading disabled>
        Preparing…
      </Button>
    );
  }
  return (
    <Button variant="ghost" onClick={report.trigger} disabled={disabled}>
      <Download size={13} aria-hidden /> {report.isFailed ? "Retry skill gap report" : "Skill gap report"}
    </Button>
  );
}

function GapRow({
  gap,
  highlighted,
  canManage,
  onSchedule,
}: {
  gap: TrainingGapDto;
  highlighted: boolean;
  canManage: boolean;
  onSchedule: () => void;
}): React.ReactElement {
  const blocking = gap.state === "overdue" || gap.state === "gap";
  const daysLeft = gap.expiresAt !== null ? Math.ceil((new Date(gap.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  return (
    <div
      className="flex items-center gap-2.5 rounded-md p-2.5"
      style={{
        background: blocking ? "rgba(220,38,38,0.06)" : "var(--bg-subtle)",
        borderLeft: blocking ? "3px solid #dc2626" : "3px solid #f59e0b",
        outline: highlighted ? "2px solid var(--accent)" : undefined,
        outlineOffset: highlighted ? 2 : undefined,
      }}
    >
      <Avatar name={gap.memberName} size={26} />
      <div className="flex-1">
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{gap.memberName}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{gap.competencyName}</div>
      </div>
      {gap.state === "gap" ? (
        <span className="k-chip" style={{ background: "rgba(220,38,38,0.15)", color: "#b91c1c" }}>
          Never trained
        </span>
      ) : gap.state === "overdue" ? (
        <span className="k-chip" style={{ background: "rgba(220,38,38,0.15)", color: "#b91c1c" }}>
          Overdue{daysLeft !== null ? ` ${Math.abs(daysLeft)}d` : ""}
        </span>
      ) : (
        <span className="k-chip" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>
          Expires in {daysLeft ?? 0}d
        </span>
      )}
      {canManage && (
        <button type="button" className="k-btn k-btn-secondary k-btn-sm" onClick={onSchedule}>
          Schedule
        </button>
      )}
    </div>
  );
}
