"use client";

import type { Query, QueryFieldDto, QueryFilter, QueryOp, QuerySourceDto } from "@kaenal/types";

/**
 * The tile inspector (report-data.jsx `QueryBuilder`). Edits a `Query` against
 * the selected source's field schema — the same fields the engine whitelists, so
 * the builder can only ever produce a query the server will run. Which controls
 * show depends on the tile's viz: table/repeater edit columns/group-by/sort;
 * kpi/series edit measure/agg (+ dimension for series). Filters apply to all.
 */

const SEL = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs";
const OPS: QueryOp[] = ["=", "≠", "contains", ">", "<"];
const AGGS = ["count", "sum", "avg", "min", "max"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-[11px] font-semibold text-[var(--text-muted)]">{label}</div>
      {children}
    </div>
  );
}

export function QueryBuilder({
  query,
  viz,
  sources,
  onChange,
}: {
  query: Query;
  viz: string;
  sources: QuerySourceDto[];
  onChange: (q: Query) => void;
}): React.ReactElement {
  const source = sources.find((s) => s.id === query.sourceId);
  const fields: QueryFieldDto[] = source?.fields ? [...source.fields] : [];
  const numFields = fields.filter((f) => f.type === "num");
  const textFields = fields.filter((f) => f.type === "text");
  const set = (patch: Partial<Query>): void => onChange({ ...query, ...patch });
  const columns = query.columns ?? [];

  const toggleCol = (key: string): void =>
    set({ columns: columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key] });

  const filters = query.filters ?? [];
  const addFilter = (): void =>
    set({ filters: [...filters, { field: fields[0]?.key ?? "", op: "contains", value: "" }] });
  const setFilter = (i: number, patch: Partial<QueryFilter>): void =>
    set({ filters: filters.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const rmFilter = (i: number): void => set({ filters: filters.filter((_, j) => j !== i) });

  const isTable = viz === "datatable" || viz === "repeater";
  const isMeasured = viz === "kpi" || viz === "bar" || viz === "pie" || viz === "line";
  const isSeries = viz === "bar" || viz === "pie" || viz === "line";

  return (
    <div>
      <Field label="Data source">
        <select
          className={SEL}
          value={query.sourceId}
          onChange={(e) => {
            const s = sources.find((x) => x.id === e.target.value);
            onChange({ sourceId: e.target.value, columns: s ? [...s.defaultColumns] : [], filters: [] });
          }}
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {isTable && (
        <Field label={`Columns (${columns.length}/${fields.length})`}>
          <div className="max-h-44 overflow-auto rounded-md border border-[var(--border)] p-1.5">
            {fields.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs">
                <input type="checkbox" checked={columns.includes(f.key)} onChange={() => toggleCol(f.key)} />
                <span className="flex-1">{f.label}</span>
                <span className="text-[9.5px] uppercase text-[var(--text-subtle)]">{f.type}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      {isMeasured && (
        <Field label="Measure">
          <div className="flex gap-1">
            <select className={SEL} style={{ width: 90 }} value={query.agg ?? "count"} onChange={(e) => set({ agg: e.target.value as Query["agg"] })}>
              {AGGS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              className={SEL}
              value={query.measure ?? ""}
              disabled={(query.agg ?? "count") === "count"}
              onChange={(e) => set({ measure: e.target.value === "" ? null : e.target.value })}
            >
              <option value="">— records —</option>
              {numFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </Field>
      )}

      {isSeries && (
        <Field label="Group by (dimension)">
          <select className={SEL} value={query.dimension ?? ""} onChange={(e) => set({ dimension: e.target.value === "" ? null : e.target.value })}>
            <option value="">— pick a dimension —</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Filters">
        {filters.map((f, i) => (
          <div key={i} className="mb-1.5 flex items-center gap-1">
            <select className={`${SEL} flex-1`} value={f.field} onChange={(e) => setFilter(i, { field: e.target.value })}>
              {fields.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
            <select className={SEL} style={{ width: 70 }} value={f.op} onChange={(e) => setFilter(i, { op: e.target.value as QueryOp })}>
              {OPS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              className={SEL}
              style={{ width: 70 }}
              value={f.value}
              placeholder="value"
              onChange={(e) => setFilter(i, { value: e.target.value })}
            />
            <button type="button" className="px-1 text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => rmFilter(i)} aria-label="Remove filter">
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="text-[11px] font-medium text-[var(--accent)]" onClick={addFilter}>
          + Add filter
        </button>
      </Field>

      {isTable && (
        <Field label="Group by (count)">
          <select className={SEL} value={query.groupBy ?? ""} onChange={(e) => set({ groupBy: e.target.value === "" ? null : e.target.value })}>
            <option value="">— none (show rows) —</option>
            {textFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {isTable && (
        <Field label="Sort">
          <div className="flex gap-1">
            <select
              className={`${SEL} flex-1`}
              value={query.sort?.field ?? ""}
              onChange={(e) => set({ sort: e.target.value === "" ? null : { field: e.target.value, dir: query.sort?.dir ?? "asc" } })}
            >
              <option value="">— none —</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              className={SEL}
              style={{ width: 80 }}
              disabled={query.sort == null}
              value={query.sort?.dir ?? "asc"}
              onChange={(e) => set({ sort: query.sort ? { ...query.sort, dir: e.target.value as "asc" | "desc" } : null })}
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </Field>
      )}

      <Field label="Row limit">
        <input
          className={SEL}
          type="number"
          min={1}
          max={1000}
          value={query.limit ?? ""}
          placeholder="All rows"
          onChange={(e) => set({ limit: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}
