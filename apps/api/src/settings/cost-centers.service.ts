import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type pg from "pg";
import { withAudit, type Tx } from "@kaenal/db";
import { allocateConserved, type AllocationWeight } from "@kaenal/core";
import type {
  AssignCostCenterBody,
  ChargebackReportDto,
  ChargebackRowDto,
  CostCenterAssignmentDto,
  CostCenterDto,
  CreateCostCenterBody,
  Page,
  UpdateCostCenterBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { loadChargebackSettings } from "./settings.service.js";

interface CcRow {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  seats: number | string;
  lock_version: number;
}

const UNALLOCATED = "unallocated";
const ENTITY_KIND = "cost_center";

function toDto(row: CcRow): CostCenterDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parent_id,
    seats: Number(row.seats),
    lockVersion: row.lock_version,
  };
}

/**
 * Cost-center hierarchy + chargeback (04 §Settings > Multi-tenancy; table 0029).
 * Cost centers are a tenant tree that memberships are assigned to; `seats` is a
 * REAL count of active memberships. The chargeback report multiplies seats by a
 * configurable rate and splits a shared platform fee across centres with a
 * conserved-total apportionment (`@kaenal/core`). AI + storage costs are 0 until
 * a metering pipeline exists (flagged). Managed under `settings:manage`, audited
 * (rule 3), optimistic (rule 6). Member names come from `control.users` on the
 * control pool (the RLS app role can't read it), keyed by the tenant's own roster.
 */
@Injectable()
export class CostCentersService {
  constructor(private readonly control: pg.Pool) {}

  /** List live cost centers with a live active-seat count each. */
  async list(tx: Tx): Promise<Page<CostCenterDto>> {
    const { rows } = await tx.query<CcRow>(
      `SELECT cc.id, cc.code, cc.name, cc.parent_id, cc.lock_version,
              count(m.id) FILTER (WHERE m.status = 'active' AND m.deleted_at IS NULL) AS seats
         FROM cost_centers cc
         LEFT JOIN memberships m
           ON m.tenant_id = cc.tenant_id AND m.cost_center_id = cc.id
        WHERE cc.deleted_at IS NULL
        GROUP BY cc.id, cc.code, cc.name, cc.parent_id, cc.lock_version
        ORDER BY cc.code ASC`,
    );
    return { items: rows.map(toDto), nextCursor: null };
  }

  private async load(tx: Tx, id: string): Promise<CcRow> {
    const { rows } = await tx.query<CcRow>(
      `SELECT id, code, name, parent_id, 0 AS seats, lock_version
         FROM cost_centers WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateCostCenterBody,
    context: AuditContext,
  ): Promise<CostCenterDto> {
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
        after: { code: body.code, name: body.name, parentId: body.parentId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<CcRow>(
          `INSERT INTO cost_centers (id, tenant_id, code, name, parent_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$6)
           RETURNING id, code, name, parent_id, 0 AS seats, lock_version`,
          [id, tenantId, body.code, body.name, body.parentId, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Cost center was not created");
        return toDto(row);
      },
    ).catch(rethrowDuplicateCode);
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateCostCenterBody,
    context: AuditContext,
  ): Promise<CostCenterDto> {
    const current = await this.load(tx, id);
    if (current.lock_version !== body.version) {
      throw new ApiError("STALE_WRITE", "This cost center changed since you loaded it", {
        expected: body.version,
        actual: current.lock_version,
      });
    }
    if (body.parentId === id) {
      throw new ApiError("VALIDATION_FAILED", "A cost center cannot be its own parent");
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
        before: { code: current.code, name: current.name, parentId: current.parent_id },
        after: { code: body.code, name: body.name, parentId: body.parentId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<CcRow>(
          `UPDATE cost_centers
              SET code=$3, name=$4, parent_id=$5, updated_by=$6
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL
            RETURNING id, code, name, parent_id, 0 AS seats, lock_version`,
          [id, body.version, body.code, body.name, body.parentId, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "This cost center changed since you loaded it");
        return toDto(row);
      },
    ).catch(rethrowDuplicateCode);
  }

  /** Soft-delete a cost center. Refuses if it still has children; unassigns its
   *  members (the FK's ON DELETE SET NULL doesn't fire on a soft delete). */
  async remove(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
  ): Promise<CostCenterDto> {
    const row = await this.load(tx, id);
    const { rows: kids } = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM cost_centers WHERE parent_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if ((kids[0]?.n ?? 0) > 0) {
      throw new ApiError("CONFLICT", "Remove or reparent this cost center's sub-centers first");
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
        before: { code: row.code, deleted: false },
        after: { code: row.code, deleted: true },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(`UPDATE memberships SET cost_center_id = NULL WHERE cost_center_id = $1`, [id]);
        const { rows } = await t.query<CcRow>(
          `UPDATE cost_centers SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, code, name, parent_id, 0 AS seats, lock_version`,
          [id, actorId],
        );
        return toDto(rows[0] ?? row);
      },
    );
  }

  // --- Member assignment ---------------------------------------------------
  async listAssignments(tx: Tx): Promise<Page<CostCenterAssignmentDto>> {
    const { rows } = await tx.query<{ user_id: string; role: string; cost_center_id: string | null }>(
      `SELECT user_id, role, cost_center_id
         FROM memberships
        WHERE status = 'active' AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
    );
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const people = new Map<string, { name: string; email: string }>();
    if (userIds.length > 0) {
      const { rows: users } = await this.control.query<{ id: string; name: string; email: string }>(
        `SELECT id, name, email FROM control.users WHERE id = ANY($1::uuid[])`,
        [userIds],
      );
      for (const u of users) people.set(u.id, { name: u.name, email: u.email });
    }
    const items = rows.map((r) => ({
      userId: r.user_id,
      name: people.get(r.user_id)?.name ?? "Unknown member",
      email: people.get(r.user_id)?.email ?? "",
      role: r.role,
      costCenterId: r.cost_center_id,
    }));
    return { items, nextCursor: null };
  }

