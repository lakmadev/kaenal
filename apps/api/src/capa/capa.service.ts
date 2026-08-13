import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { canRevertCapa, capaMachine, counterYear, formatCode } from "@kaenal/core";
import type {
  AdvanceCapaBody,
  AssignCapaBody,
  CapaActionDto,
  CapaDto,
  CapaPhase,
  CapaType,
  CreateCapaActionBody,
  CreateCapaBody,
  NcrPriority,
  Page,
  RevertCapaBody,
  RiskLevel,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface CapaRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  risk: string | null;
  status: string;
  owner_id: string | null;
  sponsor_id: string | null;
  source_kind: string | null;
  source_id: string | null;
  due_at: Date | null;
  effectiveness_check_at: Date | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const CAPA_COLUMNS = `id, code, title, description, type, priority, risk, status, owner_id,
  sponsor_id, source_kind, source_id, due_at, effectiveness_check_at, lock_version,
  created_at, updated_at`;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function toCapaDto(row: CapaRow): CapaDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    type: row.type as CapaType,
    priority: row.priority as NcrPriority,
    risk: row.risk as RiskLevel | null,
    status: row.status as CapaPhase,
    ownerId: row.owner_id,
    sponsorId: row.sponsor_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    dueAt: iso(row.due_at),
    effectivenessCheckAt: iso(row.effectiveness_check_at),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface ActionRow {
  id: string;
  capa_id: string;
  description: string;
  owner_id: string | null;
  due_at: Date | null;
  status: string;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const ACTION_COLUMNS =
  "id, capa_id, description, owner_id, due_at, status, lock_version, created_at, updated_at";

function toActionDto(row: ActionRow): CapaActionDto {
  return {
    id: row.id,
    capaId: row.capa_id,
    description: row.description,
    ownerId: row.owner_id,
    dueAt: iso(row.due_at),
    status: row.status as CapaActionDto["status"],
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * CAPAs (02 §4, 03 §3) — corrective/preventive actions run as a phased
 * programme. The one rule the spec singles out is directionality: phases advance
 * only forward, and going back is a distinct, audited `revert` that always
 * carries a reason — never reachable by the same control that advances. That
 * split is enforced here (advance → `capaMachine`; revert → `canRevertCapa`,
 * both in packages/core). CAPAs are not plant-scoped (no plant_id column), so
 * every member with `capa:view` can read them; only `capa:manage` mutates.
 */
@Injectable()
export class CapaService {
  async list(
    tx: Tx,
    opts: { status?: string; type?: string; priority?: string; cursor?: string; limit: number },
  ): Promise<Page<CapaDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.type !== undefined) {
      params.push(opts.type);
      where += ` AND type = $${params.length}`;
    }
    if (opts.priority !== undefined) {
      params.push(opts.priority);
      where += ` AND priority = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<CapaRow>(
      `SELECT ${CAPA_COLUMNS} FROM capas ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toCapaDto);
  }

  async get(tx: Tx, id: string): Promise<CapaDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toCapaDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateCapaBody,
    context: AuditContext,
  ): Promise<CapaDto> {
    if (body.ownerId != null) await this.assertMember(tx, body.ownerId);
    if (body.sponsorId != null) await this.assertMember(tx, body.sponsorId);

    const now = new Date();
    // No plant/timezone on a CAPA — the code year is in UTC (02 §7 fallback).
    const year = counterYear(now, "UTC");
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "capa",
        entityId: id,
        action: "created",
        after: { title: body.title, type: body.type, priority: body.priority },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'capa', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a CAPA code");

        const { rows } = await t.query<CapaRow>(
          `INSERT INTO capas
             (id, tenant_id, code, title, description, type, priority, risk, status,
              owner_id, sponsor_id, source_kind, source_id, due_at, effectiveness_check_at,
              created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'initiation',$9,$10,$11,$12,$13,$14,$15,$15)
           RETURNING ${CAPA_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("capa", year, seq),
            body.title,
            body.description ?? null,
            body.type,
            body.priority,
            body.risk ?? null,
            body.ownerId ?? null,
            body.sponsorId ?? null,
            body.sourceKind ?? null,
            body.sourceId ?? null,
            body.dueAt ?? null,
            body.effectivenessCheckAt ?? null,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "CAPA was not created");
        return toCapaDto(row);
      },
    );
  }

  /** Advance one phase forward — forward-only, enforced by `capaMachine`. */
  async advance(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: AdvanceCapaBody,
    context: AuditContext,
  ): Promise<CapaDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row.lock_version, body.version);

    const decision = capaMachine.canTransition(row.status as CapaPhase, body.to, {});
    if (!decision.ok) throw ApiError.from(decision);

    return this.applyPhaseChange(tx, tenantId, actorId, id, row.status, body.to, body.version, body.reason ?? null, context);
  }

  /**
   * Revert to an earlier phase — the audited exception to forward-only motion.
   * A reason is mandatory (validated in `canRevertCapa` AND the body schema).
   */
  async revert(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: RevertCapaBody,
    context: AuditContext,
  ): Promise<CapaDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row.lock_version, body.version);

    const decision = canRevertCapa(row.status as CapaPhase, body.to, { reason: body.reason });
    if (!decision.ok) throw ApiError.from(decision);

    return this.applyPhaseChange(tx, tenantId, actorId, id, row.status, body.to, body.version, body.reason, context);
  }

  /**
   * Assign, reassign, or clear the owner and/or sponsor (P25). Orthogonal to the
   * phase machine, so it never touches `status`. Each field is tri-state: a uuid
   * assigns, `null` unassigns, an absent key leaves the column untouched. Every
   * non-null id must be an active member; the write is optimistic-concurrency
   * guarded and audited (`assigned`, with before/after ids) in one transaction.
   */
  async assign(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: AssignCapaBody,
    context: AuditContext,
  ): Promise<CapaDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row.lock_version, body.version);

    if (body.ownerId != null) await this.assertMember(tx, body.ownerId);
    if (body.sponsorId != null) await this.assertMember(tx, body.sponsorId);

    // Only the columns the caller actually provided are updated.
    const sets: string[] = [];
    const params: unknown[] = [id, body.version];
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    if (body.ownerId !== undefined) {
      params.push(body.ownerId);
      sets.push(`owner_id = $${params.length}`);
      before["ownerId"] = row.owner_id;
      after["ownerId"] = body.ownerId;
    }
    if (body.sponsorId !== undefined) {
      params.push(body.sponsorId);
      sets.push(`sponsor_id = $${params.length}`);
      before["sponsorId"] = row.sponsor_id;
      after["sponsorId"] = body.sponsorId;
    }
    params.push(actorId);
    const actorParam = params.length;

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "capa",
        entityId: id,
        action: "assigned",
        before,
        after,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<CapaRow>(
          `UPDATE capas SET ${sets.join(", ")}, updated_by = $${actorParam}
            WHERE id = $1 AND lock_version = $2
            RETURNING ${CAPA_COLUMNS}`,
          params,
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("STALE_WRITE", "The CAPA changed since you loaded it");
        return toCapaDto(updated);
      },
    );
  }

  // --- CAPA actions ---------------------------------------------------------

  async listActions(
    tx: Tx,
    capaId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<CapaActionDto>> {
    await this.get(tx, capaId); // 404 if the CAPA does not exist
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [capaId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<ActionRow>(
      `SELECT ${ACTION_COLUMNS} FROM capa_actions
        WHERE capa_id = $1 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toActionDto);
  }

  async createAction(
    tx: Tx,
    tenantId: string,
    actorId: string,
    capaId: string,
    body: CreateCapaActionBody,
    context: AuditContext,
  ): Promise<CapaActionDto> {
    await this.get(tx, capaId); // 404 if the CAPA does not exist
    if (body.ownerId != null) await this.assertMember(tx, body.ownerId);

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "capa_action",
        entityId: id,
        action: "created",
        after: { capaId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ActionRow>(
          `INSERT INTO capa_actions (id, tenant_id, capa_id, description, owner_id, due_at, status, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$7)
           RETURNING ${ACTION_COLUMNS}`,
          [id, tenantId, capaId, body.description, body.ownerId ?? null, body.dueAt ?? null, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Action was not created");
        return toActionDto(row);
      },
    );
  }

  async updateActionStatus(
    tx: Tx,
    tenantId: string,
    actorId: string,
    actionId: string,
    status: string,
    version: number,
    context: AuditContext,
  ): Promise<CapaActionDto> {
    const { rows } = await tx.query<ActionRow>(
      `SELECT ${ACTION_COLUMNS} FROM capa_actions WHERE id = $1 AND deleted_at IS NULL`,
      [actionId],
    );
    const current = rows[0];
    if (current === undefined) throw notFound();
    this.assertVersion(current.lock_version, version);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "capa_action",
        entityId: actionId,
        action: "status_changed",
        before: { status: current.status },
        after: { status },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<ActionRow>(
          `UPDATE capa_actions SET status = $3, updated_by = $4
            WHERE id = $1 AND lock_version = $2
            RETURNING ${ACTION_COLUMNS}`,
          [actionId, version, status, actorId],
        );
        const row = updated[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "The action changed since you loaded it");
        return toActionDto(row);
      },
    );
  }

  // --- internals ------------------------------------------------------------

  private async applyPhaseChange(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    from: string,
    to: CapaPhase,
    version: number,
    reason: string | null,
    context: AuditContext,
  ): Promise<CapaDto> {
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "capa",
        entityId: id,
        action: "status_changed",
        before: { status: from },
        after: { status: to },
        reason,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<CapaRow>(
          `UPDATE capas SET status = $3, updated_by = $4 WHERE id = $1 AND lock_version = $2
            RETURNING ${CAPA_COLUMNS}`,
          [id, version, to, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "The CAPA changed since you loaded it");
        return toCapaDto(row);
      },
    );
  }

  private async fetch(tx: Tx, id: string): Promise<CapaRow | null> {
    const { rows } = await tx.query<CapaRow>(
      `SELECT ${CAPA_COLUMNS} FROM capas WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async assertMember(tx: Tx, userId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId],
    );
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ApiError("STALE_WRITE", "The record changed since you loaded it", { expected, actual });
    }
  }
}
