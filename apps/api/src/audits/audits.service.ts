import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { auditMachine, counterYear, formatCode, isPlantScoped, type Membership } from "@kaenal/core";
import type {
  AdvanceAuditBody,
  AuditDto,
  AuditFindingDto,
  AuditPhase,
  AuditType,
  CapaDto,
  CreateAuditBody,
  CreateAuditFindingBody,
  NcrDto,
  Page,
  RaiseCapaFromFindingBody,
  RaiseNcrFromFindingBody,
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
import type { NcrService } from "../ncr/ncr.service.js";
import type { CapaService } from "../capa/capa.service.js";

interface AuditRow {
  id: string;
  code: string;
  title: string;
  standard: string | null;
  type: string;
  status: string;
  lead_auditor_id: string | null;
  team: string[];
  plant_id: string | null;
  start_at: Date | null;
  end_at: Date | null;
  progress: string;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const AUDIT_COLUMNS = `id, code, title, standard, type, status, lead_auditor_id, team, plant_id,
  start_at, end_at, progress, lock_version, created_at, updated_at`;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function toAuditDto(row: AuditRow): AuditDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    standard: row.standard,
    type: row.type as AuditType,
    status: row.status as AuditPhase,
    leadAuditorId: row.lead_auditor_id,
    team: row.team,
    plantId: row.plant_id,
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
    progress: Number(row.progress),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface FindingRow {
  id: string;
  audit_id: string;
  clause: string | null;
  kind: string;
  description: string;
  ncr_id: string | null;
  capa_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const FINDING_COLUMNS =
  "id, audit_id, clause, kind, description, ncr_id, capa_id, created_at, updated_at";

function toFindingDto(row: FindingRow): AuditFindingDto {
  return {
    id: row.id,
    auditId: row.audit_id,
    clause: row.clause,
    kind: row.kind as AuditFindingDto["kind"],
    description: row.description,
    ncrId: row.ncr_id,
    capaId: row.capa_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Audits (02 §2, 03 §3, 07 module). An audit runs through fixed phases
 * (planned → … → closed, `auditMachine`) and accumulates findings; each finding
 * can spawn an NCR or a CAPA — the same corrective seam as inspection findings,
 * linking `audit_findings.ncr_id`/`capa_id`. Audits are plant-scoped (an
 * inspector/viewer sees only their plants); management needs `audit:manage`
 * (admin/manager/auditor), reading `audit:view` (everyone). Raising delegates to
 * `NcrService`/`CapaService` so codes, SLA, and audit events stay consistent.
 */
@Injectable()
export class AuditsService {
  constructor(
    private readonly ncrs: NcrService,
    private readonly capas: CapaService,
  ) {}

  async list(
    tx: Tx,
    membership: Membership,
    opts: { status?: string; type?: string; plantId?: string; cursor?: string; limit: number },
  ): Promise<Page<AuditDto>> {
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

    const { rows } = await tx.query<AuditRow>(
      `SELECT ${AUDIT_COLUMNS} FROM audits ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toAuditDto);
  }

  async get(tx: Tx, membership: Membership, id: string): Promise<AuditDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    return toAuditDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    body: CreateAuditBody,
    context: AuditContext,
  ): Promise<AuditDto> {
    this.assertInScope(membership, body.plantId ?? null);
    for (const uid of [body.leadAuditorId, ...(body.team ?? [])]) {
      if (uid != null) await this.assertMember(tx, uid);
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
        entityKind: "audit",
        entityId: id,
        action: "created",
        after: { title: body.title, type: body.type },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'audit', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an audit code");

        const { rows } = await t.query<AuditRow>(
          `INSERT INTO audits
             (id, tenant_id, code, title, standard, type, status, lead_auditor_id, team, plant_id,
              start_at, end_at, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,'planned',$7,$8,$9,$10,$11,$12,$12)
           RETURNING ${AUDIT_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("audit", year, seq),
            body.title,
            body.standard ?? null,
            body.type,
            body.leadAuditorId ?? null,
            body.team ?? [],
            body.plantId ?? null,
            body.startAt ?? null,
            body.endAt ?? null,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Audit was not created");
        return toAuditDto(row);
      },
    );
  }

  async advance(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: AdvanceAuditBody,
    context: AuditContext,
  ): Promise<AuditDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row.lock_version, body.version);

    const decision = auditMachine.canTransition(row.status as AuditPhase, body.to, {});
    if (!decision.ok) throw ApiError.from(decision);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "audit",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status: body.to },
        reason: body.reason ?? null,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<AuditRow>(
          `UPDATE audits SET status = $3, updated_by = $4 WHERE id = $1 AND lock_version = $2
            RETURNING ${AUDIT_COLUMNS}`,
          [id, body.version, body.to, actorId],
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("STALE_WRITE", "The audit changed since you loaded it");
        return toAuditDto(updated);
      },
    );
  }

  // --- findings -------------------------------------------------------------

  async listFindings(
    tx: Tx,
    membership: Membership,
    auditId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<AuditFindingDto>> {
    await this.get(tx, membership, auditId); // 404 / scope
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [auditId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<FindingRow>(
      `SELECT ${FINDING_COLUMNS} FROM audit_findings
        WHERE audit_id = $1 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toFindingDto);
  }

  async createFinding(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    auditId: string,
    body: CreateAuditFindingBody,
    context: AuditContext,
  ): Promise<AuditFindingDto> {
    await this.get(tx, membership, auditId); // 404 / scope

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "audit_finding",
        entityId: id,
        action: "created",
        after: { auditId, kind: body.kind },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<FindingRow>(
          `INSERT INTO audit_findings (id, tenant_id, audit_id, clause, kind, description, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
           RETURNING ${FINDING_COLUMNS}`,
          [id, tenantId, auditId, body.clause ?? null, body.kind, body.description, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Finding was not created");
        return toFindingDto(row);
      },
    );
  }

  async raiseNcr(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    findingId: string,
    body: RaiseNcrFromFindingBody,
    context: AuditContext,
  ): Promise<NcrDto> {
    const finding = await this.loadFinding(tx, membership, findingId);
    if (finding.ncr_id !== null) throw new ApiError("CONFLICT", "That finding already has an NCR");

    const ncr = await this.ncrs.create(
      tx,
      tenantId,
      membership,
      actorId,
      {
        title: body.title ?? `NCR from audit finding: ${finding.description.slice(0, 150)}`,
        priority: body.priority,
        source: "audit",
        sourceId: finding.id,
        ...(finding.plant_id !== null ? { plantId: finding.plant_id } : {}),
      },
      context,
    );

    const linked = await tx.query(
      "UPDATE audit_findings SET ncr_id = $1, updated_by = $3 WHERE id = $2 AND ncr_id IS NULL",
      [ncr.id, finding.id, actorId],
    );
    if (linked.rowCount === 0) throw new ApiError("CONFLICT", "That finding was just linked to another NCR");
    return ncr;
  }

  async raiseCapa(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    findingId: string,
    body: RaiseCapaFromFindingBody,
    context: AuditContext,
  ): Promise<CapaDto> {
    const finding = await this.loadFinding(tx, membership, findingId);
    if (finding.capa_id !== null) throw new ApiError("CONFLICT", "That finding already has a CAPA");

    const capa = await this.capas.create(
      tx,
      tenantId,
      actorId,
      {
        title: body.title ?? `CAPA from audit finding: ${finding.description.slice(0, 150)}`,
        type: body.type,
        priority: body.priority,
        sourceKind: "audit_finding",
        sourceId: finding.id,
      },
      context,
    );

    const linked = await tx.query(
      "UPDATE audit_findings SET capa_id = $1, updated_by = $3 WHERE id = $2 AND capa_id IS NULL",
      [capa.id, finding.id, actorId],
    );
    if (linked.rowCount === 0) throw new ApiError("CONFLICT", "That finding was just linked to another CAPA");
    return capa;
  }

  // --- internals ------------------------------------------------------------

  private async fetch(tx: Tx, id: string): Promise<AuditRow | null> {
    const { rows } = await tx.query<AuditRow>(
      `SELECT ${AUDIT_COLUMNS} FROM audits WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Load a finding + its audit's plant, enforcing scope (foreign → 404). */
  private async loadFinding(
    tx: Tx,
    membership: Membership,
    findingId: string,
  ): Promise<{ id: string; description: string; ncr_id: string | null; capa_id: string | null; plant_id: string | null }> {
    const { rows } = await tx.query<{
      id: string;
      description: string;
      ncr_id: string | null;
      capa_id: string | null;
      plant_id: string | null;
    }>(
      `SELECT f.id, f.description, f.ncr_id, f.capa_id, a.plant_id
         FROM audit_findings f JOIN audits a ON a.id = f.audit_id
        WHERE f.id = $1 AND f.deleted_at IS NULL`,
      [findingId],
    );
    const finding = rows[0];
    if (finding === undefined) throw notFound();
    this.assertInScope(membership, finding.plant_id);
    return finding;
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
