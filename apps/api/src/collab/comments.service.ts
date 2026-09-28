import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { extractMentionedUserIds, type CommentDto, type CreateCommentBody, type EntityKind, type Page } from "@kaenal/types";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ApiError, notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { assertEntityVisible } from "./entity-ref.js";

interface CommentRow {
  id: string;
  entity_kind: string;
  entity_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const COMMENT_COLUMNS =
  "id, entity_kind, entity_id, author_id, body, parent_id, created_at, updated_at";

function toDto(row: CommentRow, authorNames?: ReadonlyMap<string, string>): CommentDto {
  return {
    id: row.id,
    entityKind: row.entity_kind as EntityKind,
    entityId: row.entity_id,
    authorId: row.author_id,
    authorName: authorNames?.get(row.author_id) ?? null,
    body: row.body,
    parentId: row.parent_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Batched author id → display name (control.users), one `= ANY(...)` lookup. */
async function resolveAuthorNames(tx: Tx, rows: readonly { author_id: string }[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.author_id))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { rows: users } = await tx.query<{ id: string; name: string }>(
    `SELECT id, name FROM control.users WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  for (const u of users) out.set(u.id, u.name);
  return out;
}

/**
 * Comments (02 §2, FEATURES §9). Generic over `entity_kind`/`entity_id`, so one
 * module threads discussion onto documents, NCRs, 8Ds, audits, CAPAs — anywhere
 * the design surfaces it. Posting a comment is audited as `commented` on the
 * PARENT record (not on the comment), which is exactly what the record's access
 * log wants to show. A member deletes only their own comment (soft delete);
 * tenant RLS plus the parent-visibility check keep everything in-tenant.
 */
@Injectable()
export class CommentsService {
  constructor(private readonly notifications: NotificationsService = new NotificationsService()) {}

  /**
   * Raise a `mention` notification for each @-mentioned ACTIVE member of this
   * tenant (self excluded), in the comment's own audited transaction. Unknown,
   * foreign-tenant or inactive ids are silently ignored — a mention never
   * confirms whether a user exists elsewhere (rule 8). Deduped per comment+user.
   */
  private async notifyMentions(
    tx: Tx,
    tenantId: string,
    actorId: string,
    row: CommentRow,
    authorName: string,
  ): Promise<void> {
    const ids = extractMentionedUserIds(row.body).filter((id) => id !== actorId);
    if (ids.length === 0) return;
    // RLS scopes memberships to this tenant, so a foreign id simply finds no row.
    const { rows } = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM memberships WHERE user_id = ANY($1::uuid[]) AND status = 'active'`,
      [ids],
    );
    for (const m of rows) {
      await this.notifications.notify(tx, tenantId, {
        userId: m.user_id,
        kind: "mention",
        title: `${authorName} mentioned you in a comment`,
        body: row.body.replace(/@\[([^\]]+)\]\(user:[^)]+\)/g, "@$1").slice(0, 280),
        entityKind: row.entity_kind,
        entityId: row.entity_id,
        actorId,
        dedupeKey: `mention:${row.id}:${m.user_id}`,
      });
    }
  }

  async list(
    tx: Tx,
    kind: EntityKind,
    entityId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<CommentDto>> {
    await assertEntityVisible(tx, kind, entityId);
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [kind, entityId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<CommentRow>(
      `SELECT ${COMMENT_COLUMNS} FROM comments
        WHERE entity_kind = $1 AND entity_id = $2 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    const authorNames = await resolveAuthorNames(tx, rows);
    return toPage(rows, limit, (r) => toDto(r, authorNames));
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateCommentBody,
    context: AuditContext,
  ): Promise<CommentDto> {
    await assertEntityVisible(tx, body.entityKind, body.entityId);

    // A threaded reply must belong to the same record — otherwise it would
    // graft one entity's thread onto another's.
    if (body.parentId !== undefined && body.parentId !== null) {
      const { rows } = await tx.query(
        `SELECT 1 FROM comments
          WHERE id = $1 AND entity_kind = $2 AND entity_id = $3 AND deleted_at IS NULL`,
        [body.parentId, body.entityKind, body.entityId],
      );
      if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "The parent comment was not found on this record");
    }

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: body.entityKind,
        entityId: body.entityId,
        action: "commented",
        after: { commentId: id },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<CommentRow>(
          `INSERT INTO comments
             (id, tenant_id, entity_kind, entity_id, author_id, body, parent_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$5,$5)
           RETURNING ${COMMENT_COLUMNS}`,
          [id, tenantId, body.entityKind, body.entityId, actorId, body.body, body.parentId ?? null],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Comment was not created");
        const names = await resolveAuthorNames(t, [row]);
        await this.notifyMentions(t, tenantId, actorId, row, names.get(actorId) ?? "Someone");
        return toDto(row, names);
      },
    );
  }

  async remove(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
  ): Promise<CommentDto> {
    const { rows } = await tx.query<CommentRow>(
      `SELECT ${COMMENT_COLUMNS} FROM comments WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    // Author-only: another member's comment is not theirs to remove. Foreign
    // authorship is a 403 here (the comment is visibly not yours), consistent
    // with editing your own content only.
    if (row.author_id !== actorId) {
      throw new ApiError("FORBIDDEN", "You can only delete your own comments");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: row.entity_kind,
        entityId: row.entity_id,
        action: "deleted",
        before: { commentId: id },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<CommentRow>(
          `UPDATE comments SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${COMMENT_COLUMNS}`,
          [id, actorId],
        );
        const final = updated[0] ?? row;
        return toDto(final, await resolveAuthorNames(t, [final]));
      },
    );
  }
}
