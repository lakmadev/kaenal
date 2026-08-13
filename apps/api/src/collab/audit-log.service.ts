import { Injectable } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import type { AuditEventDto, AuditAction, EntityKind, Page } from "@kaenal/types";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import { assertEntityVisible } from "./entity-ref.js";

interface AuditEventRow {
  id: string;
  entity_kind: string;
  entity_id: string;
  actor_id: string | null;
  actor_kind: string;
  action: string;
  reason: string | null;
  created_at: Date;
}

// Deliberately excludes before/after — the access log shows who/what/when
// without leaking the changed field values those columns can carry (07 §1).
const AUDIT_COLUMNS = "id, entity_kind, entity_id, actor_id, actor_kind, action, reason, created_at";

function toDto(row: AuditEventRow): AuditEventDto {
  return {
    id: row.id,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorKind: row.actor_kind,
    action: row.action as AuditAction,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * A record's access log (FEATURES §9, 07 §1) — a read-only projection of the
 * append-only `audit_events` for one entity, newest first. Gated by the same
 * parent-visibility check as comments: you can read the history of a record you
 * can see. Payloads are omitted (see AUDIT_COLUMNS), so this never becomes a
 * side channel for field values a role otherwise can't read.
 */
@Injectable()
export class AuditLogService {
  async list(
    tx: Tx,
    kind: EntityKind,
    entityId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<AuditEventDto>> {
    await assertEntityVisible(tx, kind, entityId);
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [kind, entityId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<AuditEventRow>(
      `SELECT ${AUDIT_COLUMNS} FROM audit_events
        WHERE entity_kind = $1 AND entity_id = $2 ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }
}
