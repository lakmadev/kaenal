import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  computeDueAt,
  counterYear,
  formatCode,
  isPlantScoped,
  ncrMachine,
  type BusinessHours,
  type Membership,
  type NcrAction,
  type SlaConfigByPriority,
} from "@kaenal/core";
import type {
  CreateNcrActionBody,
  CreateNcrBody,
  NcrActionDto,
  NcrDto,
  NcrPriority,
  NcrStatus,
  Page,
  TransitionNcrBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import type { AuditContext } from "./audit-context.js";

interface NcrRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  source: string;
  source_id: string | null;
  priority: string;
  status: string;
  owner_id: string | null;
  plant_id: string | null;
  area_id: string | null;
  due_at: Date | null;
  sla_state: string;
  eight_d_id: string | null;
  resolved_by: string | null;
  resolved_at: Date | null;
  verified_by: string | null;
  verified_at: Date | null;
  closed_at: Date | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const NCR_COLUMNS = `id, code, title, description, source, source_id, priority, status, owner_id,
  plant_id, area_id, due_at, sla_state, eight_d_id, resolved_by, resolved_at, verified_by,
  verified_at, closed_at, lock_version, created_at, updated_at`;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function toNcrDto(row: NcrRow): NcrDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    source: row.source as NcrDto["source"],
    sourceId: row.source_id,
    priority: row.priority as NcrPriority,
    status: row.status as NcrStatus,
    ownerId: row.owner_id,
    plantId: row.plant_id,
    areaId: row.area_id,
    dueAt: iso(row.due_at),
    slaState: row.sla_state as NcrDto["slaState"],
    eightDId: row.eight_d_id,
    resolvedBy: row.resolved_by,
    resolvedAt: iso(row.resolved_at),
    verifiedBy: row.verified_by,
    verifiedAt: iso(row.verified_at),
    closedAt: iso(row.closed_at),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface ActionRow {
  id: string;
  ncr_id: string;
  kind: string;
  description: string;
  owner_id: string | null;
  due_at: Date | null;
  status: string;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const ACTION_COLUMNS =
  "id, ncr_id, kind, description, owner_id, due_at, status, lock_version, created_at, updated_at";

function toActionDto(row: ActionRow): NcrActionDto {
  return {
    id: row.id,
    ncrId: row.ncr_id,
    kind: row.kind as NcrActionDto["kind"],
    description: row.description,
    ownerId: row.owner_id,
    dueAt: iso(row.due_at),
    status: row.status as NcrActionDto["status"],
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * NCRs (02 §4, 03 §10) — the corrective-action workflow the whole system exists
 * to run. This service owns the transitions; the legality of each is decided by
 * `ncrMachine` in packages/core (corrective-action gate, four-eyes, 8D block),
 * not by conditionals scattered here. SLA due dates are computed on creation in
 * the plant's timezone and business hours.
 */
@Injectable()
export class NcrService {
  async list(
    tx: Tx,
    membership: Membership,
    opts: { status?: string; priority?: string; plantId?: string; cursor?: string; limit: number },
  ): Promise<Page<NcrDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.priority !== undefined) {
      params.push(opts.priority);
      where += ` AND priority = $${params.length}`;
    }
    if (opts.plantId !== undefined) {
      params.push(opts.plantId);
      where += ` AND plant_id = $${params.length}`;
    }
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      where += ` AND plant_id = ANY($${params.length}::uuid[])`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<NcrRow>(
      `SELECT ${NCR_COLUMNS} FROM ncrs ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toNcrDto);
  }

  async get(tx: Tx, membership: Membership, id: string): Promise<NcrDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    return toNcrDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    body: CreateNcrBody,
    context: AuditContext,
  ): Promise<NcrDto> {
    // Raising from a finding is the Findings → NCR seam: link the finding and
    // default source/plant off the inspection it came from.
    let source = body.source ?? "manual";
    let sourceId = body.sourceId ?? null;
    let plantId = body.plantId ?? null;
    let finding: { id: string; inspection_plant: string | null } | null = null;

    if (body.findingId !== undefined) {
      finding = await this.loadUnlinkedFinding(tx, membership, body.findingId);
      source = body.source ?? "inspection";
      sourceId = body.sourceId ?? finding.id;
      plantId = body.plantId ?? finding.inspection_plant;
    }

    // A plant-scoped author can only raise NCRs inside their plants.
    this.assertInScope(membership, plantId);

    const now = new Date();
    const tz = await this.plantTimezone(tx, plantId);
    const slaConfig = await this.loadSlaConfig(tx);
    const dueAt =
      slaConfig[body.priority] !== undefined ? computeDueAt(now, body.priority, slaConfig, tz) : null;

    const year = counterYear(now, tz);
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ncr",
        entityId: id,
        action: "created",
        after: { title: body.title, priority: body.priority, source },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'ncr', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an NCR code");

        const { rows } = await t.query<NcrRow>(
          `INSERT INTO ncrs
             (id, tenant_id, code, title, description, source, source_id, priority, status,
              plant_id, area_id, due_at, sla_state, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10,$11,'on_track',$12,$12)
           RETURNING ${NCR_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("ncr", year, seq),
            body.title,
            body.description ?? null,
            source,
            sourceId,
            body.priority,
            plantId,
            body.areaId ?? null,
            dueAt,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "NCR was not created");

        if (finding !== null) {
          // Link the finding. The WHERE re-checks it is still unlinked, so two
          // concurrent raises cannot both claim the same finding.
          const linked = await t.query(
            "UPDATE findings SET ncr_id = $1 WHERE id = $2 AND ncr_id IS NULL",
            [id, finding.id],
          );
          if (linked.rowCount === 0) {
            throw new ApiError("CONFLICT", "That finding was just linked to another NCR");
          }
        }

        return toNcrDto(row);
      },
    );
  }

  /** Manager-side transitions (everything except verify). */
  async transition(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: TransitionNcrBody,
    context: AuditContext,
  ): Promise<NcrDto> {
    if (body.to === "assigned" && body.ownerId === undefined) {
      throw new ApiError("VALIDATION_FAILED", "Assigning an NCR requires an ownerId");
    }
    if (body.ownerId !== undefined) await this.assertMember(tx, body.ownerId);

    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row.lock_version, body.version);

    const decision = ncrMachine.canTransition(row.status as NcrStatus, body.to, {
      actions: await this.actionsFor(tx, id),
      actorId,
      actorRole: membership.role,
      resolvedBy: row.resolved_by,
      // An 8D blocks close only while it is still active; a completed/cancelled
      // one has been resolved and no longer holds the NCR open (03 §10).
      openEightDId: await this.openEightDId(tx, row.eight_d_id),
      ...(body.force !== undefined ? { force: body.force } : {}),
    });
    if (!decision.ok) throw ApiError.from(decision);

    const { setClause, params } = this.updatesFor(body.to, actorId, body.ownerId);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ncr",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status: body.to },
        reason: body.reason ?? null,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      (t) => this.applyNcrUpdate(t, id, body.version, setClause, params),
    );
  }

  /** resolved → verified, four-eyes enforced by the machine and the DB CHECK. */
  async verify(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    version: number,
    reason: string | null,
    context: AuditContext,
  ): Promise<NcrDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row.lock_version, version);

    const decision = ncrMachine.canTransition(row.status as NcrStatus, "verified", {
      actions: await this.actionsFor(tx, id),
      actorId,
      actorRole: membership.role,
      resolvedBy: row.resolved_by,
      openEightDId: row.eight_d_id,
    });
    if (!decision.ok) throw ApiError.from(decision);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ncr",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status: "verified" },
        reason,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      (t) =>
        this.applyNcrUpdate(
          t,
          id,
          version,
          "status = 'verified', verified_by = $3, verified_at = now()",
          [actorId],
        ),
    );
  }

  // --- corrective actions ---------------------------------------------------

  async listActions(
    tx: Tx,
    membership: Membership,
    ncrId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<NcrActionDto>> {
    await this.get(tx, membership, ncrId); // 404 / scope
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [ncrId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<ActionRow>(
      `SELECT ${ACTION_COLUMNS} FROM ncr_actions
        WHERE ncr_id = $1 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toActionDto);
  }

  async createAction(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    ncrId: string,
    body: CreateNcrActionBody,
    context: AuditContext,
  ): Promise<NcrActionDto> {
    await this.get(tx, membership, ncrId); // 404 / scope
    if (body.ownerId != null) await this.assertMember(tx, body.ownerId);

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ncr_action",
        entityId: id,
        action: "created",
        after: { ncrId, kind: body.kind },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ActionRow>(
          `INSERT INTO ncr_actions (id, tenant_id, ncr_id, kind, description, owner_id, due_at, status, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$8)
           RETURNING ${ACTION_COLUMNS}`,
          [id, tenantId, ncrId, body.kind, body.description, body.ownerId ?? null, body.dueAt ?? null, actorId],
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
    membership: Membership,
    actorId: string,
    actionId: string,
    status: string,
    version: number,
    context: AuditContext,
  ): Promise<NcrActionDto> {
    const { rows } = await tx.query<ActionRow & { plant_id: string | null }>(
      `SELECT a.${ACTION_COLUMNS.split(", ").join(", a.")}, n.plant_id
         FROM ncr_actions a JOIN ncrs n ON n.id = a.ncr_id
        WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [actionId],
    );
    const current = rows[0];
    if (current === undefined) throw notFound();
    this.assertInScope(membership, current.plant_id);
    this.assertVersion(current.lock_version, version);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ncr_action",
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
          `UPDATE ncr_actions SET status = $3, updated_by = $4
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

  private async fetch(tx: Tx, id: string): Promise<NcrRow | null> {
    const { rows } = await tx.query<NcrRow>(
      `SELECT ${NCR_COLUMNS} FROM ncrs WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** The linked 8D id, but only if that 8D is still active (else null). */
  private async openEightDId(tx: Tx, eightDId: string | null): Promise<string | null> {
    if (eightDId === null) return null;
    const { rows } = await tx.query<{ status: string }>(
      "SELECT status FROM eight_ds WHERE id = $1 AND deleted_at IS NULL",
      [eightDId],
    );
    return rows[0]?.status === "active" ? eightDId : null;
  }

  private async actionsFor(tx: Tx, ncrId: string): Promise<NcrAction[]> {
    const { rows } = await tx.query<{ kind: string; status: string }>(
      "SELECT kind, status FROM ncr_actions WHERE ncr_id = $1 AND deleted_at IS NULL",
      [ncrId],
    );
    return rows.map((r) => ({ kind: r.kind as NcrAction["kind"], status: r.status as NcrAction["status"] }));
  }

  private async loadUnlinkedFinding(
    tx: Tx,
    membership: Membership,
    findingId: string,
  ): Promise<{ id: string; inspection_plant: string | null }> {
    const { rows } = await tx.query<{ id: string; ncr_id: string | null; plant_id: string | null }>(
      `SELECT f.id, f.ncr_id, i.plant_id
         FROM findings f JOIN inspections i ON i.id = f.inspection_id
        WHERE f.id = $1 AND f.deleted_at IS NULL`,
      [findingId],
    );
    const finding = rows[0];
    if (finding === undefined) throw new ApiError("VALIDATION_FAILED", "Unknown finding");
    this.assertInScope(membership, finding.plant_id);
    if (finding.ncr_id !== null) {
      throw new ApiError("CONFLICT", "That finding is already linked to an NCR");
    }
    return { id: finding.id, inspection_plant: finding.plant_id };
  }

  private async plantTimezone(tx: Tx, plantId: string | null): Promise<string> {
    if (plantId === null) return "UTC";
    const { rows } = await tx.query<{ timezone: string }>(
      "SELECT timezone FROM plants WHERE id = $1",
      [plantId],
    );
    return rows[0]?.timezone ?? "UTC";
  }

  private async loadSlaConfig(tx: Tx): Promise<SlaConfigByPriority> {
    const { rows } = await tx.query<{
      priority: string;
      respond_hours: number;
      resolve_hours: number;
      business_hours: BusinessHours;
    }>(
      "SELECT priority, respond_hours, resolve_hours, business_hours FROM sla_configs WHERE entity_kind = 'ncr'",
    );
    const config: Partial<Record<NcrPriority, { respondHours: number; resolveHours: number; businessHours: BusinessHours }>> = {};
    for (const row of rows) {
      config[row.priority as NcrPriority] = {
        respondHours: row.respond_hours,
        resolveHours: row.resolve_hours,
        businessHours: row.business_hours,
      };
    }
    return config as SlaConfigByPriority;
  }

  private updatesFor(
    to: TransitionNcrBody["to"],
    actorId: string,
    ownerId: string | undefined,
  ): { setClause: string; params: unknown[] } {
    switch (to) {
      case "assigned":
        return { setClause: "status = 'assigned', owner_id = $3", params: [ownerId] };
      case "resolved":
        return { setClause: "status = 'resolved', resolved_by = $3, resolved_at = now()", params: [actorId] };
      case "closed":
        return { setClause: "status = 'closed', closed_at = now()", params: [] };
      default:
        // open / in_progress / escalated / reopened: status only.
        return { setClause: `status = '${to}'`, params: [] };
    }
  }

  private async applyNcrUpdate(
    tx: Tx,
    id: string,
    expectedVersion: number,
    setClause: string,
    extraParams: unknown[],
  ): Promise<NcrDto> {
    const { rows } = await tx.query<NcrRow>(
      `UPDATE ncrs SET ${setClause} WHERE id = $1 AND lock_version = $2 RETURNING ${NCR_COLUMNS}`,
      [id, expectedVersion, ...extraParams],
    );
    const row = rows[0];
    if (row === undefined) throw new ApiError("STALE_WRITE", "The NCR changed since you loaded it");
    return toNcrDto(row);
  }

  private async assertMember(tx: Tx, userId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId],
    );
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
  }

  private assertInScope(membership: Membership, plantId: string | null): void {
    if (!isPlantScoped(membership.role)) return;
    if (membership.plantIds.length === 0) return;
    if (plantId !== null && membership.plantIds.includes(plantId)) return;
    throw notFound();
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ApiError("STALE_WRITE", "The record changed since you loaded it", { expected, actual });
    }
  }
}
