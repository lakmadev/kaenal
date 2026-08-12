import { z } from "zod";

/**
 * The query model (KAENAL_IMPLEMENTATION.md Part B2) — one JSON shape that a
 * table, KPI, or chart series all compile from. Shared by the web report
 * builder (preview) and the API (`packages/core/query.ts` compiles it to
 * parameterised SQL). Column/op/agg names are validated here as *shape*; that a
 * given `field` actually belongs to the chosen source is a whitelist check the
 * compiler makes against the server-side source registry (never string input).
 *
 * `≠` is the prototype's inequality glyph (report-data.jsx `RB_OPS`); kept
 * verbatim so the builder UI and the wire agree.
 */

export const QUERY_OPS = ["=", "≠", "contains", ">", "<"] as const;
export const QueryOp = z.enum(QUERY_OPS);
export type QueryOp = z.infer<typeof QueryOp>;

export const QUERY_AGGS = ["count", "sum", "avg", "min", "max"] as const;
export const QueryAgg = z.enum(QUERY_AGGS);
export type QueryAgg = z.infer<typeof QueryAgg>;

export const QuerySortDir = z.enum(["asc", "desc"]);
export type QuerySortDir = z.infer<typeof QuerySortDir>;

/** Field types the builder distinguishes (report-data.jsx only knows text|num). */
export const QueryFieldType = z.enum(["text", "num"]);
export type QueryFieldType = z.infer<typeof QueryFieldType>;

export const QueryFilter = z.object({
  field: z.string().min(1).max(64),
  op: QueryOp,
  // Values always land as bound parameters, so the type is deliberately loose;
  // numeric comparisons coerce server-side.
  value: z.string().max(200),
});
export type QueryFilter = z.infer<typeof QueryFilter>;

export const QuerySort = z.object({ field: z.string().min(1).max(64), dir: QuerySortDir });
export type QuerySort = z.infer<typeof QuerySort>;

/** Hard ceiling on returned rows / series points, enforced by the compiler too. */
export const QUERY_MAX_LIMIT = 1000;

export const Query = z.object({
  sourceId: z.string().min(1).max(64),
  // table / repeater
  columns: z.array(z.string().min(1).max(64)).max(64).optional(),
  sort: QuerySort.nullish(),
  groupBy: z.string().min(1).max(64).nullish(),
  limit: z.number().int().positive().max(QUERY_MAX_LIMIT).nullish(),
  // metric (KPI) & series (bar/pie/line)
  agg: QueryAgg.optional(),
  measure: z.string().min(1).max(64).nullish(),
  dimension: z.string().min(1).max(64).nullish(),
  filters: z.array(QueryFilter).max(32).optional(),
});
export type Query = z.infer<typeof Query>;

// --- Result & metadata DTOs (Zod, so the ts-rest contract can validate) ------

/** A queryable field as exposed to the client — never carries the DB column. */
export const QueryFieldDto = z.object({
  key: z.string(),
  label: z.string(),
  type: QueryFieldType,
});
export type QueryFieldDto = z.infer<typeof QueryFieldDto>;

/** A data source the caller may query (filtered to their capabilities). */
export const QuerySourceDto = z.object({
  id: z.string(),
  label: z.string(),
  origin: z.string(),
  fields: z.array(QueryFieldDto),
  defaultColumns: z.array(z.string()),
});
export type QuerySourceDto = z.infer<typeof QuerySourceDto>;

export const QuerySourcesResult = z.object({ items: z.array(QuerySourceDto) });
export type QuerySourcesResult = z.infer<typeof QuerySourcesResult>;

export const QueryCell = z.union([z.string(), z.number(), z.null()]);
export type QueryCell = z.infer<typeof QueryCell>;

export const QueryRowsResult = z.object({
  fields: z.array(QueryFieldDto),
  rows: z.array(z.record(QueryCell)),
  /** Rows matching the filters, before `limit` — powers "N of M" captions. */
  total: z.number(),
});
export type QueryRowsResult = z.infer<typeof QueryRowsResult>;

export const QueryMetricResult = z.object({ value: z.number().nullable() });
export type QueryMetricResult = z.infer<typeof QueryMetricResult>;

export const QuerySeriesPoint = z.object({ label: z.string(), value: z.number() });
export type QuerySeriesPoint = z.infer<typeof QuerySeriesPoint>;

export const QuerySeriesResult = z.object({ points: z.array(QuerySeriesPoint) });
export type QuerySeriesResult = z.infer<typeof QuerySeriesResult>;
