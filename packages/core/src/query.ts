/**
 * The query engine (KAENAL_IMPLEMENTATION.md Part B2) — the single builder that
 * powers report tables, KPIs, chart series, and dashboards. Given a {@link Query}
 * it compiles a **parameterised** SQL statement for a Kaenal-native source.
 *
 * The governing rule of the whole data platform is "client checks are UX; the
 * server is security". This file is the server side of that, so it holds two
 * invariants above all:
 *
 *  1. **Identifiers only from the whitelist.** Table and column names are looked
 *     up in {@link QUERY_SOURCES}; a `sourceId`/`field`/`measure`/`dimension`/
 *     `column` that is not in the registry throws {@link QueryError} before any
 *     SQL string exists. User input never becomes an identifier.
 *  2. **Values only as `$n` placeholders.** Every filter value is a bound
 *     parameter — a `value` of `'; DROP TABLE ncrs; --` lands as a string
 *     literal, never as SQL.
 *
 * Tenant scoping is RLS, exactly like every other service: the compiled SQL runs
 * on the request's tenant-scoped transaction, so it carries no tenant predicate
 * of its own. Soft-deleted rows are excluded (`deleted_at IS NULL`).
 *
 * Everything here is pure and unit-tested; the API layer executes the returned
 * `{ text, params }` and maps {@link QueryError} to a 422.
 */

import type {
  Query,
  QueryAgg,
  QueryFieldDto,
  QueryFieldType,
  QueryFilter,
  QuerySourceDto,
} from "@kaenal/types";
import type { Capability } from "./rbac.js";

/** A single queryable field: the client-facing key, and its real DB column. */
export interface QueryField {
  readonly key: string;
  readonly label: string;
  readonly type: QueryFieldType;
  readonly column: string;
}

/** A Kaenal-native data source: a table + the capability that gates reading it. */
export interface QuerySource {
  readonly id: string;
  readonly label: string;
  readonly origin: string;
  /** The `*:view` capability a role must hold to query this source (B6). */
  readonly capability: Capability;
  readonly table: string;
  readonly fields: readonly QueryField[];
  readonly defaultColumns: readonly string[];
}

/** Raised when a query references something outside the source whitelist. */
export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryError";
  }
}

const f = (key: string, column: string, type: QueryFieldType, label: string): QueryField => ({
  key,
  column,
  type,
  label,
});

/**
 * The Kaenal-native source registry (report-data.jsx `RB_KAENAL_SOURCES`). Each
 * field's `column` is a real, non-secret, scalar column on the source table.
 * uuid/jsonb/array columns are deliberately omitted — they are neither useful
 * filters nor safe to expose raw. Dates are exposed as `text`: an ISO-8601
 * string sorts and compares chronologically under lexicographic ordering.
 */
