import { describe, expect, it } from "vitest";
import type { Query } from "@kaenal/types";
import {
  compileMetricQuery,
  compileRowsQuery,
  compileSeriesQuery,
  compileTotalQuery,
  getQuerySource,
  QUERY_SOURCES,
  QueryError,
  toQuerySourceDto,
} from "../src/query.js";

const q = (patch: Partial<Query> & { sourceId: string }): Query => ({ ...patch });

describe("query source registry", () => {
  it("exposes the seven Kaenal-native sources, each mapped to a *:view capability", () => {
    expect(Object.keys(QUERY_SOURCES).sort()).toEqual([
      "audit",
      "capa",
      "eightd",
      "finding",
      "inspection",
      "ncr",
      "supplier",
    ]);
    for (const s of Object.values(QUERY_SOURCES)) expect(s.capability).toMatch(/:view$/);
  });

  it("never leaks the DB column in the public source DTO", () => {
    const ncr = getQuerySource("ncr");
    if (ncr === undefined) throw new Error("ncr source missing");
    const dto = toQuerySourceDto(ncr);
    expect(dto.fields.every((f) => !("column" in f))).toBe(true);
    expect(dto.defaultColumns).toContain("code");
  });
});

describe("compileRowsQuery", () => {
  it("projects the default columns when none are given", () => {
    const c = compileRowsQuery(q({ sourceId: "ncr" }));
    expect(c.fields.map((f) => f.key)).toEqual(["code", "title", "status", "priority", "slaState"]);
    expect(c.text).toContain('FROM ncrs WHERE deleted_at IS NULL');
    expect(c.text).toContain('sla_state AS "slaState"');
  });

  it("groups into a count when groupBy is set", () => {
    const c = compileRowsQuery(q({ sourceId: "ncr", groupBy: "status" }));
    expect(c.fields.map((f) => f.key)).toEqual(["status", "__count"]);
    expect(c.text).toContain("GROUP BY status");
    expect(c.text).toContain("count(*)::int");
  });

  it("caps the limit at 1000", () => {
    expect(compileRowsQuery(q({ sourceId: "ncr", limit: 99999 })).text).toContain("LIMIT 1000");
  });

  it("orders by a whitelisted sort column", () => {
    const c = compileRowsQuery(q({ sourceId: "ncr", sort: { field: "createdAt", dir: "desc" } }));
    expect(c.text).toContain("ORDER BY created_at DESC");
  });
});

describe("whitelist enforcement (the injection boundary)", () => {
  it("throws on an unknown source", () => {
    expect(() => compileRowsQuery(q({ sourceId: "secrets" }))).toThrow(QueryError);
    expect(getQuerySource("secrets")).toBeUndefined();
  });

  it("throws on an unknown column / filter field / sort field / dimension", () => {
    expect(() => compileRowsQuery(q({ sourceId: "ncr", columns: ["password"] }))).toThrow(QueryError);
    expect(() =>
      compileRowsQuery(q({ sourceId: "ncr", filters: [{ field: "x", op: "=", value: "y" }] })),
    ).toThrow(QueryError);
    expect(() =>
      compileRowsQuery(q({ sourceId: "ncr", sort: { field: "boom", dir: "asc" } })),
    ).toThrow(QueryError);
    expect(() => compileSeriesQuery(q({ sourceId: "ncr", dimension: "nope" }))).toThrow(QueryError);
  });

  it("binds a malicious filter value as a parameter, never as SQL", () => {
    const evil = "'; DROP TABLE ncrs; --";
    const c = compileRowsQuery(q({ sourceId: "ncr", filters: [{ field: "title", op: "contains", value: evil }] }));
    // The dangerous string is a bound param; the SQL text only references $1.
    expect(c.params).toContain(evil);
    expect(c.text).not.toContain("DROP TABLE");
    expect(c.text).toContain("$1");
  });

  it("compiles each operator to a safe, parameterised fragment", () => {
    const ops: Query["filters"] = [
      { field: "status", op: "=", value: "open" },
      { field: "status", op: "≠", value: "closed" },
      { field: "title", op: "contains", value: "weld" },
    ];
    const c = compileRowsQuery(q({ sourceId: "ncr", filters: ops }));
    expect(c.text).toContain("lower(status::text) = lower($1)");
    expect(c.text).toContain("IS DISTINCT FROM");
    expect(c.text).toContain("ILIKE");
    expect(c.params).toEqual(["open", "closed", "weld"]);
  });

  it("numeric comparisons cast the bound param, text comparisons compare as text", () => {
    const numeric = compileRowsQuery(q({ sourceId: "inspection", filters: [{ field: "score", op: ">", value: "80" }] }));
    expect(numeric.text).toContain("score > $1::numeric");
    const textual = compileRowsQuery(q({ sourceId: "ncr", filters: [{ field: "createdAt", op: ">", value: "2026-01-01" }] }));
    expect(textual.text).toContain("created_at::text > $1");
  });
});

describe("compileMetricQuery", () => {
  it("counts rows by default", () => {
    expect(compileMetricQuery(q({ sourceId: "ncr" })).text).toContain("count(*)::int");
  });

  it("aggregates a numeric measure, rounding averages", () => {
    expect(compileMetricQuery(q({ sourceId: "inspection", agg: "sum", measure: "score" })).text).toContain("sum(score)");
    expect(compileMetricQuery(q({ sourceId: "inspection", agg: "avg", measure: "score" })).text).toContain("round(avg(score)");
  });

  it("rejects a non-numeric measure", () => {
    expect(() => compileMetricQuery(q({ sourceId: "ncr", agg: "sum", measure: "status" }))).toThrow(QueryError);
  });
});

describe("compileSeriesQuery", () => {
  it("requires a dimension and orders by the aggregate", () => {
    expect(() => compileSeriesQuery(q({ sourceId: "ncr" }))).toThrow(QueryError);
    const c = compileSeriesQuery(q({ sourceId: "ncr", dimension: "priority" }));
    expect(c.text).toContain('priority::text AS "label"');
    expect(c.text).toContain("GROUP BY priority");
    expect(c.text).toContain("ORDER BY count(*)::int DESC");
    expect(c.fields.map((f) => f.key)).toEqual(["label", "value"]);
  });
});

describe("compileTotalQuery", () => {
  it("counts matching rows before the limit", () => {
    const c = compileTotalQuery(q({ sourceId: "ncr", limit: 5 }));
    expect(c.text).toBe('SELECT count(*)::int AS "total" FROM ncrs WHERE deleted_at IS NULL');
  });
});
