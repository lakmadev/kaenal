import { Controller, Get, Inject, Query } from "@nestjs/common";
import { EntityRefQuery, PageQuery, type AuditEventDto, type Page } from "@kaenal/types";
import { currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { AUDIT_LOG_SERVICE } from "../tokens.js";
import type { AuditLogService } from "./audit-log.service.js";

const ListQuery = EntityRefQuery.merge(PageQuery);

/**
 * Access-log route (FEATURES §9, 07 §1). Authenticated-only: the service gates
 * on the parent record being visible to the caller, and returns a payload-free
 * projection, so a member reads the history of records they can already see
 * without a bespoke capability. `@Internal`: record history is internal-only.
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
}
