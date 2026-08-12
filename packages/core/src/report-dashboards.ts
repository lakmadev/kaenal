/**
 * Built-in dashboards (KAENAL_IMPLEMENTATION.md B3; prebuilt-dashboards.jsx).
 *
 * The prototype's three dashboards (Quality Overview, Inspection Performance,
 * Compliance) are reproduced here as **engine-backed** report definitions —
 * every tile binds a real `Query` over a Kaenal-native source, so they render
 * through exactly the same `/v1/query*` path as a user-authored report. They are
 * code constants, not tenant rows: identical for every tenant and read-only.
 *
 * Honesty note: the prototype also carries many hand-drawn mock charts (cost-of-
 * quality breakdown, MTBF, IATF gap matrix, cert-expiration tables) whose data
 * has no backing entity in the current schema. Those are intentionally NOT
 * fabricated here — a built-in dashboard shows only tiles the engine can truly
 * compute. The decorative-only charts are a flagged follow-up (they need a
 * cost-of-quality / calibration / certificate data model that does not exist).
 */

import type { ReportDefinitionDto } from "@kaenal/types";

const dashboard = (
  id: string,
  name: string,
  description: string,
  tiles: ReportDefinitionDto["tiles"],
): ReportDefinitionDto => ({
  id,
  name,
  description,
  filters: [],
  branding: null,
  tiles,
  builtin: true,
  lockVersion: 0,
});

export const BUILTIN_DASHBOARDS: readonly ReportDefinitionDto[] = [
  dashboard(
    "builtin-quality-overview",
    "Quality Overview",
    "Non-conformity health across the workspace — live.",
    [
      {
        id: "q-open-ncrs",
        title: "Open NCRs",
        viz: "kpi",
        query: { sourceId: "ncr", agg: "count", filters: [{ field: "status", op: "≠", value: "closed" }] },
        layout: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: "q-critical-ncrs",
        title: "Critical NCRs",
        viz: "kpi",
        query: { sourceId: "ncr", agg: "count", filters: [{ field: "priority", op: "=", value: "critical" }] },
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        id: "q-ncr-by-priority",
        title: "NCRs by priority",
        viz: "bar",
        query: { sourceId: "ncr", dimension: "priority" },
        layout: { x: 12, y: 0, w: 12, h: 8 },
      },
      {
        id: "q-ncr-by-status",
        title: "NCRs by status",
        viz: "pie",
        query: { sourceId: "ncr", dimension: "status" },
        layout: { x: 0, y: 4, w: 12, h: 8 },
      },
      {
        id: "q-recent-ncrs",
        title: "Recent NCRs",
        viz: "datatable",
        query: {
          sourceId: "ncr",
          columns: ["code", "title", "status", "priority", "slaState"],
          sort: { field: "createdAt", dir: "desc" },
          limit: 10,
        },
        layout: { x: 0, y: 12, w: 24, h: 10 },
      },
    ],
  ),
  dashboard(
    "builtin-inspection-performance",
    "Inspection Performance",
    "Inspection throughput, pass rate, and scores — live.",
    [
      {
        id: "i-completed",
        title: "Completed inspections",
        viz: "kpi",
        query: { sourceId: "inspection", agg: "count", filters: [{ field: "status", op: "=", value: "completed" }] },
        layout: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: "i-avg-score",
        title: "Average score",
        viz: "kpi",
        query: { sourceId: "inspection", agg: "avg", measure: "score" },
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        id: "i-by-status",
        title: "Inspections by status",
        viz: "bar",
        query: { sourceId: "inspection", dimension: "status" },
        layout: { x: 12, y: 0, w: 12, h: 8 },
      },
      {
        id: "i-recent",
        title: "Recent inspections",
        viz: "datatable",
        query: {
          sourceId: "inspection",
          columns: ["code", "title", "status", "risk", "score"],
          sort: { field: "createdAt", dir: "desc" },
          limit: 10,
        },
        layout: { x: 0, y: 8, w: 24, h: 10 },
      },
    ],
  ),
  dashboard(
    "builtin-compliance",
    "Compliance",
    "Audit posture across the workspace — live.",
    [
      {
        id: "c-open-audits",
        title: "Open audits",
        viz: "kpi",
        query: { sourceId: "audit", agg: "count", filters: [{ field: "status", op: "≠", value: "closed" }] },
        layout: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: "c-by-type",
        title: "Audits by type",
        viz: "pie",
        query: { sourceId: "audit", dimension: "type" },
        layout: { x: 6, y: 0, w: 9, h: 8 },
      },
      {
        id: "c-by-status",
        title: "Audits by status",
        viz: "bar",
        query: { sourceId: "audit", dimension: "status" },
        layout: { x: 15, y: 0, w: 9, h: 8 },
      },
      {
        id: "c-recent",
        title: "Audits",
        viz: "datatable",
        query: {
          sourceId: "audit",
          columns: ["code", "title", "status", "type", "progress"],
          sort: { field: "createdAt", dir: "desc" },
          limit: 10,
        },
        layout: { x: 0, y: 8, w: 24, h: 10 },
      },
    ],
  ),
];

export function builtinDashboard(id: string): ReportDefinitionDto | undefined {
  return BUILTIN_DASHBOARDS.find((d) => d.id === id);
}

export function isBuiltinDashboardId(id: string): boolean {
  return id.startsWith("builtin-");
}
