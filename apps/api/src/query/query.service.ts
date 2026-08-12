import { Injectable } from "@nestjs/common";
import { type Tx } from "@kaenal/db";
import {
  compileMetricQuery,
  compileRowsQuery,
  compileSeriesQuery,
  compileTotalQuery,
  QueryError,
  type CompiledQuery,
} from "@kaenal/core";
import type {
  Query,
  QueryMetricResult,
  QueryRowsResult,
  QuerySeriesResult,
} from "@kaenal/types";
import { ApiError } from "../errors.js";

/**
 * Executes a compiled {@link Query} on the request's tenant-scoped transaction
 * (Part B2). The compiler in `@kaenal/core` owns all safety — whitelisted
 * identifiers, bound parameters — so this service only runs the statement and
 * coerces driver types (pg returns `numeric`/`timestamptz` as strings/Dates) to
 * the JSON shape the DTOs promise. A {@link QueryError} (a query that references
 * something off the whitelist) surfaces as a 422, never a 500.
 */
@Injectable()
export class QueryService {
  async runRows(tx: Tx, query: Query): Promise<QueryRowsResult> {
    const compiled = compile(() => compileRowsQuery(query));
    const total = compile(() => compileTotalQuery(query));
    // Sequential: one pg connection cannot multiplex two queries on the same tx.
    const rowsRes = await tx.query<Record<string, unknown>>(compiled.text, compiled.params);
    const totalRes = await tx.query<{ total: number }>(total.text, total.params);
    const rows = rowsRes.rows.map((row) => shapeRow(row, compiled));
    return { fields: compiled.fields, rows, total: Number(totalRes.rows[0]?.total ?? 0) };
  }

  async runMetric(tx: Tx, query: Query): Promise<QueryMetricResult> {
    const compiled = compile(() => compileMetricQuery(query));
    const { rows } = await tx.query<{ value: unknown }>(compiled.text, compiled.params);
    return { value: toNumberOrNull(rows[0]?.value) };
  }

  async runSeries(tx: Tx, query: Query): Promise<QuerySeriesResult> {
    const compiled = compile(() => compileSeriesQuery(query));
    // The dimension is cast to `::text` in the compiled SQL, so pg returns the
    // label as a string (or null for a null group).
    const { rows } = await tx.query<{ label: string | null; value: unknown }>(
      compiled.text,
      compiled.params,
    );
    const points = rows.map((r) => ({
      label: r.label ?? "—",
      value: toNumberOrNull(r.value) ?? 0,
    }));
    return { points };
  }
}

/** Turns a compile-time {@link QueryError} into the 422 envelope. */
function compile(build: () => CompiledQuery): CompiledQuery {
  try {
    return build();
  } catch (err) {
    if (err instanceof QueryError) throw new ApiError("VALIDATION_FAILED", err.message);
    throw err;
  }
}

/** One DB row → a `{key: string|number|null}` record per the compiled fields. */
function shapeRow(
  row: Record<string, unknown>,
  compiled: CompiledQuery,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const field of compiled.fields) {
    const v = row[field.key];
    if (v === null || v === undefined) {
      out[field.key] = null;
    } else if (field.type === "num") {
      out[field.key] = toNumberOrNull(v);
    } else {
      out[field.key] = toText(v);
    }
  }
  return out;
}

/** Coerce a driver value to a display string without stringifying an object. */
function toText(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  return JSON.stringify(v);
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
