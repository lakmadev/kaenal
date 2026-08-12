"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Database } from "lucide-react";
import type { SpcChartDto } from "@kaenal/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner, useToast } from "@/components/ui";
import { useCan } from "@/hooks/use-me";
import { useIngestMeasurements, useSpcChart, useSpcCharacteristics } from "@/hooks/use-spc";

/**
 * SPC charts (qms-risk-spc.jsx `SPCCharts`, design rule #9) wired to the engine.
 * The X̄/R limits, Western-Electric runs rules, and Cp/Cpk are all computed
 * server-side (`packages/core/spc.ts`) — this screen picks a characteristic and
 * plots the returned points + limits, and flags out-of-control patterns. A
 * `measurement:manage` holder can seed a sample drifting series to demo it.
 */
export function SpcCharts(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("measurement:manage");
  const list = useSpcCharacteristics();
  const ingest = useIngestMeasurements();
  const [selected, setSelected] = useState<{ part: string; characteristic: string } | null>(null);

  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  // Default-select the first characteristic once data arrives.
  useEffect(() => {
    const first = items[0];
    if (selected === null && first !== undefined) {
      setSelected({ part: first.part, characteristic: first.characteristic });
    }
  }, [items, selected]);

  const chart = useSpcChart(selected?.part ?? null, selected?.characteristic ?? null);

  const loadSample = (): void => {
    ingest.mutate(sampleSeries(), {
      onSuccess: () => {
        toast.success("Sample series loaded");
        setSelected({ part: SAMPLE_PART, characteristic: SAMPLE_CHAR });
      },
      onError: () => toast.error("Couldn't load sample data"),
    });
  };

  return (
    <div>
      <PageHeader
        title="SPC charts"
        description="X̄/R control charts with Western-Electric runs rules and process capability. Computed live from measurement data."
        actions={
          canManage ? (
            <button className="k-btn k-btn-ghost" onClick={loadSample} disabled={ingest.isPending}>
              <Database size={13} /> {ingest.isPending ? "Loading…" : "Load sample series"}
            </button>
          ) : undefined
        }
      />

      <div className="px-7 pb-8 pt-5">
        {list.isPending ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
            <Spinner /> <span className="ml-2 text-[13px]">Loading characteristics…</span>
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="pt-5">
              <EmptyState
                icon={AlertTriangle}
                title="No measurement data yet"
                body={canManage ? "Load a sample series to see the control charts, or ingest measurements via the API / bulk import." : "Ask a manager to ingest measurement data to populate the control charts."}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[var(--text-muted)]">Characteristic</span>
              <select
                className="k-input"
                style={{ width: 320 }}
                value={selected ? `${selected.part}::${selected.characteristic}` : ""}
                onChange={(e) => {
                  const [part, characteristic] = e.target.value.split("::");
                  if (part !== undefined && characteristic !== undefined) setSelected({ part, characteristic });
                }}
              >
                {items.map((c) => (
                  <option key={`${c.part}::${c.characteristic}`} value={`${c.part}::${c.characteristic}`}>
                    {c.characteristic} — {c.part} ({c.subgroups} subgroups)
                  </option>
                ))}
              </select>
            </div>

            {chart.isPending ? (
              <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
                <Spinner /> <span className="ml-2 text-[13px]">Computing control limits…</span>
              </div>
            ) : chart.data === undefined ? (
              <div className="text-[13px] text-[var(--text-muted)]">Select a characteristic.</div>
            ) : (
              <ChartView chart={chart.data} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChartView({ chart }: { chart: SpcChartDto }): React.ReactElement {
  const violatingSubgroups = useMemo(() => new Set(chart.violations.flatMap((v) => v.subgroups)), [chart.violations]);
  const unit = chart.unit ?? "";

  return (
    <div className="flex flex-col gap-4">
      {chart.violations.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border p-3.5" style={{ borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.06)" }}>
          <AlertTriangle size={18} style={{ color: "#dc2626" }} />
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold" style={{ color: "#7f1d1d" }}>
              Out of statistical control — {chart.violations.map((v) => v.rule).join(", ")}
            </div>
            <div className="text-[11.5px]" style={{ color: "#9f1239" }}>
              {violatingSubgroups.size} subgroup(s) flagged across {chart.violations.length} rule(s).
            </div>
          </div>
          <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => undefined} title="Alarm routing is configured per characteristic">
            <Bell size={12} /> Configure alarm
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>X̄ chart (subgroup means)</CardTitle>
        </CardHeader>
        <CardContent>
          <ControlChart
            values={chart.points.map((p) => p.mean)}
            cl={chart.centerLine}
            ucl={chart.uclX}
            lcl={chart.lclX}
            usl={chart.capability.usl}
            lsl={chart.capability.lsl}
            violating={violatingSubgroups}
            color="#2563eb"
          />
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--text-muted)]">
            <Stat label="X̿" value={chart.centerLine} unit={unit} />
            <Stat label="UCL" value={chart.uclX} unit={unit} />
            <Stat label="LCL" value={chart.lclX} unit={unit} />
            {chart.capability.usl !== null && <Stat label="USL" value={chart.capability.usl} unit={unit} />}
            {chart.capability.lsl !== null && <Stat label="LSL" value={chart.capability.lsl} unit={unit} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>R chart (subgroup ranges)</CardTitle>
        </CardHeader>
        <CardContent>
          <ControlChart
            values={chart.points.map((p) => p.range)}
            cl={chart.rBar}
            ucl={chart.uclR}
            lcl={chart.lclR}
            usl={null}
            lsl={null}
            violating={new Set()}
            color="#0d9488"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Western Electric runs rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              {WE_RULES.map((r) => {
                const hit = chart.violations.find((v) => v.rule === r.rule);
                return (
                  <div
                    key={r.rule}
                    className="flex items-center gap-2.5 rounded p-2"
                    style={{
                      background: hit ? "rgba(220,38,38,0.06)" : "var(--bg-subtle)",
                      borderLeft: hit ? "3px solid #dc2626" : "3px solid transparent",
                    }}
                  >
                    <span className="mono text-[11px] font-bold" style={{ color: hit ? "#b91c1c" : "var(--text-muted)" }}>
                      {r.rule}
                    </span>
                    <span className="flex-1 text-[12px]">{r.label}</span>
                    {hit && (
                      <span className="k-chip" style={{ background: "rgba(220,38,38,0.15)", color: "#b91c1c" }}>
                        {hit.subgroups.length} pt(s)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Process capability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Cp" value={fmt(chart.capability.cp)} target={chart.capability.cp !== null && chart.capability.cp < 1.33} />
              <Field label="Cpk" value={fmt(chart.capability.cpk)} target={chart.capability.cpk !== null && chart.capability.cpk < 1.33} />
              <Field label="σ̂ (within)" value={fmt(chart.capability.sigma)} />
              <Field label="Subgroup size" value={String(chart.subgroupSize)} />
            </div>
            {chart.capability.cp === null && (
              <div className="mt-3 text-[11px] text-[var(--text-muted)]">
                Cp/Cpk require spec limits (USL/LSL) on the ingested measurements.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const WE_RULES: { rule: SpcChartDto["violations"][number]["rule"]; label: string }[] = [
  { rule: "WE-1", label: "1 point beyond ±3σ" },
  { rule: "WE-2", label: "2 of 3 consecutive points beyond ±2σ (same side)" },
  { rule: "WE-3", label: "4 of 5 consecutive points beyond ±1σ (same side)" },
  { rule: "WE-4", label: "8 consecutive points on one side of center" },
];

/** A responsive SVG control chart: CL/UCL/LCL (+ optional spec) + points. */
function ControlChart({
  values,
  cl,
  ucl,
  lcl,
  usl,
  lsl,
  violating,
  color,
}: {
  values: number[];
  cl: number;
  ucl: number;
  lcl: number;
  usl: number | null;
  lsl: number | null;
  violating: Set<number>;
  color: string;
}): React.ReactElement {
  const W = 900;
  const H = 220;
  const padX = 40;
  const padY = 20;
  const candidates = [...values, ucl, lcl, cl, ...(usl !== null ? [usl] : []), ...(lsl !== null ? [lsl] : [])];
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  const span = max - min || 1;
  const yFor = (v: number): number => padY + (1 - (v - min) / span) * (H - 2 * padY);
  const xFor = (i: number): number => padX + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (W - 2 * padX));

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");

  const line = (v: number, stroke: string, dash: string, label: string): React.ReactElement => (
    <g key={label}>
      <line x1={padX} y1={yFor(v)} x2={W - padX} y2={yFor(v)} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
      <text x={W - padX + 2} y={yFor(v) + 3} fontSize={9} fill={stroke}>
        {label}
      </text>
    </g>
  );

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 640 }} role="img" aria-label="control chart">
        {usl !== null && line(usl, "#94a3b8", "1 3", "USL")}
        {lsl !== null && line(lsl, "#94a3b8", "1 3", "LSL")}
        {line(ucl, "#dc2626", "4 3", "UCL")}
        {line(lcl, "#dc2626", "4 3", "LCL")}
        {line(cl, "#16a34a", "0", "CL")}
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
        {values.map((v, i) => {
          const bad = violating.has(i);
          return <circle key={i} cx={xFor(i)} cy={yFor(v)} r={bad ? 4 : 2.5} fill={bad ? "#dc2626" : color} stroke="white" strokeWidth={bad ? 1 : 0} />;
        })}
      </svg>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }): React.ReactElement {
  return (
    <span>
      <strong>{label} </strong>
      <span className="mono">
        {value.toFixed(3)}
        {unit ? ` ${unit}` : ""}
      </span>
    </span>
  );
}

function Field({ label, value, target }: { label: string; value: string; target?: boolean }): React.ReactElement {
  return (
    <div className="rounded-md p-2.5" style={{ background: "var(--bg-subtle)" }}>
      <div className="text-[10.5px] font-semibold uppercase text-[var(--text-muted)]">{label}</div>
      <div className="mono text-[16px] font-bold" style={{ color: target ? "#dc2626" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

function fmt(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

// --- Sample series (drifts out of control after subgroup 15) ---------------

const SAMPLE_PART = "VBR-3041";
const SAMPLE_CHAR = "Weld penetration";

function sampleSeries(): import("@kaenal/types").IngestMeasurementsBody {
  const points: { value: number; subgroup: number }[] = [];
  for (let i = 0; i < 25; i++) {
    const drift = i > 18 ? 6.0 + (i - 18) * 0.16 : 6.0;
    for (let j = 0; j < 5; j++) {
      const noise = (Math.sin(i * 1.3 + j) + Math.sin(i * 0.7 + j * 1.4)) * 0.14;
      points.push({ value: Number((drift + noise).toFixed(3)), subgroup: i });
    }
  }
  return { part: SAMPLE_PART, characteristic: SAMPLE_CHAR, unit: "mm", usl: 7.0, lsl: 5.0, target: 6.0, source: "manual", points };
}
