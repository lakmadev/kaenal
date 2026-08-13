import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import type { CreateEntityLinkBody, EntityKind, EntityLinkDto, Page } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { assertEntityVisible } from "./entity-ref.js";

interface LinkRow {
  id: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string;
  created_at: Date;
}

const LINK_COLUMNS = "id, from_kind, from_id, to_kind, to_id, relation, created_at";
// Related records are few per entity; one capped page covers every real case.
const LINK_CAP = 200;

function toDto(row: LinkRow): EntityLinkDto {
  return {
    id: row.id,
    fromKind: row.from_kind as EntityKind,
    fromId: row.from_id,
    toKind: row.to_kind as EntityKind,
    toId: row.to_id,
    relation: row.relation,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Cross-module related records (FEATURES §329). A link is a directed edge stored
 * once; the detail view of a record reads edges touching it on EITHER side, so
 * the queried record sees both what it points at and what points at it. Creating
 * a link requires both endpoints to resolve within the tenant (rule 8 — a
 * foreign-tenant id is a 404, never a leak). Every link/unlink is audited on the
 * `from` record so it shows up in that record's access log.
 */
@Injectable()
export class EntityLinksService {
  async list(tx: Tx, kind: EntityKind, entityId: string): Promise<Page<EntityLinkDto>> {
    await assertEntityVisible(tx, kind, entityId);
    const { rows } = await tx.query<LinkRow>(
      `SELECT ${LINK_COLUMNS} FROM entity_links
        WHERE deleted_at IS NULL
          AND ((from_kind = $1 AND from_id = $2) OR (to_kind = $1 AND to_id = $2))
        ORDER BY created_at DESC, id DESC LIMIT $3`,
      [kind, entityId, LINK_CAP],
    );
    return { items: rows.map(toDto), nextCursor: null };
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateEntityLinkBody,
    context: AuditContext,
  ): Promise<EntityLinkDto> {
    if (body.fromKind === body.toKind && body.fromId === body.toId) {
      throw new ApiError("VALIDATION_FAILED", "A record cannot be linked to itself");
    }
    await assertEntityVisible(tx, body.fromKind, body.fromId);
    await assertEntityVisible(tx, body.toKind, body.toId);

    const relation = body.relation ?? "linked";
    const { rows: existing } = await tx.query(
      `SELECT 1 FROM entity_links
        WHERE deleted_at IS NULL AND from_kind = $1 AND from_id = $2
          AND to_kind = $3 AND to_id = $4 AND relation = $5`,
      [body.fromKind, body.fromId, body.toKind, body.toId, relation],
    );
    if (existing.length > 0) throw new ApiError("CONFLICT", "These records are already linked");

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: body.fromKind,
        entityId: body.fromId,
        action: "linked",
        after: { toKind: body.toKind, toId: body.toId, relation },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<LinkRow>(
          `INSERT INTO entity_links
             (id, tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
           RETURNING ${LINK_COLUMNS}`,
          [id, tenantId, body.fromKind, body.fromId, body.toKind, body.toId, relation, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Link was not created");
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
  ): Promise<EntityLinkDto> {
    const { rows } = await tx.query<LinkRow>(
      `SELECT ${LINK_COLUMNS} FROM entity_links WHERE id = $1 AND deleted_at IS NULL`,
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
        entityKind: row.from_kind,
        entityId: row.from_id,
        action: "unlinked",
        before: { toKind: row.to_kind, toId: row.to_id, relation: row.relation },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<LinkRow>(
          `UPDATE entity_links SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${LINK_COLUMNS}`,
          [id, actorId],
        );
        return toDto(updated[0] ?? row);
      },
    );
  }
}
