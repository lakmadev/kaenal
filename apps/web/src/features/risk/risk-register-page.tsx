"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Pencil, Plus, RefreshCw } from "lucide-react";
import { matrixCounts, scoreBand, type RiskScoreBand } from "@kaenal/core";
import type { RiskCategory, RiskDto } from "@kaenal/types";
import { useCan, useMe } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { useRisk, useRiskBoardPackExport, useRisks, useRisksSummary } from "@/hooks/use-risks";
import { PageHeader } from "@/components/page-header";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { apiErrorInfo } from "@/lib/api-error";
import { shortDate } from "@/lib/format";
import { RiskEditDialog } from "./risk-edit-dialog";
import { RiskControlsEditor } from "./risk-controls-editor";
import { RiskLinkedRecords } from "./risk-linked-records";

/**
 * Score-band color tokens (R1 §3.1 thresholds, `scoreBand` in
 * `@kaenal/core`). Exported so other surfaces that render a risk's score —
 * e.g. FMEA's `FmeaLinkedRisks` reverse pane (SPRINT-04 R3, DESIGN-04 §11
 * fix 2) — reuse this exact register coloring rather than inventing their
 * own.
 */
export const BAND_COLOR: Record<RiskScoreBand, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#f59e0b",
  low: "#22c55e",
};

const CATEGORY_COLOR: Record<RiskCategory, string> = {
  supply: "#2563eb",
  process: "#0d9488",
  compliance: "#7c3aed",
  quality: "#dc2626",
  cyber: "#1e293b",
  people: "#f59e0b",
  environmental: "#16a34a",
  financial: "#94a3b8",
  reputation: "#db2777",
};

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  supply: "Supply",
  process: "Process",
  compliance: "Compliance",
  cyber: "Cyber",
  people: "People",
  quality: "Quality",
  environmental: "Environmental",
  financial: "Financial",
  reputation: "Reputation",
};

const TREATMENT_LABEL: Record<string, string> = {
  mitigate: "mitigate",
  accept: "accept",
  transfer: "transfer",
  avoid: "avoid",
};

export function ScoreChip({ score }: { score: number }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center justify-center rounded font-bold text-white"
      style={{ width: 28, height: 22, fontSize: 11, background: BAND_COLOR[scoreBand(score)] }}
    >
      {score}
    </span>
  );
}

/**
 * `/risk` — the risk register (SPRINT-04 R1-R5; `qms-risk-spc.jsx`
 * `RiskRegister`, lines 1-224). The KPI strip, heat map and category panel all
 * come from `GET /v1/risks/summary` (real, tenant-wide counts — never the
 * jsx's static 47/4/2/12/87% mock). The heat map's cell counts are derived
 * from the currently-loaded register page via `packages/core`'s
 * `matrixCounts` — the same pure function the click-to-filter interaction
 * reads — never re-implemented banding logic in this component.
 */
