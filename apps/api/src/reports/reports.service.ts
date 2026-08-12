import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { BUILTIN_DASHBOARDS, builtinDashboard, isBuiltinDashboardId } from "@kaenal/core";
import {
  ReportDoc,
  type CreateReportBody,
  type Page,
  type ReportDefinitionDto,
  type ReportDoc as ReportDocT,
  type UpdateReportBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface ReportRow {
  id: string;
  name: string;
  description: string;
  definition: unknown;
  lock_version: number;
}

const COLS = "id, name, description, definition, lock_version";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Saved reports & built-in dashboards (Data Platform B3; table 0031). A report
 * is a JSON document of tiles, each binding a query-engine `Query`; the render
 * path is the engine itself. Reads need `report:view`, authoring needs
 * `report:manage` (the split that closes the A3 viewer-authoring gap). Built-in
 * dashboards come from `@kaenal/core` constants — listed alongside user reports
 * but read-only (any write to a `builtin-*` id is refused).
 */
@Injectable()
export class ReportsService {
  async list(tx: Tx): Promise<Page<ReportDefinitionDto>> {
    const { rows } = await tx.query<ReportRow>(
      `SELECT ${COLS} FROM report_definitions WHERE deleted_at IS NULL
        ORDER BY created_at DESC, id DESC`,
    );
    // Built-ins first, then the tenant's own reports.
    const items = [...BUILTIN_DASHBOARDS, ...rows.map(toDto)];
    return { items, nextCursor: null };
  }

  async get(tx: Tx, id: string): Promise<ReportDefinitionDto> {
    if (isBuiltinDashboardId(id)) {
      const builtin = builtinDashboard(id);
      if (builtin === undefined) throw notFound();
      return builtin;
    }
    return toDto(await this.load(tx, id));
  }

  private async load(tx: Tx, id: string): Promise<ReportRow> {
    // A non-uuid id (e.g. an unknown built-in key) must 404, not blow up the
    // `= $1::uuid` cast with a 500.
    if (!UUID_RE.test(id)) throw notFound();
    const { rows } = await tx.query<ReportRow>(
      `SELECT ${COLS} FROM report_definitions WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async create(tx: Tx, tenantId: string, actorId: string, body: CreateReportBody, ctx: AuditContext): Promise<ReportDefinitionDto> {
    const id = randomUUID();
    const doc = docFrom(body);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "created", id, ctx, { after: { name: body.name, tiles: doc.tiles.length } }),
      async (t) => {
        const { rows } = await t.query<ReportRow>(
          `INSERT INTO report_definitions (id, tenant_id, name, description, definition, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING ${COLS}`,
          [id, tenantId, body.name, body.description, JSON.stringify(doc), actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Report was not created");
        return toDto(row);
      },
    );
  }

  async update(tx: Tx, tenantId: string, actorId: string, id: string, body: UpdateReportBody, ctx: AuditContext): Promise<ReportDefinitionDto> {
    refuseBuiltin(id);
    const current = await this.load(tx, id);
    assertVersion(current.lock_version, body.version);
    const doc = docFrom(body);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", id, ctx, { before: { name: current.name }, after: { name: body.name, tiles: doc.tiles.length } }),
      async (t) => {
        const { rows } = await t.query<ReportRow>(
          `UPDATE report_definitions SET name=$3, description=$4, definition=$5, updated_by=$6
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, body.version, body.name, body.description, JSON.stringify(doc), actorId],
        );
        const row = rows[0];
        if (row === undefined) throw staleWrite();
        return toDto(row);
      },
    );
  }

  async remove(tx: Tx, tenantId: string, actorId: string, id: string, ctx: AuditContext): Promise<ReportDefinitionDto> {
    refuseBuiltin(id);
    const row = await this.load(tx, id);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "deleted", id, ctx, { before: { name: row.name, deleted: false }, after: { deleted: true } }),
      async (t) => {
        const { rows } = await t.query<ReportRow>(
          `UPDATE report_definitions SET deleted_at = now(), updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, actorId],
        );
        return toDto(rows[0] ?? row);
      },
    );
  }
}

/** Parse the body's document fields through the Zod schema (fills defaults). */
function docFrom(body: CreateReportBody): ReportDocT {
  return ReportDoc.parse({
    filters: body.filters ?? [],
    branding: body.branding ?? null,
    tiles: body.tiles ?? [],
  });
}

function toDto(row: ReportRow): ReportDefinitionDto {
  const doc = ReportDoc.parse(row.definition ?? {});
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    filters: doc.filters,
    branding: doc.branding ?? null,
    tiles: doc.tiles,
    builtin: false,
    lockVersion: row.lock_version,
  };
}

function refuseBuiltin(id: string): void {
  if (isBuiltinDashboardId(id)) {
    throw new ApiError("FORBIDDEN", "Built-in dashboards cannot be edited");
  }
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ApiError("STALE_WRITE", "This report changed since you loaded it", { expected, actual });
  }
}
function staleWrite(): ApiError {
  return new ApiError("STALE_WRITE", "This report changed since you loaded it");
}

type AuditVerb = "created" | "updated" | "deleted";
function audit(
  actorId: string,
  action: AuditVerb,
  entityId: string,
  ctx: AuditContext,
  data: { before?: Record<string, unknown>; after?: Record<string, unknown> },
) {
  return {
    actorId,
    actorKind: "user" as const,
    entityKind: "report_definition",
    entityId,
    action,
    ...(data.before !== undefined ? { before: data.before } : {}),
    ...(data.after !== undefined ? { after: data.after } : {}),
    requestId: ctx.requestId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}
