import { z } from "zod";
import { Query, QueryFilter } from "./query.js";

/**
 * Report definitions (KAENAL_IMPLEMENTATION.md B3; reports.jsx). A report is a
 * set of **tiles**, each binding one query-engine {@link Query} to a
 * visualization. The builder edits this JSON; rendering is the engine — so a
 * chart is just "a query + a viz choice", nothing hardcoded.
 */

export const REPORT_WIDGET_KINDS = ["datatable", "repeater", "kpi", "bar", "pie", "line"] as const;
export const ReportWidgetKind = z.enum(REPORT_WIDGET_KINDS);
export type ReportWidgetKind = z.infer<typeof ReportWidgetKind>;

/** Grid placement of a tile on the report canvas (report-data.jsx layout). */
export const ReportTileLayout = z.object({
  x: z.number().int().min(0).max(24),
  y: z.number().int().min(0).max(1000),
  w: z.number().int().positive().max(24),
  h: z.number().int().positive().max(64),
});
export type ReportTileLayout = z.infer<typeof ReportTileLayout>;

export const ReportTile = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200).default(""),
  viz: ReportWidgetKind,
  query: Query,
  layout: ReportTileLayout.optional(),
});
export type ReportTile = z.infer<typeof ReportTile>;

/** Optional per-report branding (report-data.jsx branding block). */
export const ReportBranding = z.object({
  accent: z.string().max(32).optional(),
  logoUrl: z.string().max(500).optional(),
});
export type ReportBranding = z.infer<typeof ReportBranding>;

/** The persisted JSON document (`report_definitions.definition`). */
export const ReportDoc = z.object({
  filters: z.array(QueryFilter).max(32).default([]),
  branding: ReportBranding.nullish(),
  tiles: z.array(ReportTile).max(50).default([]),
});
export type ReportDoc = z.infer<typeof ReportDoc>;

export const CreateReportBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  filters: z.array(QueryFilter).max(32).optional(),
  branding: ReportBranding.nullish(),
  tiles: z.array(ReportTile).max(50).optional(),
});
export type CreateReportBody = z.infer<typeof CreateReportBody>;

export const UpdateReportBody = CreateReportBody.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateReportBody = z.infer<typeof UpdateReportBody>;

export const ReportDefinitionDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  filters: z.array(QueryFilter),
  branding: ReportBranding.nullable(),
  tiles: z.array(ReportTile),
  /** Built-in dashboards (code constants) are read-only; user reports are not. */
  builtin: z.boolean(),
  lockVersion: z.number(),
});
export type ReportDefinitionDto = z.infer<typeof ReportDefinitionDto>;
