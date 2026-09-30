import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  advanceComplaintStatus,
  complaintSeverityToNcrPriority,
  complaintSeverityToWizardPriority,
  complaintSlaState,
  complaintSlaTargetsFor,
  counterYear,
  customerColor,
  formatCode,
  hasCapability,
  type Membership,
} from "@kaenal/core";
import type {
  ComplaintConvertBody,
  ComplaintConvertResult,
  ComplaintDto,
  ComplaintSeverity,
  ComplaintStatus,
  ComplaintSummaryDto,
  CreateComplaintBody,
  Page,
  UpdateComplaintBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { staleWriteError } from "../stale-write.js";
import { assertEntityVisible } from "../collab/entity-ref.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";
import type { NcrService } from "../ncr/ncr.service.js";
import type { EightDService } from "../eight-d/eight-d.service.js";
import type { CapaService } from "../capa/capa.service.js";

interface ComplaintRow {
  id: string;
  code: string;
  customer: string;
  contact: string;
  channel: string;
  severity: string;
  status: string;
  subject: string;
  description: string;
  batch_ref: string | null;
  received_at: Date;
  acknowledged_at: Date | null;
  closed_at: Date | null;
  cost_usd: string | null;
  sla_target_hours: number;
  sla_close_target_days: number;
  owner: string;
  ncr_id: string | null;
  eight_d_id: string | null;
  capa_id: string | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const COMPLAINT_COLUMNS = `id, code, customer, contact, channel, severity, status, subject, description,
  batch_ref, received_at, acknowledged_at, closed_at, cost_usd, sla_target_hours, sla_close_target_days,
  owner, ncr_id, eight_d_id, capa_id, lock_version, created_at, updated_at`;

function toComplaintDto(row: ComplaintRow, now: string = new Date().toISOString()): ComplaintDto {
  return {
    id: row.id,
    code: row.code,
    customer: row.customer,
    customerColor: customerColor(row.customer),
    contact: row.contact,
    channel: row.channel as ComplaintDto["channel"],
    severity: row.severity as ComplaintSeverity,
    status: row.status as ComplaintStatus,
    subject: row.subject,
    description: row.description,
    batchRef: row.batch_ref,
    receivedAt: row.received_at.toISOString(),
    acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
    closedAt: row.closed_at?.toISOString() ?? null,
    costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
    slaTargetHours: row.sla_target_hours,
    slaCloseTargetDays: row.sla_close_target_days,
    slaState: complaintSlaState({
      slaTargetHours: row.sla_target_hours,
      receivedAt: row.received_at.toISOString(),
      acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
      closedAt: row.closed_at?.toISOString() ?? null,
      now,
    }),
    owner: row.owner,
    ncrId: row.ncr_id,
    eightDId: row.eight_d_id,
    capaId: row.capa_id,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Target capability required to convert to each target — a real,
 *  independently enforced gate (§0 B6f), not redundant with `complaint:manage`. */
const TARGET_CAPABILITY = {
  ncr: "ncr:create",
  eight_d: "ncr:manage",
  capa: "capa:manage",
} as const;

/**
 * Customer complaints register (SPRINT-06 C1-C4, P18). Reads need
 * `complaint:view`, writes `complaint:manage`, plus (for convert) the real
 * target capability. Not plant-scoped (no `plant_id` column).
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly ncrs: NcrService,
    private readonly eightDs: EightDService,
    private readonly capas: CapaService,
  ) {}

  private async loadRow(tx: Tx, id: string): Promise<ComplaintRow> {
    const { rows } = await tx.query<ComplaintRow>(
      `SELECT ${COMPLAINT_COLUMNS} FROM complaints WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  private async loadRowForUpdate(tx: Tx, id: string): Promise<ComplaintRow> {
    const { rows } = await tx.query<ComplaintRow>(
      `SELECT ${COMPLAINT_COLUMNS} FROM complaints WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async list(
    tx: Tx,
    opts: {
      status?: string;
      severity?: string;
      channel?: string;
      owner?: string;
      unlinked?: boolean;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<ComplaintDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;

    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.severity !== undefined) {
      params.push(opts.severity);
      where += ` AND severity = $${params.length}`;
    }
    if (opts.channel !== undefined) {
      params.push(opts.channel);
      where += ` AND channel = $${params.length}`;
    }
    if (opts.owner !== undefined) {
      params.push(opts.owner);
      where += ` AND owner = $${params.length}`;
    }
    if (opts.unlinked === true) {
      where += ` AND ncr_id IS NULL`;
    }
    if (opts.q !== undefined) {
      params.push(opts.q);
      where += ` AND search_vector @@ websearch_to_tsquery('english', $${params.length})`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<ComplaintRow>(
      `SELECT ${COMPLAINT_COLUMNS} FROM complaints ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, (r) => toComplaintDto(r));
  }

  async summary(tx: Tx, actorId: string): Promise<ComplaintSummaryDto> {
    const { rows } = await tx.query<{
      open: string;
      critical: string;
      no_link: string;
      mine: string;
      resp_num: string;
      resp_den: string;
      avg_close_days: string | null;
      avg_cost: string | null;
    }>(
      `SELECT
         count(*) FILTER (WHERE status <> 'closed') AS open,
         count(*) FILTER (WHERE status <> 'closed' AND severity = 'critical') AS critical,
         count(*) FILTER (WHERE status <> 'closed' AND ncr_id IS NULL) AS no_link,
         count(*) FILTER (WHERE status <> 'closed' AND owner = $1) AS mine,
         count(*) FILTER (
           WHERE received_at >= now() - interval '30 days'
             AND (acknowledged_at IS NOT NULL OR received_at <= now() - interval '24 hours')
             AND acknowledged_at IS NOT NULL
             AND acknowledged_at <= received_at + interval '24 hours'
         ) AS resp_num,
         count(*) FILTER (
           WHERE received_at >= now() - interval '30 days'
             AND (acknowledged_at IS NOT NULL OR received_at <= now() - interval '24 hours')
         ) AS resp_den,
         avg(extract(epoch FROM (closed_at - received_at)) / 86400) FILTER (WHERE closed_at IS NOT NULL) AS avg_close_days,
         avg(cost_usd) FILTER (WHERE cost_usd IS NOT NULL) AS avg_cost
       FROM complaints WHERE deleted_at IS NULL`,
      [actorId],
    );
    const r = rows[0];
    const open = Number(r?.open ?? 0);
    const critical = Number(r?.critical ?? 0);
    const noLink = Number(r?.no_link ?? 0);
    const mine = Number(r?.mine ?? 0);
    const respDen = Number(r?.resp_den ?? 0);
    const respNum = Number(r?.resp_num ?? 0);
    return {
      open,
      critical,
      responseWithin24hPct: respDen === 0 ? null : Math.round((respNum / respDen) * 1000) / 10,
      avgTimeToCloseDays: r?.avg_close_days == null ? null : Number(r.avg_close_days),
      avgCostPerComplaint: r?.avg_cost == null ? null : Number(r.avg_cost),
      tabCounts: { all: open, critical, noLink, mine },
    };
  }

  async get(tx: Tx, id: string): Promise<ComplaintDto> {
    return toComplaintDto(await this.loadRow(tx, id));
  }

  /** Verifies a file is a fully-uploaded, complaint-tagged attachment before
   *  linking (mirrors `instruments.service.ts`'s `verifyLinkableFile` exactly,
   *  Sprint 05's precedent, §2 C2 AC1). */
  private async verifyLinkableFile(tx: Tx, fileId: string): Promise<string> {
    const { rows } = await tx.query<{
      id: string;
      sha256: string | null;
      entity_kind: string | null;
      deleted_at: Date | null;
    }>("SELECT id, sha256, entity_kind, deleted_at FROM files WHERE id = $1", [fileId]);
    const file = rows[0];
    if (file === undefined) throw notFound();
    if (file.deleted_at !== null) throw new ApiError("VALIDATION_FAILED", "That file has been deleted");
    if (file.sha256 === null) {
      throw new ApiError("VALIDATION_FAILED", "That file has not finished uploading");
    }
    if (file.entity_kind !== "complaint") {
      throw new ApiError("VALIDATION_FAILED", "That file was not uploaded for this purpose");
    }
    return file.id;
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateComplaintBody,
    context: AuditContext,
  ): Promise<ComplaintDto> {
    const id = randomUUID();
    const now = new Date();
    const year = counterYear(now, "UTC");
    const targets = complaintSlaTargetsFor(body.severity);
    const attachmentFileIds = body.attachmentFileIds ?? [];
    // Verify every attachment BEFORE the audited insert — a bad attachment id
    // must fail the whole create, never partially insert the complaint.
    const verifiedFileIds: string[] = [];
    for (const fileId of attachmentFileIds) {
      verifiedFileIds.push(await this.verifyLinkableFile(tx, fileId));
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "complaint",
        entityId: id,
        action: "created",
        after: { customer: body.customer, severity: body.severity, subject: body.subject },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'complaint', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a complaint code");

        const { rows } = await t.query<ComplaintRow>(
          `INSERT INTO complaints
             (id, tenant_id, code, customer, contact, channel, severity, subject, description, batch_ref,
              sla_target_hours, sla_close_target_days, owner, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$13)
           RETURNING ${COMPLAINT_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("complaint", year, seq),
            body.customer,
            body.contact,
            body.channel,
            body.severity,
            body.subject,
            body.description ?? "",
            body.batchRef ?? null,
            targets.ackHours,
            targets.closeDays,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Complaint was not created");

        for (const fileId of verifiedFileIds) {
          await t.query(
            `INSERT INTO complaint_attachments (id, tenant_id, complaint_id, file_id, created_by)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (tenant_id, complaint_id, file_id) DO NOTHING`,
            [randomUUID(), tenantId, id, fileId, actorId],
          );
        }
        return toComplaintDto(row);
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateComplaintBody,
    context: AuditContext,
  ): Promise<ComplaintDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "complaints",
        key: id,
        message: "This complaint changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }

    const next = {
      customer: body.customer ?? current.customer,
      contact: body.contact ?? current.contact,
      channel: body.channel ?? current.channel,
      severity: body.severity ?? current.severity,
      subject: body.subject ?? current.subject,
      description: body.description ?? current.description,
      batchRef: body.batchRef !== undefined ? body.batchRef : current.batch_ref,
      costUsd: body.costUsd !== undefined ? body.costUsd : current.cost_usd === null ? null : Number(current.cost_usd),
    };
    // Changing severity re-derives the SLA targets from the matrix, in the
    // same transaction (§0 B7c) — never left stale against a matrix change.
    const targets = complaintSlaTargetsFor(next.severity as ComplaintSeverity);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "complaint",
        entityId: id,
        action: "updated",
        before: {
          customer: current.customer,
          contact: current.contact,
          channel: current.channel,
          severity: current.severity,
          subject: current.subject,
        },
        after: {
          customer: next.customer,
          contact: next.contact,
          channel: next.channel,
          severity: next.severity,
          subject: next.subject,
        },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ComplaintRow>(
          `UPDATE complaints
              SET customer = $2, contact = $3, channel = $4, severity = $5, subject = $6, description = $7,
                  batch_ref = $8, cost_usd = $9, sla_target_hours = $10, sla_close_target_days = $11,
                  updated_by = $12
            WHERE id = $1 AND lock_version = $13
            RETURNING ${COMPLAINT_COLUMNS}`,
          [
            id,
            next.customer,
            next.contact,
            next.channel,
            next.severity,
            next.subject,
            next.description,
            next.batchRef,
            next.costUsd,
            targets.ackHours,
            targets.closeDays,
            actorId,
            body.lockVersion,
          ],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, {
            table: "complaints",
            key: id,
            message: "This complaint changed since you loaded it",
          });
        }
        return toComplaintDto(row);
      },
    );
  }

  async acknowledge(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    lockVersion: number,
    context: AuditContext,
  ): Promise<ComplaintDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== lockVersion) {
      throw await staleWriteError(tx, { table: "complaints", key: id, message: "This complaint changed since you loaded it", expected: lockVersion, actual: current.lock_version });
    }
    if (current.acknowledged_at !== null) {
      throw new ApiError("VALIDATION_FAILED", "This complaint is already acknowledged");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "complaint",
        entityId: id,
        action: "updated",
        before: { acknowledgedAt: null },
        after: { acknowledgedAt: "now" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ComplaintRow>(
          `UPDATE complaints SET acknowledged_at = now(), updated_by = $2
            WHERE id = $1 AND lock_version = $3 AND acknowledged_at IS NULL
            RETURNING ${COMPLAINT_COLUMNS}`,
          [id, actorId, lockVersion],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, { table: "complaints", key: id, message: "This complaint changed since you loaded it" });
        }
        return toComplaintDto(row);
      },
    );
  }

  async close(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    lockVersion: number,
    context: AuditContext,
  ): Promise<ComplaintDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== lockVersion) {
      throw await staleWriteError(tx, { table: "complaints", key: id, message: "This complaint changed since you loaded it", expected: lockVersion, actual: current.lock_version });
    }
    if (current.status === "closed") {
      throw new ApiError("VALIDATION_FAILED", "This complaint is already closed");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "complaint",
        entityId: id,
        action: "status_changed",
        before: { status: current.status },
        after: { status: "closed" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ComplaintRow>(
          `UPDATE complaints SET status = 'closed', closed_at = now(), updated_by = $2
            WHERE id = $1 AND lock_version = $3 AND status <> 'closed'
            RETURNING ${COMPLAINT_COLUMNS}`,
          [id, actorId, lockVersion],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, { table: "complaints", key: id, message: "This complaint changed since you loaded it" });
        }
        return toComplaintDto(row);
      },
    );
  }

  /**
   * Convert/link a complaint to NCR/8D/CAPA (§2 C4, §0 B6). `SELECT ... FOR
   * UPDATE`s the complaint first, computes status from the LOCKED row, and
   * audits the complaint on every successful call — even when status doesn't
   * move (§0 B6d).
   */
  async convert(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: ComplaintConvertBody,
    context: AuditContext,
  ): Promise<ComplaintConvertResult> {
    // Real, enforced per-target capability gate (§0 B6f) — not redundant with
    // complaint:manage, which the controller already required.
    const targetCapability = TARGET_CAPABILITY[body.target];
    if (!hasCapability(membership.role, targetCapability)) {
      throw new ApiError("FORBIDDEN", `Converting to '${body.target}' requires '${targetCapability}'`);
    }

    const locked = await this.loadRowForUpdate(tx, id);
    if (locked.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "complaints",
        key: id,
        message: "This complaint changed since you loaded it",
        expected: body.lockVersion,
        actual: locked.lock_version,
      });
    }
    if (locked.status === "closed") {
      throw new ApiError("VALIDATION_FAILED", "This complaint is already closed", { code: "COMPLAINT_CLOSED" });
    }

    if (body.target === "ncr" && "existingNcrId" in body) {
      if (locked.ncr_id !== null) {
        throw new ApiError("CONFLICT", "This complaint is already linked to an NCR", { ncrId: locked.ncr_id });
      }
      await assertEntityVisible(tx, "ncr", body.existingNcrId, membership);
      const { rows: ncrRows } = await tx.query<{ id: string; code: string }>(
        "SELECT id, code FROM ncrs WHERE id = $1 AND deleted_at IS NULL",
        [body.existingNcrId],
      );
      const ncr = ncrRows[0];
      if (ncr === undefined) throw notFound();

      const newStatus = advanceComplaintStatus(locked.status as ComplaintStatus, "investigation");
      const updated = await this.applyConvert(tx, tenantId, actorId, id, locked, newStatus, { ncrId: ncr.id }, context);
      return { complaint: updated, target: { kind: "ncr", id: ncr.id, code: ncr.code } };
    }

    if (body.target === "ncr") {
      if (locked.ncr_id !== null) {
        throw new ApiError("CONFLICT", "This complaint is already linked to an NCR", { ncrId: locked.ncr_id });
      }
      const ncr = await this.ncrs.create(
        tx,
        tenantId,
        membership,
        actorId,
        {
          title: body.title ?? `NCR from complaint ${locked.code}: ${locked.subject.slice(0, 150)}`,
          priority: complaintSeverityToNcrPriority(locked.severity as ComplaintSeverity),
          source: "complaint",
          sourceId: locked.id,
        },
        context,
      );
      const newStatus = advanceComplaintStatus(locked.status as ComplaintStatus, "investigation");
      const updated = await this.applyConvert(tx, tenantId, actorId, id, locked, newStatus, { ncrId: ncr.id }, context);
      return { complaint: updated, target: { kind: "ncr", id: ncr.id, code: ncr.code } };
    }

    if (body.target === "eight_d") {
      if (locked.eight_d_id !== null) {
        throw new ApiError("CONFLICT", "This complaint is already linked to an 8D", { eightDId: locked.eight_d_id });
      }
      const eightD = await this.eightDs.create(
        tx,
        tenantId,
        actorId,
        {
          title: body.title ?? `8D from complaint ${locked.code}: ${locked.subject.slice(0, 150)}`,
          priority: complaintSeverityToWizardPriority(locked.severity as ComplaintSeverity),
          ...(locked.ncr_id !== null ? { ncrId: locked.ncr_id } : {}),
        },
        context,
      );
      await tx.query("UPDATE eight_ds SET source = 'complaint', source_id = $2 WHERE id = $1", [eightD.id, locked.id]);
      const newStatus = advanceComplaintStatus(locked.status as ComplaintStatus, "8d");
      const updated = await this.applyConvert(tx, tenantId, actorId, id, locked, newStatus, { eightDId: eightD.id }, context);
      return { complaint: updated, target: { kind: "eight_d", id: eightD.id, code: eightD.code } };
    }

    // target === "capa"
    if (locked.capa_id !== null) {
      throw new ApiError("CONFLICT", "This complaint is already linked to a CAPA", { capaId: locked.capa_id });
    }
    const capa = await this.capas.create(
      tx,
      tenantId,
      actorId,
      {
        title: body.title ?? `CAPA from complaint ${locked.code}: ${locked.subject.slice(0, 150)}`,
        type: body.type,
        priority: complaintSeverityToNcrPriority(locked.severity as ComplaintSeverity),
        sourceKind: "complaint",
        sourceId: locked.id,
      },
      context,
    );
    const newStatus = advanceComplaintStatus(locked.status as ComplaintStatus, "capa");
    const updated = await this.applyConvert(tx, tenantId, actorId, id, locked, newStatus, { capaId: capa.id }, context);
    return { complaint: updated, target: { kind: "capa", id: capa.id, code: capa.code } };
  }

  /** Applies the complaint-side link + status advance, always audited — even
   *  when status doesn't move (§0 B6d), matching `raiseNcr`'s pattern, never
   *  `raiseCapa`'s old unaudited one. */
  private async applyConvert(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    before: ComplaintRow,
    newStatus: ComplaintStatus,
    fields: { ncrId?: string; eightDId?: string; capaId?: string },
    context: AuditContext,
  ): Promise<ComplaintDto> {
    const statusChanged = newStatus !== before.status;
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "complaint",
        entityId: id,
        action: statusChanged ? "status_changed" : "updated",
        before: { status: before.status, ncrId: before.ncr_id, eightDId: before.eight_d_id, capaId: before.capa_id },
        after: { status: newStatus, ...fields },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ComplaintRow>(
          `UPDATE complaints
              SET status = $2,
                  ncr_id = COALESCE($3, ncr_id),
                  eight_d_id = COALESCE($4, eight_d_id),
                  capa_id = COALESCE($5, capa_id),
                  updated_by = $6
            WHERE id = $1 AND status <> 'closed'
            RETURNING ${COMPLAINT_COLUMNS}`,
          [id, newStatus, fields.ncrId ?? null, fields.eightDId ?? null, fields.capaId ?? null, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("VALIDATION_FAILED", "This complaint is already closed", { code: "COMPLAINT_CLOSED" });
        return toComplaintDto(row);
      },
    );
  }
}
