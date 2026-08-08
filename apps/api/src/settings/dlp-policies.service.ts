import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import type {
  CreateDlpPolicyBody,
  DlpPolicyDto,
  Page,
  UpdateDlpPolicyBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface PolicyRow {
  id: string;
  name: string;
  pattern: string;
  action: string;
  surface: string;
  note: string;
  enabled: boolean;
  lock_version: number;
}

const COLS = "id, name, pattern, action, surface, note, enabled, lock_version";
const ENTITY_KIND = "dlp_policy";

function toDto(row: PolicyRow): DlpPolicyDto {
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    action: row.action as DlpPolicyDto["action"],
    surface: row.surface,
    note: row.note,
    enabled: row.enabled,
    lockVersion: row.lock_version,
  };
}

/**
 * DLP policy register CRUD (04 §Settings > Compliance & Privacy; table 0028).
 * Policies are managed under `settings:manage` and every change is audited in
 * the same transaction (rule 3); edits are optimistic (rule 6). There is no
 * runtime enforcement point yet (pre-egress interception is a later slice), so
 * these are a stored register the settings editor lists and toggles.
 */
@Injectable()
export class DlpPoliciesService {
  async list(tx: Tx): Promise<Page<DlpPolicyDto>> {
    const { rows } = await tx.query<PolicyRow>(
      `SELECT ${COLS} FROM dlp_policies WHERE deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
    );
    return { items: rows.map(toDto), nextCursor: null };
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateDlpPolicyBody,
    context: AuditContext,
  ): Promise<DlpPolicyDto> {
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
        after: { name: body.name, action: body.action, surface: body.surface },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<PolicyRow>(
          `INSERT INTO dlp_policies
             (id, tenant_id, name, pattern, action, surface, note, enabled, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
           RETURNING ${COLS}`,
          [id, tenantId, body.name, body.pattern, body.action, body.surface, body.note, body.enabled, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Policy was not created");
        return toDto(row);
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateDlpPolicyBody,
    context: AuditContext,
  ): Promise<DlpPolicyDto> {
    const { rows: existing } = await tx.query<PolicyRow>(
      `SELECT ${COLS} FROM dlp_policies WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const current = existing[0];
    if (current === undefined) throw notFound();
    if (current.lock_version !== body.version) {
      throw new ApiError("STALE_WRITE", "This policy changed since you loaded it", {
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
        const { rows } = await t.query<PolicyRow>(
          `UPDATE dlp_policies
              SET name=$3, pattern=$4, action=$5, surface=$6, note=$7, enabled=$8, updated_by=$9
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL
            RETURNING ${COLS}`,
          [id, body.version, body.name, body.pattern, body.action, body.surface, body.note, body.enabled, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "This policy changed since you loaded it");
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
  ): Promise<DlpPolicyDto> {
    const { rows } = await tx.query<PolicyRow>(
      `SELECT ${COLS} FROM dlp_policies WHERE id = $1 AND deleted_at IS NULL`,
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
        const { rows: updated } = await t.query<PolicyRow>(
          `UPDATE dlp_policies SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, actorId],
        );
        return toDto(updated[0] ?? row);
      },
    );
  }
}
