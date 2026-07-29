import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  canTransitionChargeback,
  counterYear,
  formatCode,
  isFinalD,
  nextD,
  scarDaysOpen,
  scarIsOverdue,
  type ChargebackStatus,
  type ScarSeverity,
  type ScarStatus,
} from "@kaenal/core";
import type {
  AcknowledgeScarBody,
  AdvanceScarBody,
  CreateScarBody,
  Page,
  ScarChargebackBody,
  ScarDto,
  UpdateScarBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface ScarRow {
  id: string;
  code: string;
  supplier_id: string;
  supplier_name: string | null;
  title: string | null;
  severity: string;
  status: string;
  current_d: number;
  raised_date: string | null;
  due_date: string | null;
  supplier_response_due: string | null;
  supplier_acknowledged: boolean;
  ack_date: string | null;
  affected_lots: number | null;
  ncr_id: string | null;
  owner: string | null;
  chargeback_amount: number | null;
  chargeback_currency: string;
  chargeback_status: string | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

// Date columns cast to text so pg returns a plain 'YYYY-MM-DD'; the numeric
// chargeback amount casts to float8 so it arrives as a JS number, not a string.
// `supplier_name` is a correlated subquery (not a JOIN) so `scars s` stays the
// ONLY table in FROM — the shared keyset predicate emits an unqualified
// `(created_at, id)`, which a join would make ambiguous. It is RLS-scoped the
// same way the table is.
const SCAR_COLUMNS = `s.id, s.code, s.supplier_id,
  (SELECT sup.name FROM suppliers sup WHERE sup.id = s.supplier_id AND sup.tenant_id = s.tenant_id) AS supplier_name,
  s.title, s.severity, s.status, s.current_d,
  s.raised_date::text AS raised_date, s.due_date::text AS due_date,
  s.supplier_response_due::text AS supplier_response_due,
  s.supplier_acknowledged, s.ack_date::text AS ack_date, s.affected_lots,
  s.ncr_id, s.owner,
  s.chargeback_amount::float8 AS chargeback_amount, s.chargeback_currency, s.chargeback_status,
  s.lock_version, s.created_at, s.updated_at`;

const FROM = `scars s`;

function toScarDto(row: ScarRow, now: Date = new Date()): ScarDto {
  const status = row.status as ScarStatus;
  return {
    id: row.id,
    code: row.code,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    title: row.title,
    severity: row.severity as ScarSeverity,
    status,
    currentD: row.current_d,
    raisedDate: row.raised_date,
    dueDate: row.due_date,
    supplierResponseDue: row.supplier_response_due,
    supplierAcknowledged: row.supplier_acknowledged,
    ackDate: row.ack_date,
    affectedLots: row.affected_lots,
    ncrId: row.ncr_id,
    owner: row.owner,
    chargeback: {
      amount: row.chargeback_amount,
      currency: row.chargeback_currency,
      status: row.chargeback_status as ChargebackStatus | null,
    },
    daysOpen: scarDaysOpen(row.raised_date, now),
    overdue: scarIsOverdue(
      { status, dueDate: row.due_date, supplierResponseDue: row.supplier_response_due },
      now,
    ),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * SCAR & chargebacks (FEATURES §11.3, P10). Tenant-wide like suppliers — RLS is
 * the only isolation, a foreign-tenant id is 404 (rule 8). `scar:view` reads;
 * `scar:manage` (admin/manager/auditor) raises, edits, advances the 8D, records
 * acknowledgement, and transitions the chargeback. The 8D step machine and the
 * chargeback ratchet are the pure `packages/core` rules, not queries.
 */
@Injectable()
export class ScarService {
  async list(
    tx: Tx,
    opts: {
      supplierId?: string;
      status?: string;
      severity?: string;
      overdue?: boolean;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<ScarDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE s.deleted_at IS NULL";

    if (opts.supplierId !== undefined) {
      params.push(opts.supplierId);
      where += ` AND s.supplier_id = $${params.length}`;
    }
    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND s.status = $${params.length}`;
    }
    if (opts.severity !== undefined) {
      params.push(opts.severity);
      where += ` AND s.severity = $${params.length}`;
    }
    if (opts.overdue === true) {
      // Overdue is derived (packages/core), but the same predicate is expressible
      // in SQL for the filter: an active SCAR whose earliest due date is past.
      where += ` AND s.status IN ('draft','open','responded')
        AND COALESCE(s.supplier_response_due, s.due_date) < CURRENT_DATE`;
    }
    if (opts.q !== undefined) {
      params.push(`%${opts.q}%`);
      where += ` AND (s.title ILIKE $${params.length} OR s.code ILIKE $${params.length})`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<ScarRow>(
      `SELECT ${SCAR_COLUMNS} FROM ${FROM} ${where} ${keyset.sql}
        ORDER BY s.created_at DESC, s.id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, (r) => toScarDto(r));
  }

  async get(tx: Tx, id: string): Promise<ScarDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toScarDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateScarBody,
    context: AuditContext,
  ): Promise<ScarDto> {
    // Cross-tenant / missing supplier is invisible under RLS → 404 (rule 8).
    const { rows: supplier } = await tx.query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = $1 AND deleted_at IS NULL`,
      [body.supplierId],
    );
    if (supplier[0] === undefined) throw notFound();

    // Same for a linked NCR — a foreign-tenant NCR must not be linkable.
    if (body.ncrId != null) {
      const { rows: ncr } = await tx.query<{ id: string }>(
        `SELECT id FROM ncrs WHERE id = $1 AND deleted_at IS NULL`,
        [body.ncrId],
      );
      if (ncr[0] === undefined) throw notFound();
    }

    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "scar",
        entityId: id,
        action: "created",
        after: { title: body.title, supplierId: body.supplierId, severity: body.severity },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        let code = body.code;
        if (code === undefined) {
          const { rows: counter } = await t.query<{ value: number }>(
            `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'scar', $2, 1)
             ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
             RETURNING value`,
            [tenantId, year],
          );
          const seq = counter[0]?.value;
          if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a SCAR code");
          code = formatCode("scar", year, seq);
        }

        // A chargeback amount at creation raises it into `pending`.
        const chargebackStatus = body.chargebackAmount != null ? "pending" : null;

        try {
          const { rows } = await t.query<ScarRow>(
            `WITH ins AS (
               INSERT INTO scars
                 (id, tenant_id, code, supplier_id, ncr_id, title, severity, status, current_d,
                  raised_date, due_date, supplier_response_due, affected_lots, owner,
                  chargeback_amount, chargeback_currency, chargeback_status, created_by, updated_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'draft'),1,
                       $9,$10,$11,$12,$13,
                       $14,COALESCE($15,'USD'),$16,$17,$17)
               RETURNING *
             )
             SELECT ${SCAR_COLUMNS} FROM ins s`,
            [
              id,
              tenantId,
              code,
              body.supplierId,
              body.ncrId ?? null,
              body.title,
              body.severity,
              body.status ?? null,
              body.raisedDate ?? null,
              body.dueDate ?? null,
              body.supplierResponseDue ?? null,
              body.affectedLots ?? null,
              body.owner ?? null,
              body.chargebackAmount ?? null,
              body.chargebackCurrency ?? null,
              chargebackStatus,
              actorId,
            ],
          );
          const row = rows[0];
          if (row === undefined) throw new ApiError("INTERNAL", "SCAR was not created");
          return toScarDto(row);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ApiError("CONFLICT", `A SCAR with code '${code}' already exists`);
          }
          throw err;
        }
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateScarBody,
    context: AuditContext,
  ): Promise<ScarDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    if (body.ncrId != null) {
      const { rows: ncr } = await tx.query<{ id: string }>(
        `SELECT id FROM ncrs WHERE id = $1 AND deleted_at IS NULL`,
        [body.ncrId],
      );
      if (ncr[0] === undefined) throw notFound();
    }

    const sets: string[] = [];
    const params: unknown[] = [id, body.version];
    const set = (col: string, value: unknown): void => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (body.title !== undefined) set("title", body.title);
    if (body.severity !== undefined) set("severity", body.severity);
    if (body.status !== undefined) set("status", body.status);
    if (body.ncrId !== undefined) set("ncr_id", body.ncrId);
    if (body.raisedDate !== undefined) set("raised_date", body.raisedDate);
    if (body.dueDate !== undefined) set("due_date", body.dueDate);
    if (body.supplierResponseDue !== undefined) set("supplier_response_due", body.supplierResponseDue);
    if (body.affectedLots !== undefined) set("affected_lots", body.affectedLots);
    if (body.owner !== undefined) set("owner", body.owner);

    params.push(actorId);
    sets.push(`updated_by = $${params.length}`);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "scar",
        entityId: id,
        action: "updated",
        before: { status: row.status },
        after: { status: body.status ?? row.status },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, sets, params),
    );
  }

  /** Advance the 8D one discipline forward. Blocked once at D8 (nothing beyond). */
  async advance(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: AdvanceScarBody,
    context: AuditContext,
  ): Promise<ScarDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    if (isFinalD(row.current_d)) {
      throw new ApiError("VALIDATION_FAILED", "The SCAR is at D8 and cannot advance further", {
        currentD: row.current_d,
      });
    }
    const target = nextD(row.current_d);
    // Advancing off draft opens the SCAR; an already-open/responded SCAR keeps its status.
    const status = row.status === "draft" ? "open" : row.status;

    const sets = ["current_d = $3", "status = $4", "updated_by = $5"];
    const params: unknown[] = [id, body.version, target, status, actorId];

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "scar",
        entityId: id,
        action: "status_changed",
        before: { currentD: row.current_d, status: row.status },
        after: { currentD: target, status },
        ...(body.reason != null ? { reason: body.reason } : {}),
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, sets, params),
    );
  }

  /** Record the supplier's acknowledgement (sets the flag + ack date). */
  async acknowledge(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: AcknowledgeScarBody,
    context: AuditContext,
  ): Promise<ScarDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    const sets = [
      "supplier_acknowledged = true",
      "ack_date = COALESCE($3, CURRENT_DATE)",
      "updated_by = $4",
    ];
    const params: unknown[] = [id, body.version, body.ackDate ?? null, actorId];

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "scar",
        entityId: id,
        action: "status_changed",
        before: { supplierAcknowledged: row.supplier_acknowledged },
        after: { supplierAcknowledged: true },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, sets, params),
    );
  }

  /**
   * Set / transition the chargeback. Cost recovery is a one-way ratchet
   * (none→pending→debit_issued→closed) enforced by the `packages/core` rule.
   * Audited distinctly (before/after chargeback status) — compliance-sensitive.
   */
  async chargeback(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: ScarChargebackBody,
    context: AuditContext,
  ): Promise<ScarDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    const from = row.chargeback_status as ChargebackStatus | null;
    if (!canTransitionChargeback(from, body.status)) {
      throw new ApiError(
        "VALIDATION_FAILED",
        `Chargeback cannot move from '${from ?? "none"}' to '${body.status}'`,
        { from, to: body.status },
      );
    }

    const sets = ["chargeback_status = $3", "updated_by = $4"];
    const params: unknown[] = [id, body.version, body.status, actorId];
    if (body.amount !== undefined) {
      params.push(body.amount);
      sets.push(`chargeback_amount = $${params.length}`);
    }
    if (body.currency !== undefined) {
      params.push(body.currency);
      sets.push(`chargeback_currency = $${params.length}`);
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "scar",
        entityId: id,
        action: "status_changed",
        before: { chargebackStatus: from },
        after: { chargebackStatus: body.status },
        ...(body.reason != null ? { reason: body.reason } : {}),
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, sets, params),
    );
  }

  private assertVersion(row: ScarRow, version: number): void {
    if (row.lock_version !== version) {
      throw new ApiError("STALE_WRITE", "The SCAR changed since you loaded it", {
        expected: version,
        actual: row.lock_version,
      });
    }
  }

  private async writeAndReturn(t: Tx, sets: string[], params: unknown[]): Promise<ScarDto> {
    const { rows } = await t.query<ScarRow>(
      `WITH upd AS (
         UPDATE scars SET ${sets.join(", ")} WHERE id = $1 AND lock_version = $2
         RETURNING *
       )
       SELECT ${SCAR_COLUMNS} FROM upd s`,
      params,
    );
    const updated = rows[0];
    if (updated === undefined) throw new ApiError("STALE_WRITE", "The SCAR changed since you loaded it");
    return toScarDto(updated);
  }

  private async fetch(tx: Tx, id: string): Promise<ScarRow | null> {
    const { rows } = await tx.query<ScarRow>(
      `SELECT ${SCAR_COLUMNS} FROM ${FROM} WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}
