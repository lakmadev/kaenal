import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  AuditLogQuery,
  EntityRefQuery,
  PageQuery,
  type AuditEventDto,
  type AuditLogEntryDto,
  type Page,
} from "@kaenal/types";
import { currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { AUDIT_LOG_SERVICE } from "../tokens.js";
import type { AuditLogFilters, AuditLogService } from "./audit-log.service.js";

const ListQuery = EntityRefQuery.merge(PageQuery);

/** Strip the page controls off a parsed audit-log query → the filter object. */
function toFilters(q: AuditLogQuery): AuditLogFilters {
  const { cursor: _cursor, limit: _limit, ...filters } = q;
  return filters;
}

/**
 * Access-log routes.
 *
 * `GET /v1/audit-events` (FEATURES §9, 07 §1) is a record's own history: the
 * service gates on the parent record being visible to the caller and returns a
 * payload-free projection, so a member reads the history of records they can
 * already see without a bespoke capability.
 *
 * `GET /v1/audit-log` + `/export` are the tenant-wide security trail — every
 * mutation across the workspace — so they are admin-gated by `auditlog:read`
 * (distinct from the QMS `audit:*` module). `@Internal`: record history and the
 * workspace trail are both internal-only (a supplier-portal partner has none).
 */
@Internal()
@Controller()
export class AuditLogController {
  constructor(@Inject(AUDIT_LOG_SERVICE) private readonly auditLog: AuditLogService) {}

  @Get("v1/audit-events")
  async list(@Query() query: unknown): Promise<Page<AuditEventDto>> {
    const q = parse(ListQuery, query);
    return this.auditLog.list(currentTx(), q.entityKind, q.entityId, {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/audit-log")
  @RequireCapability("auditlog:read")
  async listTenant(@Query() query: unknown): Promise<Page<AuditLogEntryDto>> {
    const q = parse(AuditLogQuery, query);
    return this.auditLog.listTenant(currentTx(), toFilters(q), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/audit-log/export")
  @RequireCapability("auditlog:read")
  async exportCsv(
    @Query() query: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const q = parse(AuditLogQuery, query);
    const rows = await this.auditLog.exportRows(currentTx(), toFilters(q));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return toCsv(rows);
  }
}

const CSV_HEADERS = [
  "When",
  "Actor",
  "Actor type",
  "Action",
  "Target",
  "Entity kind",
  "Entity id",
  "Reason",
  "IP",
  "Sensitive",
] as const;

/** Minimal RFC-4180 escaping — quote when the cell holds a comma, quote, or newline. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: readonly AuditLogEntryDto[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt,
        r.actorName,
        r.actorKind,
        r.action,
        r.targetLabel,
        r.entityKind,
        r.entityId,
        r.reason ?? "",
        r.ip ?? "",
        r.sensitive ? "yes" : "",
      ]
        .map((c) => csvCell(String(c)))
        .join(","),
    );
  }
  // Trailing newline so the file ends cleanly in editors/Excel.
  return `${lines.join("\r\n")}\r\n`;
}