export const QUERY_SOURCES: Readonly<Record<string, QuerySource>> = {
  ncr: {
    id: "ncr",
    label: "Non-conformities",
    origin: "Kaenal",
    capability: "ncr:view",
    table: "ncrs",
    fields: [
      f("code", "code", "text", "Code"),
      f("title", "title", "text", "Title"),
      f("source", "source", "text", "Source"),
      f("priority", "priority", "text", "Priority"),
      f("risk", "risk", "text", "Risk"),
      f("category", "category", "text", "Category"),
      f("status", "status", "text", "Status"),
      f("slaState", "sla_state", "text", "SLA state"),
      f("dueAt", "due_at", "text", "Due"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["code", "title", "status", "priority", "slaState"],
  },
  inspection: {
    id: "inspection",
    label: "Inspections",
    origin: "Kaenal",
    capability: "inspection:view",
    table: "inspections",
    fields: [
      f("code", "code", "text", "Code"),
      f("title", "title", "text", "Title"),
      f("status", "status", "text", "Status"),
      f("risk", "risk", "text", "Risk"),
      f("score", "score", "num", "Score"),
      f("scheduledAt", "scheduled_at", "text", "Scheduled"),
      f("completedAt", "completed_at", "text", "Completed"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["code", "title", "status", "risk", "score"],
  },
  eightd: {
    id: "eightd",
    label: "8D cases",
    origin: "Kaenal",
    // 8D reads are gated on ncr:view, matching the 8D endpoints (PROGRESS P03).
    capability: "ncr:view",
    table: "eight_ds",
    fields: [
      f("code", "code", "text", "Code"),
      f("title", "title", "text", "Title"),
      f("status", "status", "text", "Status"),
      f("currentStep", "current_step", "num", "Current step"),
      f("startedAt", "started_at", "text", "Started"),
      f("targetAt", "target_at", "text", "Target"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["code", "title", "status", "currentStep"],
  },
  capa: {
    id: "capa",
    label: "CAPA",
    origin: "Kaenal",
    capability: "capa:view",
    table: "capas",
    fields: [
      f("code", "code", "text", "Code"),
      f("title", "title", "text", "Title"),
      f("type", "type", "text", "Type"),
      f("priority", "priority", "text", "Priority"),
      f("risk", "risk", "text", "Risk"),
      f("status", "status", "text", "Status"),
      f("sourceKind", "source_kind", "text", "Source"),
      f("dueAt", "due_at", "text", "Due"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["code", "title", "status", "priority", "type"],
  },
  audit: {
    id: "audit",
    label: "Audits",
    origin: "Kaenal",
    capability: "audit:view",
    table: "audits",
    fields: [
      f("code", "code", "text", "Code"),
      f("title", "title", "text", "Title"),
      f("standard", "standard", "text", "Standard"),
      f("type", "type", "text", "Type"),
      f("status", "status", "text", "Status"),
      f("progress", "progress", "num", "Progress"),
      f("startAt", "start_at", "text", "Start"),
      f("endAt", "end_at", "text", "End"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["code", "title", "status", "type", "progress"],
  },
  finding: {
    id: "finding",
    label: "Findings",
    origin: "Kaenal",
    capability: "inspection:view",
    table: "findings",
    fields: [
      f("itemRef", "item_ref", "text", "Item"),
      f("severity", "severity", "text", "Severity"),
      f("description", "description", "text", "Description"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["itemRef", "severity", "description"],
  },
  supplier: {
    id: "supplier",
    label: "Suppliers",
    origin: "Kaenal",
    capability: "supplier:view",
    table: "suppliers",
    fields: [
      f("name", "name", "text", "Name"),
      f("code", "code", "text", "Code"),
      f("tier", "tier", "num", "Tier"),
      f("status", "status", "text", "Status"),
      f("riskTier", "risk_tier", "text", "Risk tier"),
      f("createdAt", "created_at", "text", "Created"),
    ],
    defaultColumns: ["name", "code", "status", "riskTier", "tier"],
  },
};

export function getQuerySource(sourceId: string): QuerySource | undefined {
  return Object.prototype.hasOwnProperty.call(QUERY_SOURCES, sourceId)
    ? QUERY_SOURCES[sourceId]
    : undefined;
}

/** Public (no-`column`) view of a source, for the report builder's picker. */
export function toQuerySourceDto(source: QuerySource): QuerySourceDto {
  return {
    id: source.id,
    label: source.label,
    origin: source.origin,
    fields: source.fields.map(toFieldDto),
    defaultColumns: [...source.defaultColumns],
  };
}

function toFieldDto(field: QueryField): QueryFieldDto {
  return { key: field.key, label: field.label, type: field.type };
}

// --- Compilation ------------------------------------------------------------

export interface CompiledQuery {
  readonly text: string;
  readonly params: unknown[];
  /** Result columns in order, so the caller can shape rows + headers. */
  readonly fields: readonly QueryFieldDto[];
}

const COUNT_KEY = "__count";

function requireSource(query: Query): QuerySource {
  const source = getQuerySource(query.sourceId);
  if (source === undefined) throw new QueryError(`Unknown data source '${query.sourceId}'`);
  return source;
}

function fieldOf(source: QuerySource, key: string): QueryField {
  const field = source.fields.find((x) => x.key === key);
  if (field === undefined) {
    throw new QueryError(`Field '${key}' is not queryable on source '${source.id}'`);
  }
  return field;
}

/**
 * A parameter accumulator: `bind(v)` records the value and returns its `$n`
 * placeholder. Keeps the compiler's SQL free of any interpolated value.
 */
class Params {
  private readonly values: unknown[] = [];
  bind(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
  all(): unknown[] {
    return this.values;
  }
}

/** One filter → a safe boolean SQL fragment, value bound as a parameter. */
function filterSql(source: QuerySource, filter: QueryFilter, params: Params): string {
  const field = fieldOf(source, filter.field);
  const col = field.column; // whitelisted identifier
  switch (filter.op) {
    case "=":
      return `lower(${col}::text) = lower(${params.bind(filter.value)})`;
    case "≠":
      return `lower(${col}::text) IS DISTINCT FROM lower(${params.bind(filter.value)})`;
    case "contains":
      return `${col}::text ILIKE ('%' || ${params.bind(filter.value)} || '%')`;
    case ">":
      return field.type === "num"
        ? `${col} > ${params.bind(filter.value)}::numeric`
        : `${col}::text > ${params.bind(filter.value)}`;
    case "<":
      return field.type === "num"
        ? `${col} < ${params.bind(filter.value)}::numeric`
        : `${col}::text < ${params.bind(filter.value)}`;
    default: {
      // Exhaustiveness: QueryOp is a closed enum, so this is unreachable, but a
      // future op must not silently compile to "true".
      const never: never = filter.op;
      throw new QueryError(`Unsupported operator '${String(never)}'`);
    }
  }
}

/** WHERE clause (soft-delete guard + any filters). */
function whereSql(source: QuerySource, query: Query, params: Params): string {
  const clauses = ["deleted_at IS NULL"];
  for (const filter of query.filters ?? []) clauses.push(filterSql(source, filter, params));
  return clauses.join(" AND ");
}

function clampLimit(limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined) return null;
  return Math.min(Math.max(1, Math.trunc(limit)), 1000);
}

/** Aggregate SQL for a metric/series measure. `count` ignores the measure. */
function aggSql(source: QuerySource, agg: QueryAgg, measureKey: string | null | undefined): string {
  if (agg === "count") return "count(*)::int";
  if (measureKey === null || measureKey === undefined || measureKey === "") return "count(*)::int";
  const field = fieldOf(source, measureKey);
  if (field.type !== "num") {
    throw new QueryError(`Measure '${measureKey}' must be a numeric field for '${agg}'`);
  }
  const col = field.column;
  if (agg === "avg") return `round(avg(${col})::numeric, 2)`;
  return `${agg}(${col})`; // sum | min | max
}

/**
 * Rows (datatable / repeater). With `groupBy` it is a count-by-dimension; else a
 * projection of `columns` (defaulting to the source defaults), optionally sorted.
 */
export function compileRowsQuery(query: Query): CompiledQuery {
  const source = requireSource(query);
  const params = new Params();
  const where = whereSql(source, query, params);
  const limit = clampLimit(query.limit);
  const limitSql = limit === null ? "" : ` LIMIT ${limit}`;

  if (query.groupBy !== null && query.groupBy !== undefined) {
    const dim = fieldOf(source, query.groupBy);
    const fields: QueryFieldDto[] = [
      { key: dim.key, label: dim.label, type: dim.type },
      { key: COUNT_KEY, label: "Count", type: "num" },
    ];
    const text =
      `SELECT ${dim.column}::text AS "${dim.key}", count(*)::int AS "${COUNT_KEY}" ` +
      `FROM ${source.table} WHERE ${where} ` +
      `GROUP BY ${dim.column} ORDER BY count(*) DESC${limitSql}`;
    return { text, params: params.all(), fields };
  }

  const keys =
    query.columns !== undefined && query.columns.length > 0
      ? query.columns
      : [...source.defaultColumns];
  const fields = keys.map((k) => {
    const field = fieldOf(source, k);
    return { key: field.key, label: field.label, type: field.type };
  });
  const projection = keys.map((k) => `${fieldOf(source, k).column} AS "${k}"`).join(", ");

  let orderSql = "";
  if (query.sort !== null && query.sort !== undefined) {
    const sortField = fieldOf(source, query.sort.field);
    orderSql = ` ORDER BY ${sortField.column} ${query.sort.dir === "desc" ? "DESC" : "ASC"}`;
  }

  const text = `SELECT ${projection} FROM ${source.table} WHERE ${where}${orderSql}${limitSql}`;
  return { text, params: params.all(), fields };
}

/** Count matching the filters, before `limit` — the "N of M" denominator. */
export function compileTotalQuery(query: Query): CompiledQuery {
  const source = requireSource(query);
  const params = new Params();
  const where = whereSql(source, query, params);
  return {
    text: `SELECT count(*)::int AS "total" FROM ${source.table} WHERE ${where}`,
    params: params.all(),
    fields: [{ key: "total", label: "Total", type: "num" }],
  };
}

/** Metric (KPI): a single scalar aggregate. */
export function compileMetricQuery(query: Query): CompiledQuery {
  const source = requireSource(query);
  const params = new Params();
  const where = whereSql(source, query, params);
  const value = aggSql(source, query.agg ?? "count", query.measure);
  return {
    text: `SELECT ${value} AS "value" FROM ${source.table} WHERE ${where}`,
    params: params.all(),
    fields: [{ key: "value", label: "Value", type: "num" }],
  };
}

/** Series (bar/pie/line): aggregate grouped by a dimension, largest first. */
export function compileSeriesQuery(query: Query): CompiledQuery {
  const source = requireSource(query);
  if (query.dimension === null || query.dimension === undefined || query.dimension === "") {
    throw new QueryError("A series query requires a dimension");
  }
  const dim = fieldOf(source, query.dimension);
  const params = new Params();
  const where = whereSql(source, query, params);
  const value = aggSql(source, query.agg ?? "count", query.measure);
  const limit = clampLimit(query.limit);
  const limitSql = limit === null ? "" : ` LIMIT ${limit}`;
  const text =
    `SELECT ${dim.column}::text AS "label", ${value} AS "value" ` +
    `FROM ${source.table} WHERE ${where} ` +
    `GROUP BY ${dim.column} ORDER BY ${value} DESC NULLS LAST${limitSql}`;
  return {
    text,
    params: params.all(),
    fields: [
      { key: "label", label: dim.label, type: "text" },
      { key: "value", label: "Value", type: "num" },
    ],
  };
}
