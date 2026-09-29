"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import type { GaugeRrVerdict, MsaAnalysisComplete, MsaGaugeRrSourceDto, MsaStudyDto } from "@kaenal/types";
import { useCan, useMe } from "@/hooks/use-me";
import { useMsaAiagReportExport, useMsaAnalysis, useMsaStudies, useMsaStudy } from "@/hooks/use-msa";
import { PageHeader } from "@/components/page-header";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";
import { longDate } from "@/lib/format";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { MsaWizard } from "./msa-wizard";
import { MsaGrid } from "./msa-grid";

const METHOD_LABEL: Record<string, string> = {
  crossed_anova: "Crossed (ANOVA)",
  average_range: "Average & Range",
};

const VERDICT_STYLE: Record<GaugeRrVerdict, { label: string; fg: string; bg: string; border: string }> = {
  excellent: { label: "Excellent", fg: "var(--success-700)", bg: "var(--success-50)", border: "rgba(34,197,94,0.3)" },
  acceptable: { label: "Acceptable", fg: "var(--warning-700)", bg: "var(--warning-50)", border: "rgba(245,158,11,0.3)" },
  reject: { label: "Reject", fg: "var(--danger-700)", bg: "var(--danger-50)", border: "rgba(220,38,38,0.3)" },
};

/**
 * `/msa` — MSA / Gauge R&R (SPRINT-04 M1-M5; `qms-risk-spc.jsx` `MSAStudy`,
 * lines 549-671). KPI tiles, variance-components table, variation-by-source
 * chart and verdict banner all come from `GET .../analysis`, recomputed on
 * read — never hard-coded, never the jsx's 14.2%-style fixture. A study
 * missing measurements shows the honest "needs N more" state instead of a
 * fabricated result (M1 UC).
 */