  async assign(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: AssignCostCenterBody,
    context: AuditContext,
  ): Promise<CostCenterAssignmentDto> {
    // The composite FK guarantees the CC (if any) belongs to this tenant.
    const { rows } = await tx.query<{ user_id: string; role: string; cost_center_id: string | null }>(
      `SELECT user_id, role, cost_center_id FROM memberships
        WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [body.userId],
    );
    const member = rows[0];
    if (member === undefined) throw notFound();

    const updated = await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "membership",
        entityId: body.userId,
        action: "settings_changed",
        before: { costCenterId: member.cost_center_id },
        after: { costCenterId: body.costCenterId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const res = await t.query<{ cost_center_id: string | null }>(
          `UPDATE memberships SET cost_center_id = $2, updated_by = $3
            WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
            RETURNING cost_center_id`,
          [body.userId, body.costCenterId, actorId],
        );
        return res.rows[0]?.cost_center_id ?? null;
      },
    ).catch(rethrowBadCostCenter);

    const { rows: users } = await this.control.query<{ name: string; email: string }>(
      `SELECT name, email FROM control.users WHERE id = $1`,
      [body.userId],
    );
    return {
      userId: body.userId,
      name: users[0]?.name ?? "Unknown member",
      email: users[0]?.email ?? "",
      role: member.role,
      costCenterId: updated,
    };
  }

  // --- Chargeback report ---------------------------------------------------
  /**
   * The current-month chargeback, allocated across cost centers. Seats + seat
   * cost are real; a shared platform fee is split by seats with a conserved
   * apportionment; AI + storage are 0 until metered. Members with no cost center
   * fall into an "Unallocated" bucket so the grand total still reconciles.
   */
  async report(tx: Tx): Promise<ChargebackReportDto> {
    const settings = await loadChargebackSettings(tx);

    const { rows: centers } = await tx.query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name FROM cost_centers WHERE deleted_at IS NULL ORDER BY code ASC`,
    );
    const { rows: seatRows } = await tx.query<{ cost_center_id: string | null; seats: string }>(
      `SELECT cost_center_id, count(*)::text AS seats
         FROM memberships
        WHERE status = 'active' AND deleted_at IS NULL
        GROUP BY cost_center_id`,
    );

    const seatById = new Map<string, number>();
    let unallocatedSeats = 0;
    for (const r of seatRows) {
      const n = Number(r.seats);
      if (r.cost_center_id === null) unallocatedSeats += n;
      else seatById.set(r.cost_center_id, n);
    }
    // Seats pointing at a (defensively) unknown centre fold into Unallocated.
    const liveIds = new Set(centers.map((c) => c.id));
    for (const [ccId, n] of seatById) {
      if (!liveIds.has(ccId)) {
        unallocatedSeats += n;
        seatById.delete(ccId);
      }
    }

    interface Bucket {
      key: string;
      costCenterId: string | null;
      code: string;
      name: string;
      seats: number;
    }
    const buckets: Bucket[] = centers.map((c) => ({
      key: c.id,
      costCenterId: c.id,
      code: c.code,
      name: c.name,
      seats: seatById.get(c.id) ?? 0,
    }));
    if (unallocatedSeats > 0) {
      buckets.push({ key: UNALLOCATED, costCenterId: null, code: "—", name: "Unallocated", seats: unallocatedSeats });
    }

    const weights: AllocationWeight[] = buckets.map((b) => ({ key: b.key, weight: b.seats }));
    const platformShare = new Map(
      allocateConserved(settings.platformMonthlyFeeCents, weights).map((a) => [a.key, a.amountCents]),
    );

    const rows: ChargebackRowDto[] = buckets.map((b) => {
      const seatCostCents = b.seats * settings.seatRateCents;
      const platformShareCents = platformShare.get(b.key) ?? 0;
      return {
        costCenterId: b.costCenterId,
        code: b.code,
        name: b.name,
        seats: b.seats,
        seatCostCents,
        platformShareCents,
        aiCostCents: 0,
        storageCostCents: 0,
        totalCents: seatCostCents + platformShareCents,
      };
    });

    const totalCents = rows.reduce((s, r) => s + r.totalCents, 0);
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    return { period, currency: settings.currency, rows, totalCents, meteringPending: true };
  }
}

/** Map the unique-code violation to a clean 409 rather than a 500. */
function rethrowDuplicateCode(err: unknown): never {
  if (isPgError(err) && err.code === "23505") {
    throw new ApiError("CONFLICT", "A cost center with that code already exists");
  }
  throw err;
}

/** Map an FK violation on assign (CC not in this tenant) to a 404. */
function rethrowBadCostCenter(err: unknown): never {
  if (isPgError(err) && err.code === "23503") throw notFound();
  throw err;
}

function isPgError(err: unknown): err is { code: string } {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "string";
}
