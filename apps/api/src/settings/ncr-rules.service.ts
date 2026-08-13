import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import type {
  CreateNcrValidationRuleBody,
  NcrValidationRuleDto,
  Page,
  UpdateNcrValidationRuleBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface RuleRow {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: string;
  action: string;
  message: string;
  enabled: boolean;
  lock_version: number;
}

const COLS = "id, name, field, operator, value, action, message, enabled, lock_version";
const ENTITY_KIND = "ncr_validation_rule";

function toDto(row: RuleRow): NcrValidationRuleDto {
  return {
    id: row.id,
    name: row.name,
    field: row.field as NcrValidationRuleDto["field"],
    operator: row.operator as NcrValidationRuleDto["operator"],
    value: row.value,
    action: row.action as NcrValidationRuleDto["action"],
    message: row.message,
    enabled: row.enabled,
    lockVersion: row.lock_version,
  };
}

/**
 * NCR validation rules CRUD (04 §Settings > Process). Rules are managed under
 * `settings:manage` and enforced on NCR create by `NcrService` via the pure
 * `firingBlockRules` evaluator in `@kaenal/core`. Every change is audited in the
 * same transaction (rule 3); edits are optimistic (rule 6).
 */
@Injectable()
export class NcrRulesService {
  async list(tx: Tx): Promise<Page<NcrValidationRuleDto>> {
    const { rows } = await tx.query<RuleRow>(
      `SELECT ${COLS} FROM ncr_validation_rules WHERE deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
    );
    return { items: rows.map(toDto), nextCursor: null };
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateNcrValidationRuleBody,
    context: AuditContext,
  ): Promise<NcrValidationRuleDto> {
    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        after: { name: body.name, field: body.field, action: body.action },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<RuleRow>(
          `INSERT INTO ncr_validation_rules
             (id, tenant_id, name, field, operator, value, action, message, enabled, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
           RETURNING ${COLS}`,
          [id, tenantId, body.name, body.field, body.operator, body.value, body.action, body.message, body.enabled, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Rule was not created");
        return toDto(row);
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateNcrValidationRuleBody,
    context: AuditContext,
  ): Promise<NcrValidationRuleDto> {
    const { rows: existing } = await tx.query<RuleRow>(
      `SELECT ${COLS} FROM ncr_validation_rules WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const current = existing[0];
    if (current === undefined) throw notFound();
    if (current.lock_version !== body.version) {
      throw new ApiError("STALE_WRITE", "This rule changed since you loaded it", {
        expected: body.version,
        actual: current.lock_version,
      });
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        before: { name: current.name, action: current.action, enabled: current.enabled },
        after: { name: body.name, action: body.action, enabled: body.enabled },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<RuleRow>(
          `UPDATE ncr_validation_rules
              SET name=$3, field=$4, operator=$5, value=$6, action=$7, message=$8, enabled=$9, updated_by=$10
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL
            RETURNING ${COLS}`,
          [id, body.version, body.name, body.field, body.operator, body.value, body.action, body.message, body.enabled, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "This rule changed since you loaded it");
        return toDto(row);
      },
    );
  }

  async remove(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
  ): Promise<NcrValidationRuleDto> {
    const { rows } = await tx.query<RuleRow>(
      `SELECT ${COLS} FROM ncr_validation_rules WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        before: { name: row.name, deleted: false },
        after: { name: row.name, deleted: true },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<RuleRow>(
          `UPDATE ncr_validation_rules SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, actorId],
        );
        return toDto(updated[0] ?? row);
      },
    );
  }
}