export function MsaPage(): React.ReactElement {
  const { data: me, isLoading: meLoading } = useMe();
  const canView = useCan("msa:view");
  const canManage = useCan("msa:manage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(false);

  // No filter args, so the query key matches `useCreateMsaStudy`/`useCompleteMsaStudy`/
  // etc.'s `invalidateQueries({ queryKey: queryKeys.msa.list() })` exactly
  // (mirrors `useFmeas()`/`useAudits()`'s own no-arg default-list pattern).
  const list = useMsaStudies();
  const items = list.data?.items ?? [];
  const urlId = searchParams.get("id");
  // No explicit selection: default to the newest completed study, else the
  // newest study of any status, so the board always shows something real
  // rather than an arbitrary blank pick (M3 "active/selected study"). This
  // default is only ever taken ONCE per mount (below) — recomputing it on
  // every render would make the active study silently jump to a different
  // record the moment a mutation changes its `status` (e.g. reopen turns the
  // just-viewed study back to `draft`, so it would stop matching "newest
  // completed" and get swapped out from under the user).
  const defaultStudy = items.find((s) => s.status === "completed") ?? items[0] ?? null;
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Adjust state during render (React's documented pattern for "derive once
  // the data arrives", not a side effect on an external system) rather than
  // an effect: once the list has loaded and nothing is pinned yet, pin the
  // resolved default so later renders keep showing this same study.
  if (pinnedId === null && urlId === null && defaultStudy !== null) {
    setPinnedId(defaultStudy.id);
  }
  const activeId = urlId ?? pinnedId ?? defaultStudy?.id ?? null;
  const active = useMsaStudy(activeId);
  const analysis = useMsaAnalysis(activeId);
  const report = useMsaAiagReportExport(activeId);

  function select(id: string): void {
    setPinnedId(id);
    router.push(`/msa?id=${id}`, { scroll: false });
  }

  if (meLoading || list.isPending) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
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
          <EmptyState title="No access" body="You don't have permission to view MSA / Gauge R&R studies." />
        </Card>
      </div>
    );
  }

  if (list.isError) {
    const info = apiErrorInfo(list.error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-7xl p-6">
          <Card>
            <EmptyState title="No access" body="You don't have permission to view MSA / Gauge R&R studies." />
          </Card>
        </div>
      );
    }
    const message = info?.message ?? "Something went wrong.";
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState
            title="Couldn't load MSA studies"
            body={info?.requestId !== undefined ? `${message} (request ${info.requestId})` : message}
            action={
              <Button variant="ghost" onClick={() => void list.refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <OfflineBanner />
      <PageHeader
        title="MSA / Gauge R&R"
        description="Variable & attribute measurement system analysis. AIAG 4th Ed methods, % study variation."
        actions={
          <>
            <ExportButton report={report} disabled={activeId === null} />
            {canManage && (
              <Button variant="primary" onClick={() => setWizardOpen(true)}>
                <Plus size={14} aria-hidden /> New study
              </Button>
            )}
          </>
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No MSA studies yet"
            body={
              canManage
                ? "Start a Gauge R&R study to measure your gauge's repeatability and reproducibility — use “New study” above."
                : "No MSA studies have been created yet."
            }
          />
        </Card>
      ) : (
        <>
          <KpiTiles analysis={analysis.data} />

          {active.data !== undefined && (
            <ActiveStudyCard study={active.data} analysis={analysis.data} canManage={canManage} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent MSA studies</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="k-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Study</th>
                    <th>Gauge</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>GR&amp;R %</th>
                    <th>ndc</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <RecentRow key={s.id} study={s} active={s.id === activeId} onSelect={() => select(s.id)} />
                  ))}
                </tbody>
              </table>
              {list.data?.nextCursor != null && (
                <p className="mt-2 text-center text-[12px] text-subtle">
                  Showing the first {items.length}. Pagination lands with the shared table.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {wizardOpen && (
        <MsaWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => select(id)}
        />
      )}
    </div>
  );
}

function ExportButton({
  report,
  disabled,
}: {
  report: ReturnType<typeof useMsaAiagReportExport>;
  disabled: boolean;
}): React.ReactElement {
  if (report.status === "completed" && report.downloadUrl !== null) {
    return (
      <a href={report.downloadUrl} download className="k-btn k-btn-ghost">
        <Download size={13} aria-hidden /> Download report
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
      <Download size={13} aria-hidden /> {report.isFailed ? "Retry AIAG report" : "AIAG report"}
    </Button>
  );
}

function KpiTiles({ analysis }: { analysis: MsaAnalysisComplete | { status: "incomplete" } | undefined }): React.ReactElement {
  const complete = analysis?.status === "complete" ? analysis : null;
  const tiles = [
    { l: "Total GR&R %", v: complete !== null ? `${complete.grr.pctStudyVar.toFixed(1)}%` : "—", c: complete !== null ? VERDICT_STYLE[complete.verdict].fg : "var(--text-muted)" },
    { l: "Repeatability (EV)", v: complete !== null ? `${complete.repeatability.pctStudyVar.toFixed(1)}%` : "—", c: "#2563eb", s: "Equipment variation" },
    { l: "Reproducibility (AV)", v: complete !== null ? `${complete.reproducibility.pctStudyVar.toFixed(1)}%` : "—", c: "#7c3aed", s: "Appraiser variation" },
    { l: "ndc", v: complete !== null ? String(complete.ndc) : "0", c: "#0d9488", s: "Number distinct categories (≥ 5)" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((k) => (
        <Card key={k.l} className="p-3.5">
          <div className="text-[10.5px] font-semibold uppercase text-muted">{k.l}</div>
          <div className="text-[22px] font-bold" style={{ color: k.c }}>
            {k.v}
          </div>
          <div className="text-[10.5px] text-muted">{k.s}</div>
        </Card>
      ))}
    </div>
  );
}

function ActiveStudyCard({
  study,
  analysis,
  canManage,
}: {
  study: MsaStudyDto;
  analysis: MsaAnalysisComplete | { status: "incomplete"; measurementsEntered: number; measurementsRequired: number } | undefined;
  canManage: boolean;
}): React.ReactElement {
  const required = study.nAppraisers * study.nParts * study.nTrials;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {study.status === "completed" ? "Active study" : "Draft study"} — {study.characteristic} ({study.gaugeLabel})
          </CardTitle>
          <p className="mt-0.5 text-[12px] text-muted">
            {study.nAppraisers} appraisers · {study.nParts} parts · {study.nTrials} trials · {METHOD_LABEL[study.method]}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {analysis === undefined ? (
          <Skeleton className="h-48 w-full" />
        ) : analysis.status === "incomplete" ? (
          <IncompleteState entered={analysis.measurementsEntered} required={analysis.measurementsRequired} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="k-overline mb-2">Variance components</div>
              <VarianceTable analysis={analysis} />
              <VerdictBanner analysis={analysis} />
            </div>
            <div>
              <div className="k-overline mb-2">Variation by source</div>
              <VariationChart analysis={analysis} />
            </div>
          </div>
        )}

        {canManage && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="k-overline mb-2">Measurement grid</div>
            <MsaGrid study={study} canManage={canManage} />
          </div>
        )}
        {!canManage && study.status !== "completed" && (
          <p className="mt-4 text-[12px] text-muted">
            {required - study.measurements.length} of {required} measurements entered. Ask a manager to complete this study.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IncompleteState({ entered, required }: { entered: number; required: number }): React.ReactElement {
  return (
    <EmptyState
      title="Not enough measurements yet"
      body={`${entered} of ${required} entered — ${required - entered} more needed before an analysis can be computed.`}
    />
  );
}

function row(label: string, source: MsaGaugeRrSourceDto | null, bold?: boolean): React.ReactElement | null {
  if (source === null) return null;
  return (
    <tr key={label} style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "6px 0", fontWeight: bold ? 700 : 400, whiteSpace: "pre" }}>{label}</td>
      <td className="mono" style={{ padding: "6px 0", textAlign: "right" }}>
        {source.stdDev.toFixed(4)}
      </td>
      <td className="mono" style={{ padding: "6px 0", textAlign: "right" }}>
        {source.pctStudyVar.toFixed(1)}
      </td>
      <td className="mono" style={{ padding: "6px 0", textAlign: "right" }}>
        {source.pctTolerance !== null ? source.pctTolerance.toFixed(1) : "—"}
      </td>
    </tr>
  );
}

function VarianceTable({ analysis }: { analysis: MsaAnalysisComplete }): React.ReactElement {
  return (
    <table style={{ width: "100%", fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <th style={{ textAlign: "left", padding: "6px 0", fontSize: 10, color: "var(--text-muted)" }}>Source</th>
          <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10, color: "var(--text-muted)" }}>StdDev</th>
          <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10, color: "var(--text-muted)" }}>% StudyVar</th>
          <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10, color: "var(--text-muted)" }}>% Tolerance</th>
        </tr>
      </thead>
      <tbody>
        {row("Total Gauge R&R", analysis.grr, true)}
        {row("  Repeatability (EV)", analysis.repeatability)}
        {row("  Reproducibility (AV)", analysis.reproducibility)}
        {row("    Appraiser", analysis.appraiser)}
        {row("    Appraiser × Part", analysis.appraiserByPart)}
        {row("Part-to-Part", analysis.partToPart)}
        {row("Total Variation", analysis.total, true)}
      </tbody>
    </table>
  );
}

