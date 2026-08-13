"use client";

import type { Query, QueryFieldDto, QuerySeriesPoint } from "@kaenal/types";
import { Spinner } from "@/components/ui";
import { useQueryMetric, useQueryRows, useQuerySeries } from "@/hooks/use-query";

/**
 * The six bound widgets (report-data.jsx `BoundKPI`/`BoundBar`/`BoundPie`/
 * `BoundLine`/`DataTableWidget`/`RepeaterWidget`). Each takes a `Query` and
 * renders the engine's result — so a report tile is just "a query + a viz", and
 * the preview in the builder is the same render used on a saved report.
 */

const CHART_COLORS = ["#dc2626", "#ea580c", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#0d9488", "#db2777"];

function fmtNum(n: number | null | undefined, key?: string): string {
  if (n === null || n === undefined) return "—";
  if (key !== undefined && /cost|spend|coq|amount|\$/i.test(key)) return "$" + n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Centered({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center py-6 text-center text-xs text-[var(--text-muted)]">
      {children}
    </div>
  );
}

function widgetError(): React.ReactElement {
  return <Centered>Couldn&apos;t load this data — you may not have access to the source.</Centered>;
}

export function BoundKpi({ query }: { query: Query }): React.ReactElement {
  const { data, isLoading, isError } = useQueryMetric(query);
  if (isLoading) return <Spinner />;
  if (isError) return widgetError();
  const measure = query.measure ?? undefined;
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight">{fmtNum(data?.value ?? null, measure)}</div>
      <div className="mt-1 text-[11px] text-[var(--text-muted)]">
        {query.agg ?? "count"}
        {measure !== undefined && measure !== "" ? ` · ${measure}` : ""}
      </div>
    </div>
  );
}

function useSeries(query: Query): { points: QuerySeriesPoint[]; isLoading: boolean; isError: boolean } {
  const { data, isLoading, isError } = useQuerySeries(query);
  return { points: [...(data?.points ?? [])], isLoading, isError };
}

export function BoundBar({ query }: { query: Query }): React.ReactElement {
  const { points, isLoading, isError } = useSeries(query);
  if (isLoading) return <Spinner />;
  if (isError) return widgetError();
  if (points.length === 0) return <Centered>No data for this dimension.</Centered>;
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {points.map((p, i) => (
        <div key={p.label} className="flex items-center gap-2 text-[11px]">
          <div className="w-24 truncate text-right text-[var(--text-muted)]">{p.label}</div>
          <div className="h-4 flex-1 rounded bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded"
              style={{ width: `${(p.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
          </div>
          <div className="w-11 text-right font-semibold">{fmtNum(p.value, query.measure ?? undefined)}</div>
        </div>
      ))}
    </div>
  );
}

export function BoundPie({ query }: { query: Query }): React.ReactElement {
  const { points, isLoading, isError } = useSeries(query);
  if (isLoading) return <Spinner />;
  if (isError) return widgetError();
  if (points.length === 0) return <Centered>No data for this dimension.</Centered>;
  const total = points.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const segs = points.map((p, i) => {
    const a0 = acc;
    acc += p.value / total;
    return { ...p, a0, a1: acc, color: CHART_COLORS[i % CHART_COLORS.length] };
  });
  const pt = (frac: number): [number, number] => {
    const a = 2 * Math.PI * frac - Math.PI / 2;
    return [50 + 38 * Math.cos(a), 50 + 38 * Math.sin(a)];
  };
  return (
    <div className="flex flex-1 items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-24 w-24 flex-shrink-0">
        {segs.map((s) => {
          const [x0, y0] = pt(s.a0);
          const [x1, y1] = pt(s.a1);
          const large = s.a1 - s.a0 > 0.5 ? 1 : 0;
          return (
            <path
              key={s.label}
              d={`M50,50 L${x0},${y0} A38,38 0 ${large} 1 ${x1},${y1} Z`}
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={1}
            />
          );
        })}
        <circle cx={50} cy={50} r={20} fill="var(--surface)" />
      </svg>
      <div className="flex flex-1 flex-col gap-1 overflow-auto text-[11px]">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 truncate">{s.label}</span>
            <strong>{Math.round((s.value / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoundLine({ query }: { query: Query }): React.ReactElement {
  const { points, isLoading, isError } = useSeries(query);
  if (isLoading) return <Spinner />;
  if (isError) return widgetError();
  if (points.length === 0) return <Centered>No data for this dimension.</Centered>;
  // A trend is the series ordered by its dimension (e.g. week / month).
  const data = [...points].sort((a, b) => a.label.localeCompare(b.label));
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts: [number, number][] = data.map((d, i) => [
    data.length === 1 ? 100 : (i / (data.length - 1)) * 200,
    100 - ((d.value - min) / range) * 90 - 5,
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="h-full w-full flex-1">
      <path d={`${line} L200,100 L0,100 Z`} fill="var(--accent)" fillOpacity={0.12} />
      <path d={line} stroke="var(--accent)" strokeWidth={2} fill="none" />
    </svg>
  );
}

function cell(value: string | number | null, field: QueryFieldDto): string {
  if (value === null || value === "") return "—";
  if (field.type === "num" && typeof value === "number") return fmtNum(value, field.key);
  return String(value);
}

export function BoundTable({ query, compact }: { query: Query; compact?: boolean }): React.ReactElement {
  const { data, isLoading, isError } = useQueryRows(query);
  if (isLoading) return <Spinner />;
  if (isError) return widgetError();
  const fields = data?.fields ?? [];
  const rows = data?.rows ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 text-[10.5px] text-[var(--text-muted)]">
        {rows.length} of {data?.total ?? rows.length} rows
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ fontSize: compact ? 10.5 : 11.5 }}>
          <thead>
            <tr className="text-[var(--text-muted)]">
              {fields.map((f) => (
                <th
                  key={f.key}
                  className="sticky top-0 whitespace-nowrap border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
                  style={{ textAlign: f.type === "num" ? "right" : "left" }}
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border)]">
                {fields.map((f) => (
                  <td
                    key={f.key}
                    className="whitespace-nowrap px-2 py-1"
                    style={{ textAlign: f.type === "num" ? "right" : "left" }}
                  >
                    {cell(r[f.key] ?? null, f)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={Math.max(1, fields.length)} className="px-2 py-4 text-center text-[var(--text-muted)]">
                  No rows match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BoundRepeater({ query }: { query: Query }): React.ReactElement {
  const { data, isLoading, isError } = useQueryRows({ ...query, groupBy: null });
  if (isLoading) return <Spinner />;
  if (isError) return widgetError();
  const fields = data?.fields ?? [];
  const rows = data?.rows ?? [];
  const titleField = fields.find((f) => ["title", "name", "label", "code"].includes(f.key)) ?? fields[0];
  const idField = fields.find((f) => ["code", "id", "key"].includes(f.key));
  const detailFields = fields.filter((f) => f.key !== titleField?.key && f.key !== idField?.key).slice(0, 4);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="text-[10.5px] text-[var(--text-muted)]">For each of {rows.length} records</div>
      <div className="flex flex-1 flex-col gap-2 overflow-auto">
        {rows.map((r, i) => (
          <div key={i} className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              {idField !== undefined && (
                <span className="font-mono text-[11px] font-semibold text-[var(--accent)]">{cell(r[idField.key] ?? null, idField)}</span>
              )}
              <span className="text-[12.5px] font-semibold">{titleField !== undefined ? cell(r[titleField.key] ?? null, titleField) : `Record ${i + 1}`}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {detailFields.map((f) => (
                <div key={f.key} className="text-[11px]">
                  <span className="text-[var(--text-muted)]">{f.label}: </span>
                  <strong>{cell(r[f.key] ?? null, f)}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && <Centered>No records match.</Centered>}
      </div>
    </div>
  );
}

export function TileWidget({ viz, query }: { viz: string; query: Query }): React.ReactElement {
  switch (viz) {
    case "kpi":
      return <BoundKpi query={query} />;
    case "bar":
      return <BoundBar query={query} />;
    case "pie":
      return <BoundPie query={query} />;
    case "line":
      return <BoundLine query={query} />;
    case "repeater":
      return <BoundRepeater query={query} />;
    case "datatable":
    default:
      return <BoundTable query={query} />;
  }
}
