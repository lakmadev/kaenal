import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import type {
  NotificationDto,
  NotificationPrefsDto,
  Page,
  UpdateNotificationPrefsBody,
} from "@kaenal/types";
import { notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import { NoopProducer, type JobProducer } from "../jobs/producer.js";
import type { RealtimeEmitter } from "../realtime/realtime.service.js";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_kind: string | null;
  entity_id: string | null;
  actor_id: string | null;
  starred: boolean;
  read_at: Date | null;
  created_at: Date;
}

const NOTIFICATION_COLUMNS =
  "id, kind, title, body, entity_kind, entity_id, actor_id, starred, read_at, created_at";

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    actorId: row.actor_id,
    starred: row.starred,
    readAt: row.read_at === null ? null : row.read_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/** What a producer (a service side effect, or a Phase-2 job) hands to `notify`. */
export interface NotifyInput {
  readonly userId: string;
  readonly kind: string;
  readonly title: string;
  readonly body?: string | null;
  readonly entityKind?: string | null;
  readonly entityId?: string | null;
  /** Who caused this (an assigner). NULL for system/job notifications. */
  readonly actorId?: string | null;
  /** Idempotency key — a retry with the same key does not double-notify (06). */
  readonly dedupeKey?: string | null;
}

/**
 * Notifications (02 §2, 06). Everything here is scoped to ONE user: a member
 * sees and mutates only their own notifications and channel preferences — the
 * `user_id = actor` filter is the access control, on top of tenant RLS. These
 * rows are a delivery artifact, not an audited business entity (they are the
 * downstream product of an already-audited event, and 07 §1's log list does not
 * include them), so this service deliberately does not go through `withAudit`.
 *
 * `notify` is the write primitive the producing side calls (an NCR assignment,
 * an SLA breach job, …) inside that event's own transaction; the actual
 * email/push/SMS fan-out is the Phase-2 `notify` job reading `notification_prefs`.
 */
@Injectable()
export class NotificationsService {
  /** The producer defaults to a no-op, so seeds/tests can `new NotificationsService()`.
   *  The realtime emitter is optional for the same reason — omitted, `notify`
   *  simply skips the live nudge (the in-app row is still written). */
  constructor(
    private readonly jobs: JobProducer = new NoopProducer(),
    private readonly realtime?: RealtimeEmitter,
  ) {}

  async list(
    tx: Tx,
    userId: string,
    opts: {
      unread?: boolean;
      starred?: boolean;
      entityKind?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<NotificationDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [userId];
    let where = "WHERE user_id = $1 AND deleted_at IS NULL";
    if (opts.unread === true) where += " AND read_at IS NULL";
    if (opts.starred === true) where += " AND starred";
    if (opts.entityKind !== undefined) {
      params.push(opts.entityKind);
      where += ` AND entity_kind = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<NotificationRow>(
      `SELECT ${NOTIFICATION_COLUMNS} FROM notifications ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }

  async unreadCount(tx: Tx, userId: string): Promise<number> {
    const { rows } = await tx.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL",
      [userId],
    );
    return Number(rows[0]?.n ?? "0");
  }

  async markRead(tx: Tx, userId: string, id: string): Promise<NotificationDto> {
    // Scope to the owner: another user's id (or a foreign-tenant one) is a 404,
    // never a 403 — no cross-existence leak (rule 8).
    const { rows } = await tx.query<NotificationRow>(
      `SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    if (row.read_at !== null) return toDto(row); // already read — idempotent

    const { rows: updated } = await tx.query<NotificationRow>(
      `UPDATE notifications SET read_at = now(), updated_by = $2
        WHERE id = $1 AND user_id = $2 RETURNING ${NOTIFICATION_COLUMNS}`,
      [id, userId],
    );
    return toDto(updated[0] ?? row);
  }

  async markAllRead(tx: Tx, userId: string): Promise<number> {
    const { rowCount } = await tx.query(
      "UPDATE notifications SET read_at = now(), updated_by = $1 WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL",
      [userId],
    );
    return rowCount ?? 0;
  }

  /** Star / un-star. Scoped to the owner: a foreign id is a 404 (rule 8). */
  async setStarred(tx: Tx, userId: string, id: string, starred: boolean): Promise<NotificationDto> {
    const { rows } = await tx.query<NotificationRow>(
      `UPDATE notifications SET starred = $3, updated_by = $2
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING ${NOTIFICATION_COLUMNS}`,
      [id, userId, starred],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return toDto(row);
  }

  /** Dismiss (soft-delete). Idempotent: a second dismiss returns 0. */
  async dismiss(tx: Tx, userId: string, id: string): Promise<number> {
    const { rowCount } = await tx.query(
      `UPDATE notifications SET deleted_at = now(), updated_by = $2
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    );
    return rowCount ?? 0;
  }

  async getPrefs(tx: Tx, userId: string): Promise<NotificationPrefsDto> {
    const { rows } = await tx.query<{ matrix: NotificationPrefsDto["matrix"] }>(
      "SELECT matrix FROM notification_prefs WHERE user_id = $1",
      [userId],
    );
    return { matrix: rows[0]?.matrix ?? {} };
  }

  async setPrefs(
    tx: Tx,
    tenantId: string,
    userId: string,
    body: UpdateNotificationPrefsBody,
  ): Promise<NotificationPrefsDto> {
    const { rows } = await tx.query<{ matrix: NotificationPrefsDto["matrix"] }>(
      `INSERT INTO notification_prefs (tenant_id, user_id, matrix, created_by, updated_by)
       VALUES ($1, $2, $3, $2, $2)
       ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET matrix = EXCLUDED.matrix, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING matrix`,
      [tenantId, userId, JSON.stringify(body.matrix)],
    );
    return { matrix: rows[0]?.matrix ?? {} };
  }

  /**
   * Create an in-app notification. Returns the row, or null when a `dedupeKey`
   * collides with one already delivered (the caller's retry was a no-op). Runs
   * in the caller's transaction so it commits with the event that produced it.
   */
  async notify(tx: Tx, tenantId: string, input: NotifyInput): Promise<NotificationDto | null> {
    const id = randomUUID();
    const { rows } = await tx.query<NotificationRow>(
      `INSERT INTO notifications
         (id, tenant_id, user_id, kind, title, body, entity_kind, entity_id, actor_id, dedupe_key, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$3,$3)
       ON CONFLICT (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING ${NOTIFICATION_COLUMNS}`,
      [
        id,
        tenantId,
        input.userId,
        input.kind,
        input.title,
        input.body ?? null,
        input.entityKind ?? null,
        input.entityId ?? null,
        input.actorId ?? null,
        input.dedupeKey ?? null,
      ],
    );
    const row = rows[0];
    if (row === undefined) return null; // deduped — a retry already delivered it

    // Hand off out-of-band delivery (email/push/sms) to the notify queue. The
    // in-app row above is the source of truth; the job only fans to channels.
    await this.jobs.deliverNotification({ tenantId, notificationId: row.id });

    // Realtime nudge (Phase R1): tell just this user's live streams to refetch
    // their notifications, so the bell updates instantly instead of on the next
    // poll. A pointer only — no row data crosses the bus. Best-effort by design:
    // it rides the caller's transaction, so a later rollback could emit a
    // spurious "refetch" that costs one cheap query; R2 moves business-mutation
    // emits to a post-commit outbox where exactness matters more.
    this.realtime?.emit({
      tenantId,
      userId: input.userId,
      event: {
        topic: "notifications",
        action: "created",
        entityId: row.id,
        at: row.created_at.toISOString(),
      },
    });
    return toDto(row);
  }
}