function VerdictBanner({ analysis }: { analysis: MsaAnalysisComplete }): React.ReactElement {
  const s = VERDICT_STYLE[analysis.verdict];
  return (
    <div
      className="mt-3 rounded-md p-3 text-[12px]"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <strong style={{ color: s.fg }}>{s.label}</strong> — Total GR&R {analysis.grr.pctStudyVar.toFixed(1)}%
      {analysis.verdict === "reject" ? " exceeds" : " is below"} the 30% AIAG threshold. NDC = {analysis.ndc} (≥ 5
      required).
    </div>
  );
}

function VariationChart({ analysis }: { analysis: MsaAnalysisComplete }): React.ReactElement {
  const bars: { l: string; v: number; c: string }[] = [
    { l: "GR&R", v: analysis.grr.pctStudyVar, c: "#7c3aed" },
    { l: "EV", v: analysis.repeatability.pctStudyVar, c: "#2563eb" },
    { l: "AV", v: analysis.reproducibility.pctStudyVar, c: "#0d9488" },
    { l: "Part-Part", v: analysis.partToPart.pctStudyVar, c: "#16a34a" },
  ];
  if (analysis.grr.pctTolerance !== null) bars.push({ l: "% Tol", v: analysis.grr.pctTolerance, c: "#f59e0b" });
  const maxV = Math.max(...bars.map((b) => b.v), 30);
  const scale = 140 / maxV;
  return (
    <svg viewBox="0 0 360 200" style={{ width: "100%", height: "auto" }}>
      {bars.map((b, i) => (
        <g key={b.l}>
          <rect x={20 + i * 70} y={200 - b.v * scale - 30} width="40" height={b.v * scale} fill={b.c} rx="2" />
          <text x={40 + i * 70} y={200 - b.v * scale - 36} fontSize="11" fill={b.c} textAnchor="middle" fontWeight="700">
            {b.v.toFixed(1)}
          </text>
          <text x={40 + i * 70} y={195} fontSize="10" fill="#64748b" textAnchor="middle">
            {b.l}
          </text>
        </g>
      ))}
      <line x1="10" y1="170" x2="350" y2="170" stroke="#cbd5e1" />
      <line x1="10" y1={200 - 30 * scale - 30} x2="350" y2={200 - 30 * scale - 30} stroke="#dc2626" strokeDasharray="3 3" />
      <text x="350" y={200 - 30 * scale - 33} fontSize="9" fill="#dc2626" textAnchor="end" fontWeight="700">
        30% threshold
      </text>
    </svg>
  );
}