export function RiskRegisterPage(): React.ReactElement {
  const { data: me, isLoading: meLoading } = useMe();
  const canView = useCan("risk:view");
  const canManage = useCan("risk:manage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const members = useMemberLookup();

  const [cell, setCell] = useState<{ likelihood: number; impact: number } | null>(null);
  const [editing, setEditing] = useState<{ risk: RiskDto; focusScore: boolean } | null>(null);

  const all = useRisks({ limit: 100 });
  const summary = useRisksSummary();
  const filtered = useRisks(cell !== null ? { likelihood: cell.likelihood, impact: cell.impact, limit: 100 } : undefined);
  const boardPack = useRiskBoardPackExport();

  const urlId = searchParams.get("id");
  const selected = useRisk(urlId);

  function selectRisk(id: string): void {
    router.push(`/risk?id=${id}`, { scroll: false });
  }

  if (meLoading || all.isPending || summary.isPending) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
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
          <EmptyState title="No access" body="You don't have permission to view the risk register." />
        </Card>
      </div>
    );
  }

  if (all.isError || summary.isError) {
    const info = apiErrorInfo(all.error ?? summary.error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-7xl p-6">
          <Card>
            <EmptyState title="No access" body="You don't have permission to view the risk register." />
          </Card>
        </div>
      );
    }
    const message = info?.message ?? "Something went wrong.";
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState
            title="Couldn't load the risk register"
            body={info?.requestId !== undefined ? `${message} (request ${info.requestId})` : message}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  void all.refetch();
                  void summary.refetch();
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

  const risks = all.data?.items ?? [];
  const s = summary.data;
  const grid = matrixCounts(risks);
  const categories = Object.entries(s?.byCategory ?? {})
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a) as [RiskCategory, number][];
  const maxCategory = Math.max(1, ...categories.map(([, n]) => n));

  const tableRisks = cell !== null ? (filtered.data?.items ?? []) : risks;
  const selectedRisk = selected.data ?? null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <OfflineBanner />
      <PageHeader
        title="Risk register"
        description="ISO 31000 risk register with treatment plans, residual scoring, and quarterly review schedule."
        actions={
          <>
            <ExportButton report={boardPack} disabled={s === undefined || s.total === 0} />
            {canManage && (
              <Button variant="primary" onClick={() => router.push("/create/risk")}>
                <Plus size={14} aria-hidden /> Add risk
              </Button>
            )}
          </>
        }
      />

      {s !== undefined && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiTile label="Total risks" value={String(s.total)} color="#2563eb" />
          <KpiTile label="High residual (≥ 10)" value={String(s.highResidual)} color="#dc2626" />
          <KpiTile label="Treatments overdue" value={String(s.treatmentsOverdue)} color="#f59e0b" />
          <KpiTile label="Accepted" value={String(s.accepted)} color="#475569" />
          <KpiTile label="Reviewed this quarter" value={s.reviewedThisQuarterPct !== null ? `${Math.round(s.reviewedThisQuarterPct)}%` : "—"} color="#16a34a" />
        </div>
      )}

      {s !== undefined && s.total === 0 ? (
        <Card>
          <EmptyState
            title="No risks yet"
            body={
              canManage
                ? "Add a risk to start building the register — score its likelihood and impact to place it on the heat map."
                : "No risks have been added yet."
            }
            {...(canManage
              ? {
                  action: (
                    <Button variant="primary" onClick={() => router.push("/create/risk")}>
                      <Plus size={14} aria-hidden /> Add risk
                    </Button>
                  ),
                }
              : {})}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>5×5 heat map — residual risk</CardTitle>
              </CardHeader>
              <CardContent>
                <HeatMap grid={grid} activeCell={cell} onCellClick={(next) => setCell((c) => (c !== null && c.likelihood === next.likelihood && c.impact === next.impact ? null : next))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By category</CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-[12px] text-muted">No categories yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {categories.map(([cat, n]) => (
                      <div key={cat}>
                        <div className="mb-0.5 flex justify-between text-[12px]">
                          <span>{CATEGORY_LABEL[cat]}</span>
                          <span className="mono font-semibold">{n}</span>
                        </div>
                        <div className="h-[5px] overflow-hidden rounded-sm" style={{ background: "var(--bg-subtle)" }}>
                          <div style={{ width: `${(n / maxCategory) * 100}%`, height: "100%", background: CATEGORY_COLOR[cat] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Register</CardTitle>
                {cell !== null && (
                  <div className="flex items-center gap-2">
                    <span className="k-chip" style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}>
                      Filtered: Likelihood {cell.likelihood} × Impact {cell.impact}
                    </span>
                    <button type="button" className="k-btn k-btn-plain" style={{ height: 24, padding: "2px 8px" }} onClick={() => setCell(null)}>
                      ✕ Clear filter
                    </button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {(cell !== null ? filtered.isPending : false) ? (
                  <Skeleton className="h-40 w-full" />
                ) : tableRisks.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-muted">No risks at this likelihood × impact.</p>
                ) : (
                  <table className="k-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Risk</th>
                        <th>L</th>
                        <th>I</th>
                        <th>Score</th>
                        <th>Treatment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRisks.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer"
                          style={r.id === urlId ? { background: "var(--accent-soft)" } : undefined}
                          onClick={() => selectRisk(r.id)}
                        >
                          <td className="mono" style={{ fontSize: 11.5 }}>
                            {r.code}
                          </td>
                          <td style={{ fontSize: 12.5, maxWidth: 320 }}>{r.title}</td>
                          <td className="mono" style={{ textAlign: "center" }}>
                            {r.likelihood}
                          </td>
                          <td className="mono" style={{ textAlign: "center" }}>
                            {r.impact}
                          </td>
                          <td>
                            <ScoreChip score={r.residualScore} />
                            {r.trend === "up" && <span style={{ color: "#dc2626", marginLeft: 4, fontSize: 11 }}>↑</span>}
                            {r.trend === "down" && <span style={{ color: "#16a34a", marginLeft: 4, fontSize: 11 }}>↓</span>}
                          </td>
                          <td>
                            <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                              {TREATMENT_LABEL[r.treatment] ?? r.treatment}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {all.data?.nextCursor != null && cell === null && (
                  <p className="mt-2 text-center text-[12px] text-subtle">Showing the first {risks.length}. Pagination lands with the shared table.</p>
                )}
              </CardContent>
            </Card>

            <RiskDetailCard
              risk={selectedRisk}
              loading={selected.isLoading && urlId !== null}
              canManage={canManage}
              onEdit={(r, focusScore) => setEditing({ risk: r, focusScore })}
              memberName={members.nameOf}
            />
          </div>
        </>
      )}

      {editing !== null && <RiskEditDialog risk={editing.risk} focusScore={editing.focusScore} onClose={() => setEditing(null)} />}
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

function ExportButton({ report, disabled }: { report: ReturnType<typeof useRiskBoardPackExport>; disabled: boolean }): React.ReactElement {
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
      <Download size={13} aria-hidden /> {report.isFailed ? "Retry board pack" : "Board pack"}
    </Button>
  );
}

function HeatMap({
  grid,
  activeCell,
  onCellClick,
}: {
  grid: number[][];
  activeCell: { likelihood: number; impact: number } | null;
  onCellClick: (cell: { likelihood: number; impact: number }) => void;
}): React.ReactElement {
  const total = grid.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
      <div
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: 10,
          color: "var(--text-muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "8px 0",
        }}
      >
        Impact →
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", padding: "4px 4px 28px", textAlign: "right" }}>
        {[5, 4, 3, 2, 1].map((i) => (
          <div key={i}>{i}</div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {[5, 4, 3, 2, 1].map((impact) =>
            [1, 2, 3, 4, 5].map((likelihood) => {
              const count = grid[likelihood - 1]?.[impact - 1] ?? 0;
              const score = likelihood * impact;
              const isActive = activeCell !== null && activeCell.likelihood === likelihood && activeCell.impact === impact;
              const bg = total === 0 ? "var(--bg-subtle)" : `${BAND_COLOR[scoreBand(score)]}${count ? "cc" : "30"}`;
              return (
                <button
                  key={`${likelihood}-${impact}`}
                  type="button"
                  onClick={() => onCellClick({ likelihood, impact })}
                  aria-label={`Likelihood ${likelihood}, impact ${impact}: ${count} risk${count === 1 ? "" : "s"}`}
                  aria-pressed={isActive}
                  style={{
                    aspectRatio: "1",
                    background: bg,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: count ? 16 : 11,
                    fontWeight: count ? 700 : 400,
                    color: total === 0 ? "var(--text-subtle)" : count ? "white" : "rgba(255,255,255,0.5)",
                    boxShadow: isActive ? "0 0 0 2px var(--accent), 0 0 0 4px var(--accent-soft)" : undefined,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {total === 0 ? "0" : count || score}
                </button>
              );
            }),
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 6, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i}>{i}</div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 6 }}>
          Likelihood →
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, marginTop: 14, justifyContent: "center" }}>
          <Legend color={BAND_COLOR.low} label="Low (1-5)" />
          <Legend color={BAND_COLOR.medium} label="Medium (6-9)" />
          <Legend color={BAND_COLOR.high} label="High (10-15)" />
          <Legend color={BAND_COLOR.critical} label="Critical (16-25)" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }): React.ReactElement {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="k-overline" style={{ marginBottom: 2 }}>
        {k}
      </div>
      <div style={{ fontSize: 12.5 }}>{v}</div>
    </div>
  );
}

function RiskDetailCard({
  risk,
  loading,
  canManage,
  onEdit,
  memberName,
}: {
  risk: RiskDto | null;
  loading: boolean;
  canManage: boolean;
  onEdit: (risk: RiskDto, focusScore: boolean) => void;
  memberName: (userId: string | null | undefined) => string;
}): React.ReactElement {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (risk === null) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-[12px] text-muted">Select a risk to see its detail.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{risk.code}</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-muted">{risk.title}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3.5 grid grid-cols-2 gap-2">
          <Field k="Category" v={CATEGORY_LABEL[risk.category]} />
          <Field k="Owner" v={memberName(risk.owner)} />
          <Field k="Likelihood" v={`${risk.likelihood} / 5`} />
          <Field k="Impact" v={`${risk.impact} / 5`} />
          <Field k="Inherent score" v={risk.inherentScore} />
          <Field k="Residual score" v={<ScoreChip score={risk.residualScore} />} />
          <Field k="Trend" v={risk.trend} />
          <Field k="Treatment" v={TREATMENT_LABEL[risk.treatment] ?? risk.treatment} />
          <Field k="Status" v={risk.status} />
          <Field k="Review due" v={risk.reviewDue !== null ? shortDate(risk.reviewDue) : "—"} />
        </div>

        <div className="k-overline mb-1.5">Treatment plan</div>
        <div className="mb-3.5 rounded-md p-2.5 text-[12px] leading-relaxed" style={{ background: "var(--bg-subtle)" }}>
          {risk.plan !== "" ? risk.plan : <span className="text-muted">No treatment plan recorded.</span>}
        </div>

        <div className="mb-3.5">
          <RiskControlsEditor risk={risk} canManage={canManage} />
        </div>

        <div className="mb-3.5">
          <RiskLinkedRecords risk={risk} canManage={canManage} />
        </div>

        {canManage && (
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => onEdit(risk, false)}>
              <Pencil size={12} aria-hidden /> Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(risk, true)}>
              <RefreshCw size={12} aria-hidden /> Re-score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
