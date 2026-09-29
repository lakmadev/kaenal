import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type AuditEventInput, type Tx } from "@kaenal/db";
import {
  auditChecklistProgress,
  auditMachine,
  bucketAuditFrequency,
  counterYear,
  formatCode,
  isPlantScoped,
  NC_CHECKLIST_STATUSES,
  seedAuditChecklist,
  IATF_CHECKLIST_CLAUSES,
  type Membership,
} from "@kaenal/core";
import {
  AdvanceAuditBody,
  AuditChecklistItem,
  AuditType,
  type AuditDto,
  type AuditFindingDto,
  type AuditFindingsSummary,
  type AuditFrequencyResult,
  type AuditPhase,
  type AuditStatsDto,
  type CapaDto,
  type CreateAuditBody,
  type CreateAuditFindingBody,
  type NcrDto,
  type Page,
  type RaiseCapaFromFindingBody,
  type RaiseNcrFromFindingBody,
  type UpdateAuditChecklistItemBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { staleWriteError } from "../stale-write.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import { assertPlantExists } from "../http/create-extras.js";
import type { AuditContext } from "../ncr/audit-context.js";
import type { NcrService } from "../ncr/ncr.service.js";
import type { CapaService } from "../capa/capa.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";

interface AuditRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  standard: string | null;
  type: string;
  status: string;
  lead_auditor_id: string | null;
  team: string[];
  auditee_ids: string[];
  plant_id: string | null;
  location: string | null;
  scope: string[];
  start_at: Date | null;
  end_at: Date | null;
  next_activity: string | null;
  checklist: unknown;
  closed_at: Date | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const AUDIT_COLUMNS = `id, code, title, description, standard, type, status, lead_auditor_id, team,
  auditee_ids, plant_id, location, scope, start_at, end_at, next_activity, checklist, closed_at,
  lock_version, created_at, updated_at`;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

/** The `checklist` jsonb column, parsed and validated — always an array of
 *  well-formed items after this sprint (a legacy pre-migration row is `[]`). */
function parseChecklist(raw: unknown): AuditChecklistItem[] {
  return AuditChecklistItem.array().parse(Array.isArray(raw) ? raw : []);
}

interface AuditAggregates {
  readonly findingsSummary: AuditFindingsSummary;
  readonly capasOpen: number;
  readonly capasTotal: number;
}

const EMPTY_AGGREGATES: AuditAggregates = {
  findingsSummary: { major: 0, minor: 0, opportunity: 0 },
  capasOpen: 0,
  capasTotal: 0,
};

const FINDING_KIND_FIELD: Readonly<Record<string, keyof AuditFindingsSummary>> = {
  major_nc: "major",
  minor_nc: "minor",
  opportunity: "opportunity",
};

function toAuditDto(row: AuditRow, agg: AuditAggregates): AuditDto {
  const checklist = parseChecklist(row.checklist);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    standard: row.standard,
    type: row.type as AuditType,
    status: row.status as AuditPhase,
    leadAuditorId: row.lead_auditor_id,
    team: row.team,
    auditeeIds: row.auditee_ids,
    plantId: row.plant_id,
    location: row.location,
    scope: row.scope,
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
    nextActivity: row.next_activity,
    progress: auditChecklistProgress(checklist),
    checklist,
    findingsSummary: agg.findingsSummary,
    capasOpen: agg.capasOpen,
    capasTotal: agg.capasTotal,
    closedAt: iso(row.closed_at),
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
  title: string | null;
  description: string;
  due_date: Date | null;
  ncr_id: string | null;
  capa_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const FINDING_COLUMNS =
  "id, audit_id, clause, kind, title, description, due_date, ncr_id, capa_id, created_at, updated_at";

function toFindingDto(row: FindingRow): AuditFindingDto {
  return {
    id: row.id,
    auditId: row.audit_id,
    clause: row.clause,
    kind: row.kind as AuditFindingDto["kind"],
    title: row.title,
    description: row.description,
    dueDate: iso(row.due_date),
    ncrId: row.ncr_id,
    capaId: row.capa_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Audits (02 §2, 03 §3, Sprint 02). An audit runs through fixed phases
 * (planned → … → closed, `auditMachine`), carries a scored clause checklist
 * (`checklist` jsonb, seeded from a fixed IATF 16949 bank at creation), and
 * accumulates findings; each finding can spawn an NCR or a CAPA — the same
 * corrective seam as inspection findings, linking `audit_findings.ncr_id`/
 * `capa_id`. Audits are plant-scoped (an inspector/viewer sees only their
 * plants); management needs `audit:manage` (admin/manager/auditor), reading
 * `audit:view` (everyone — but `SearchService`/`AiChatService` additionally
 * exclude `audit`-kind hits for inspector/viewer, since `rbac.ts`'s ROLE_NAV
 * never surfaces the `/audits` route to them). Raising delegates to
 * `NcrService`/`CapaService` so codes, SLA, and audit events stay consistent.
 */
@Injectable()
export class AuditsService {
  constructor(
    private readonly ncrs: NcrService,
    private readonly capas: CapaService,
    private readonly notifications: NotificationsService = new NotificationsService(),
  ) {}

  async list(
    tx: Tx,
    membership: Membership,
    callerId: string,
    opts: {
      status?: string;
      type?: string;
      plantId?: string;
      q?: string;
      mine?: boolean;
      from?: string;
      to?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<AuditDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      if (opts.status === "active") {
        where += " AND status <> 'closed'";
      } else if (opts.status === "completed") {
        where += " AND status = 'closed'";
      } else {
        params.push(opts.status);
        where += ` AND status = $${params.length}`;
      }
    }
    if (opts.type !== undefined) {
      params.push(opts.type);
      where += ` AND type = $${params.length}`;
    }
    if (opts.plantId !== undefined) {
      params.push(opts.plantId);
      where += ` AND plant_id = $${params.length}`;
    }
    if (opts.q !== undefined) {
      params.push(`%${opts.q}%`);
      where += ` AND (title ILIKE $${params.length} OR code ILIKE $${params.length})`;
    }
    if (opts.mine === true) {
      params.push(callerId);
      where += ` AND (lead_auditor_id = $${params.length} OR $${params.length} = ANY(team) OR $${params.length} = ANY(auditee_ids))`;
    }
    if (opts.from !== undefined) {
      params.push(opts.from);
      where += ` AND (end_at IS NULL OR end_at >= $${params.length})`;
    }
    if (opts.to !== undefined) {
      params.push(opts.to);
      where += ` AND (start_at IS NULL OR start_at <= $${params.length})`;
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
    const agg = await this.loadAggregates(tx, rows.map((r) => r.id));
    return toPage(rows, limit, (row) => toAuditDto(row, agg.get(row.id) ?? EMPTY_AGGREGATES));
  }

  /** Last-6-months audit counts grouped by type (S2-1 frequency chart). */
  async frequency(tx: Tx, membership: Membership): Promise<AuditFrequencyResult> {
    const params: unknown[] = [];
    let where =
      "WHERE deleted_at IS NULL AND created_at >= date_trunc('month', now() - interval '5 months')";
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      where += ` AND plant_id = ANY($${params.length}::uuid[])`;
    }
    const { rows } = await tx.query<{ month: string; type: string; count: string }>(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, type, count(*)::int AS count
         FROM audits ${where}
        GROUP BY 1, 2`,
      params,
    );
    const points = bucketAuditFrequency(
      rows.map((r) => ({ month: r.month, type: r.type, count: Number(r.count) })),
      AuditType.values,
      new Date(),
    );
    return { points };
  }

  /** KPI strip: a single aggregate query, plant-scoped like `list` (S2-1 AC5). */
  async stats(tx: Tx, membership: Membership): Promise<AuditStatsDto> {
    const params: unknown[] = [];
    let plantFilter = "";
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      plantFilter = ` AND plant_id = ANY($${params.length}::uuid[])`;
    }
    const { rows } = await tx.query<{ active: string; planned_next_90d: string; completed_ytd: string }>(
      `SELECT
          count(*) FILTER (WHERE status <> 'closed') AS active,
          count(*) FILTER (
            WHERE status = 'planned' AND start_at IS NOT NULL
              AND start_at BETWEEN now() AND now() + interval '90 days'
          ) AS planned_next_90d,
          count(*) FILTER (WHERE closed_at IS NOT NULL AND closed_at >= date_trunc('year', now())) AS completed_ytd
        FROM audits WHERE deleted_at IS NULL${plantFilter}`,
      params,
    );
    const row = rows[0];

    // "Open" = not yet linked to a corrective seam (neither an NCR nor a CAPA
    // has been raised from it yet) — the smallest-reasonable reading absent a
    // spec definition (logged in PROGRESS.md Decisions).
    const findingsParams: unknown[] = [];
    let findingsWhere = "WHERE af.deleted_at IS NULL AND af.ncr_id IS NULL AND af.capa_id IS NULL";
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      findingsParams.push(membership.plantIds);
      findingsWhere += ` AND a.plant_id = ANY($${findingsParams.length}::uuid[])`;
    }
    const { rows: findingRows } = await tx.query<{ open_findings: string }>(
      `SELECT count(*) AS open_findings FROM audit_findings af JOIN audits a ON a.id = af.audit_id ${findingsWhere}`,
      findingsParams,
    );

    return {
      active: Number(row?.active ?? 0),
      plannedNext90d: Number(row?.planned_next_90d ?? 0),
      completedYtd: Number(row?.completed_ytd ?? 0),
      openFindings: Number(findingRows[0]?.open_findings ?? 0),
    };
  }

  async get(tx: Tx, membership: Membership, id: string): Promise<AuditDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    const agg = await this.loadAggregates(tx, [row.id]);
    return toAuditDto(row, agg.get(row.id) ?? EMPTY_AGGREGATES);
  }

  async create(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    body: CreateAuditBody,
    context: AuditContext,
  ): Promise<AuditDto> {
    await assertPlantExists(tx, body.plantId ?? null);
    this.assertInScope(membership, body.plantId ?? null);

    const people = [body.leadAuditorId ?? null, ...(body.team ?? []), ...(body.auditeeIds ?? [])].filter(
      (u): u is string => u !== null,
    );
    await this.assertMembers(tx, people);

    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();
    const checklistIds = IATF_CHECKLIST_CLAUSES.map(() => randomUUID());
    const checklist = seedAuditChecklist(checklistIds);

    const dto = await withAudit(
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
             (id, tenant_id, code, title, description, standard, type, status, lead_auditor_id, team,
              auditee_ids, plant_id, location, scope, start_at, end_at, next_activity, checklist,
              created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'planned',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$18)
           RETURNING ${AUDIT_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("audit", year, seq),
            body.title,
            body.description ?? null,
            body.standard ?? null,
            body.type,
            body.leadAuditorId ?? null,
            body.team ?? [],
            body.auditeeIds ?? [],
            body.plantId ?? null,
            body.location ?? null,
            body.scope ?? [],
            body.startAt ?? null,
            body.endAt ?? null,
            body.nextActivity ?? null,
            JSON.stringify(checklist),
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Audit was not created");
        return toAuditDto(row, EMPTY_AGGREGATES);
      },
    );

    // Notify the lead auditor, the audit team, AND the auditees — never
    // suppressed by role (an auditee can legitimately be an inspector; hiding
    // "you're being audited" from them would be worse than the pre-existing
    // route-guard bounce a rare click-through hits — architecture review §8
    // item 1 / PO resolution §8a item 1).
    const recipients = new Set(people);
    for (const userId of recipients) {
      if (userId === actorId) continue;
      await this.notifications.notify(tx, tenantId, {
        userId,
        actorId,
        kind: "audit_assigned",
        title: `${dto.code} — you were added to an audit`,
        entityKind: "audit",
        entityId: id,
        dedupeKey: `audit-notify:${id}:${userId}`,
      });
    }

    return dto;
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
    await this.assertVersion(tx, id, row.lock_version, body.version);

    const decision = auditMachine.canTransition(row.status as AuditPhase, body.to, {});
    if (!decision.ok) throw ApiError.from(decision);

    const nextActivity = body.nextActivity === undefined ? row.next_activity : body.nextActivity;

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
          `UPDATE audits
              SET status = $3, updated_by = $4, next_activity = $5,
                  closed_at = CASE WHEN $3 = 'closed' THEN now() ELSE closed_at END
            WHERE id = $1 AND lock_version = $2
          RETURNING ${AUDIT_COLUMNS}`,
          [id, body.version, body.to, actorId, nextActivity],
        );
        const updated = rows[0];
        if (updated === undefined) throw await staleWriteError(t, { table: "audits", key: id, message: "The audit changed since you loaded it" });
        const agg = await this.loadAggregates(t, [updated.id]);
        return toAuditDto(updated, agg.get(updated.id) ?? EMPTY_AGGREGATES);
      },
    );
  }

  /**
   * Score one checklist clause (S2-4). Optimistic on the audit's `lockVersion`
   * and refused when the audit is `closed` — both checked inside the SAME
   * guarded `UPDATE`, so a concurrent advance-to-closed can't race a score
   * (whichever commits first wins; the loser sees the *current* reason,
   * distinguished after the fact). A first score of major_nc/minor_nc/
   * opportunity with no linked finding yet creates one in the SAME
   * transaction, titled from the clause's section.
   */
  async updateChecklistItem(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    auditId: string,
    itemId: string,
    body: UpdateAuditChecklistItemBody,
    context: AuditContext,
  ): Promise<AuditDto> {
    const row = await this.fetch(tx, auditId);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);

    const checklist = parseChecklist(row.checklist);
    const idx = checklist.findIndex((i) => i.id === itemId);
    if (idx === -1) throw notFound();
    const item = checklist[idx]!;

    const createsFinding = NC_CHECKLIST_STATUSES.has(body.status) && item.findingId === null;
    const newFindingId = createsFinding ? randomUUID() : null;

    const updatedItem = {
      ...item,
      status: body.status,
      notes: body.notes === undefined ? item.notes : body.notes,
      findingId: newFindingId ?? item.findingId,
    };
    const newChecklist = [...checklist];
    newChecklist[idx] = updatedItem;

    const events: AuditEventInput[] = [
      {
        actorId,
        actorKind: "user",
        entityKind: "audit",
        entityId: auditId,
        action: "checklist_item_scored",
        before: { itemId, status: item.status },
        after: { itemId, status: body.status },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    ];
    if (createsFinding && newFindingId !== null) {
      events.push({
        actorId,
        actorKind: "user",
        entityKind: "audit_finding",
        entityId: newFindingId,
        action: "created",
        after: { auditId, kind: body.status, clause: item.clause },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }

    return withAudit(tx, tenantId, events, async (t) => {
      const { rows } = await t.query<AuditRow>(
        `UPDATE audits SET checklist = $3::jsonb, updated_by = $4
            WHERE id = $1 AND lock_version = $2 AND status <> 'closed'
          RETURNING ${AUDIT_COLUMNS}`,
        [auditId, body.version, JSON.stringify(newChecklist), actorId],
      );
      const updated = rows[0];
      if (updated === undefined) {
        const { rows: cur } = await t.query<{ status: string }>(
          "SELECT status FROM audits WHERE id = $1 AND deleted_at IS NULL",
          [auditId],
        );
        if (cur[0]?.status === "closed") {
          throw new ApiError("VALIDATION_FAILED", "The audit is closed");
        }
        throw await staleWriteError(t, { table: "audits", key: auditId, message: "The audit changed since you loaded it" });
      }

      if (createsFinding && newFindingId !== null) {
        await t.query(
          `INSERT INTO audit_findings (id, tenant_id, audit_id, clause, kind, title, description, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
          [newFindingId, tenantId, auditId, item.clause, body.status, item.section, item.text, actorId],
        );
      }

      const agg = await this.loadAggregates(t, [updated.id]);
      return toAuditDto(updated, agg.get(updated.id) ?? EMPTY_AGGREGATES);
    });
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
          `INSERT INTO audit_findings (id, tenant_id, audit_id, clause, kind, title, description, due_date, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
           RETURNING ${FINDING_COLUMNS}`,
          [id, tenantId, auditId, body.clause ?? null, body.kind, body.title ?? null, body.description, body.dueDate ?? null, actorId],
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

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "audit_finding",
        entityId: finding.id,
        action: "updated",
        before: { ncrId: null },
        after: { ncrId: ncr.id },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const linked = await t.query(
          "UPDATE audit_findings SET ncr_id = $1, updated_by = $3 WHERE id = $2 AND ncr_id IS NULL",
          [ncr.id, finding.id, actorId],
        );
        if (linked.rowCount === 0) throw new ApiError("CONFLICT", "That finding was just linked to another NCR");
      },
    );
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

  /** Used by `ExportsService` (audit_report) to 404 on a foreign/unknown
   *  auditId before enqueueing a render — never a queued job that fails later. */
  async assertViewable(tx: Tx, membership: Membership, id: string): Promise<void> {
    await this.get(tx, membership, id);
  }

  private async fetch(tx: Tx, id: string): Promise<AuditRow | null> {
    const { rows } = await tx.query<AuditRow>(
      `SELECT ${AUDIT_COLUMNS} FROM audits WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Findings-summary + CAPA counts for a batch of audits (list) or one (get) —
   *  a single pair of queries regardless of page size, never N+1. */
  private async loadAggregates(tx: Tx, auditIds: readonly string[]): Promise<Map<string, AuditAggregates>> {
    const out = new Map<string, AuditAggregates>();
    if (auditIds.length === 0) return out;

    const { rows: findingRows } = await tx.query<{ audit_id: string; kind: string; c: string }>(
      `SELECT audit_id, kind, count(*)::int AS c FROM audit_findings
        WHERE audit_id = ANY($1::uuid[]) AND deleted_at IS NULL
        GROUP BY audit_id, kind`,
      [auditIds],
    );
    const { rows: capaRows } = await tx.query<{ audit_id: string; open: string; total: string }>(
      `SELECT af.audit_id, count(*) FILTER (WHERE c.status <> 'closed')::int AS open, count(*)::int AS total
         FROM audit_findings af JOIN capas c ON c.id = af.capa_id
        WHERE af.audit_id = ANY($1::uuid[]) AND af.capa_id IS NOT NULL AND af.deleted_at IS NULL
        GROUP BY af.audit_id`,
      [auditIds],
    );

    for (const id of auditIds) out.set(id, { ...EMPTY_AGGREGATES });
    for (const r of findingRows) {
      const field = FINDING_KIND_FIELD[r.kind];
      if (field === undefined) continue;
      const cur = out.get(r.audit_id) ?? { ...EMPTY_AGGREGATES };
      out.set(r.audit_id, { ...cur, findingsSummary: { ...cur.findingsSummary, [field]: Number(r.c) } });
    }
    for (const r of capaRows) {
      const cur = out.get(r.audit_id) ?? { ...EMPTY_AGGREGATES };
      out.set(r.audit_id, { ...cur, capasOpen: Number(r.open), capasTotal: Number(r.total) });
    }
    return out;
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

  /** Every id must be an active member of THIS tenant → else 404 (never a 403
   *  that would distinguish "invalid" from "belongs to another tenant", rule 8). */
  private async assertMembers(tx: Tx, userIds: readonly string[]): Promise<void> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;
    const { rows } = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM memberships WHERE user_id = ANY($1::uuid[]) AND status = 'active' AND deleted_at IS NULL",
      [ids],
    );
    if (rows.length !== ids.length) throw notFound();
  }

  private assertInScope(membership: Membership, plantId: string | null): void {
    if (!isPlantScoped(membership.role)) return;
    if (membership.plantIds.length === 0) return;
    if (plantId !== null && membership.plantIds.includes(plantId)) return;
    throw notFound();
  }

  private async assertVersion(tx: Tx, id: string, actual: number, expected: number): Promise<void> {
    if (actual !== expected) {
      throw await staleWriteError(tx, { table: "audits", key: id, message: "The record changed since you loaded it", expected, actual });
    }
  }
}