function RecentRow({ study, active, onSelect }: { study: MsaStudyDto; active: boolean; onSelect: () => void }): React.ReactElement {
  return (
    <tr
      className="cursor-pointer"
      style={active ? { background: "var(--bg-subtle)" } : undefined}
      onClick={onSelect}
    >
      <td style={{ fontSize: 12.5, fontWeight: 600 }}>{study.characteristic}</td>
      <td style={{ fontSize: 12 }}>{study.gaugeLabel}</td>
      <td style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{METHOD_LABEL[study.method]}</td>
      <td className="mono" style={{ fontSize: 11.5 }}>
        {longDate(study.completedAt ?? study.createdAt)}
      </td>
      {study.status === "draft" ? (
        <>
          <td className="mono">—</td>
          <td className="mono">—</td>
          <td>
            <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
              draft
            </span>
          </td>
        </>
      ) : (
        <StudyResultCells studyId={study.id} />
      )}
    </tr>
  );
}

/** A completed row's GR&R%/ndc/verdict come from its own `analysis` read
 *  (never stored pre-computed, M1 AC3) — a small per-row query, same pattern
 *  as any list whose summary figures are derived, not stored. */
function StudyResultCells({ studyId }: { studyId: string }): React.ReactElement {
  const analysis = useMsaAnalysis(studyId);
  if (analysis.data === undefined || analysis.data.status !== "complete") {
    return (
      <>
        <td className="mono">—</td>
        <td className="mono">—</td>
        <td>—</td>
      </>
    );
  }
  const a = analysis.data;
  const s = VERDICT_STYLE[a.verdict];
  return (
    <>
      <td className="mono">{a.grr.pctStudyVar.toFixed(1)}%</td>
      <td className="mono">{a.ndc}</td>
      <td>
        <span className="k-chip" style={{ background: s.bg, color: s.fg }}>
          {s.label}
        </span>
      </td>
    </>
  );
}
