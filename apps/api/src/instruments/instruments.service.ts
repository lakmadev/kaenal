import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  authorize,
  counterYear,
  formatCode,
  instrumentDueStatus,
  isPlantScoped,
  type CalibrationResult,
  type InstrumentDueStatus,
  type Membership,
} from "@kaenal/core";
import type {
  AttachCertificateBody,
  CalibrationEventDto,
  CreateCalibrationEventBody,
  CreateInstrumentBody,
  InstrumentDto,
  InstrumentSummaryDto,
  NcrDto,
  NcrPriority,
  Page,
  RetireInstrumentBody,
  UpdateInstrumentBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { staleWriteError } from "../stale-write.js";
import type { AuditContext } from "../ncr/audit-context.js";
import type { NcrService } from "../ncr/ncr.service.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";

interface InstrumentRow {
  id: string;
  code: string;
  name: string;
  type: string;
  plant_id: string;
  area_id: string | null;
  method: string;
  tolerance: string;
  interval_months: number;
  last_calibrated: string | null;
  next_due: string | null;
  last_result: string | null;
  owner: string | null;
  status: string;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
  plant_timezone: string;
}

interface CalibrationEventRow {
  id: string;
  instrument_id: string;
  performed_at: string;
  result: string;
  performed_by: string;
  notes: string;
  certificate_file_id: string | null;
  ncr_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const INSTRUMENT_COLUMNS = `i.id, i.code, i.name, i.type, i.plant_id, i.area_id, i.method, i.tolerance,
  i.interval_months, i.last_calibrated::text AS last_calibrated, i.next_due::text AS next_due,
  i.last_result, i.owner, i.status, i.lock_version, i.created_at, i.updated_at, p.timezone AS plant_timezone`;

const CALIBRATION_EVENT_COLUMNS = `id, instrument_id, performed_at::text AS performed_at, result, performed_by,
  notes, certificate_file_id, ncr_id, created_at, updated_at`;

/** `now()` as YYYY-MM-DD in the given IANA timezone. */
function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  );
}

function toInstrumentDto(row: InstrumentRow): InstrumentDto {
  const dueStatus: InstrumentDueStatus = instrumentDueStatus({
    nextDue: row.next_due,
    lastResult: row.last_result as CalibrationResult | null,
    today: todayIn(row.plant_timezone),
  });
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as InstrumentDto["type"],
    plantId: row.plant_id,
    areaId: row.area_id,
    method: row.method,
    tolerance: row.tolerance,
    intervalMonths: row.interval_months,
    lastCalibrated: row.last_calibrated,
    nextDue: row.next_due,
    lastResult: row.last_result as CalibrationResult | null,
    owner: row.owner,
    status: row.status as InstrumentDto["status"],
    dueStatus,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toCalibrationEventDto(row: CalibrationEventRow): CalibrationEventDto {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    performedAt: row.performed_at,
    result: row.result as CalibrationResult,
    performedBy: row.performed_by,
    notes: row.notes,
    certificateFileId: row.certificate_file_id,
    ncrId: row.ncr_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Calibration instrument register (Sprint 05 C1-C6; P16). Reads need
 * `calibration:view`, writes `calibration:manage`. Due/overdue derivation is
 * `packages/core/calibration.ts` (rule 5); "today" is always computed in the
 * instrument's own PLANT timezone (§3.1 item 15), both here and in the SQL
 * CASE expression `list`/`summary` use for the same classification — the two
 * must agree at every boundary (DoD).
 *
 * Plant scope (§3.1 item 3): LIST/SUMMARY/EXPORT are a pure plant-membership
 * filter with NO owner exception; DETAIL and calibration-event HISTORY carry
 * the one owner-sees-own-instrument exception this sprint approves.
 */
@Injectable()
export class InstrumentsService {
  constructor(private readonly ncrs: NcrService) {}

  // --- scope helpers ---------------------------------------------------------

  /** LIST/SUMMARY/EXPORT: no owner exception, pure plant-overlap. */
  private inPlantScope(membership: Membership, plantId: string): boolean {
    if (!isPlantScoped(membership.role)) return true;
    if (membership.plantIds.length === 0) return true;
    return membership.plantIds.includes(plantId);
  }

  /** DETAIL/HISTORY: the one owner-sees-own-instrument exception (§3.1 item 3). */
  private assertDetailScope(membership: Membership, actorId: string, row: InstrumentRow): void {
    if (this.inPlantScope(membership, row.plant_id)) return;
    if (row.owner !== null && row.owner === actorId) return;
    throw notFound();
  }

  private async plantTimezone(tx: Tx, plantId: string): Promise<string> {
    const { rows } = await tx.query<{ timezone: string }>(
      "SELECT timezone FROM plants WHERE id = $1 AND deleted_at IS NULL",
      [plantId],
    );
    const tz = rows[0]?.timezone;
    if (tz === undefined) throw notFound();
    return tz;
  }

  private async tenantTimezone(tx: Tx, tenantId: string): Promise<string> {
    const { rows } = await tx.query<{ timezone: string }>(
      "SELECT timezone FROM control.tenants WHERE id = $1",
      [tenantId],
    );
    return rows[0]?.timezone ?? "UTC";
  }

  private async assertAreaBelongsToPlant(tx: Tx, areaId: string, plantId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM areas WHERE id = $1 AND plant_id = $2 AND deleted_at IS NULL",
      [areaId, plantId],
    );
    if (rows.length === 0) {
      throw new ApiError("VALIDATION_FAILED", "The area does not belong to the target plant");
    }
  }

  // --- list / summary ----------------------------------------------------

  async list(
    tx: Tx,
    membership: Membership,
    opts: {
      type?: string;
      status?: string;
      dueStatus?: "due_soon" | "overdue";
      plantId?: string;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<InstrumentDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;

    const params: unknown[] = [];
    let where = "WHERE i.deleted_at IS NULL";

    if (opts.type !== undefined) {
      params.push(opts.type);
      where += ` AND i.type = $${params.length}`;
    }
    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND i.status = $${params.length}`;
    }
    if (opts.plantId !== undefined) {
      params.push(opts.plantId);
      where += ` AND i.plant_id = $${params.length}`;
    }
    if (opts.q !== undefined) {
      params.push(`%${opts.q}%`);
      where += ` AND (i.name ILIKE $${params.length} OR i.code ILIKE $${params.length} OR a.name ILIKE $${params.length})`;
    }
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      where += ` AND i.plant_id = ANY($${params.length}::uuid[])`;
    }
    if (opts.dueStatus !== undefined) {
      const target = opts.dueStatus === "due_soon" ? "warn" : "overdue";
      params.push(target);
      where += ` AND (${DUE_STATUS_CASE}) = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<InstrumentRow>(
      `SELECT ${INSTRUMENT_COLUMNS} FROM instruments i
         JOIN plants p ON p.id = i.plant_id
         LEFT JOIN areas a ON a.id = i.area_id
        ${where} ${keyset.sql}
        ORDER BY i.created_at DESC, i.id DESC
        LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toInstrumentDto);
  }

  async summary(tx: Tx, tenantId: string, membership: Membership): Promise<InstrumentSummaryDto> {
    const params: unknown[] = [];
    let where = "WHERE i.deleted_at IS NULL";
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      where += ` AND i.plant_id = ANY($${params.length}::uuid[])`;
    }

    const { rows } = await tx.query<{ status: string; due_status: string }>(
      `SELECT i.status, (${DUE_STATUS_CASE}) AS due_status
         FROM instruments i JOIN plants p ON p.id = i.plant_id ${where}`,
      params,
    );

    let instrumentsTracked = 0;
    let dueSoon = 0;
    let overdue = 0;
    for (const r of rows) {
      if (r.status !== "active") continue;
      instrumentsTracked += 1;
      if (r.due_status === "warn") dueSoon += 1;
      if (r.due_status === "overdue") overdue += 1;
    }

    const tz = await this.tenantTimezone(tx, tenantId);
    const year = counterYear(new Date(), tz);
    const eventParams: unknown[] = [year];
    let eventWhere = `WHERE ce.result IN ('adjusted','fail') AND ce.deleted_at IS NULL
      AND EXTRACT(YEAR FROM ce.performed_at) = $1`;
    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      eventParams.push(membership.plantIds);
      eventWhere += ` AND i.plant_id = ANY($${eventParams.length}::uuid[])`;
    }
    const { rows: yearRows } = await tx.query<{ n: string; with_ncr: string }>(
      `SELECT count(*)::text AS n, count(*) FILTER (WHERE ce.ncr_id IS NOT NULL)::text AS with_ncr
         FROM calibration_events ce JOIN instruments i ON i.id = ce.instrument_id AND i.deleted_at IS NULL
         ${eventWhere}`,
      eventParams,
    );
    const outOfToleranceFindingsYtd = Number(yearRows[0]?.n ?? 0);
    const outOfToleranceLedToNcrYtd = Number(yearRows[0]?.with_ncr ?? 0);

    return { instrumentsTracked, dueSoon, overdue, outOfToleranceFindingsYtd, outOfToleranceLedToNcrYtd };
  }

  // --- single-instrument reads --------------------------------------------

  private async loadRow(tx: Tx, id: string): Promise<InstrumentRow> {
    const { rows } = await tx.query<InstrumentRow>(
      `SELECT ${INSTRUMENT_COLUMNS} FROM instruments i JOIN plants p ON p.id = i.plant_id
        WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async get(tx: Tx, membership: Membership, actorId: string, id: string): Promise<InstrumentDto> {
    const row = await this.loadRow(tx, id);
    this.assertDetailScope(membership, actorId, row);
    return toInstrumentDto(row);
  }

  // --- create / update / retire -------------------------------------------

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateInstrumentBody,
    ctx: AuditContext,
  ): Promise<InstrumentDto> {
    const { rows: plantRows } = await tx.query("SELECT 1 FROM plants WHERE id = $1 AND deleted_at IS NULL", [
      body.plantId,
    ]);
    if (plantRows.length === 0) throw notFound();
    if (body.areaId != null) await this.assertAreaBelongsToPlant(tx, body.areaId, body.plantId);

    const now = new Date();
    const tz = await this.plantTimezone(tx, body.plantId);
    const year = counterYear(now, tz);
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "instrument",
        entityId: id,
        action: "created",
        after: { name: body.name, type: body.type, plantId: body.plantId },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'instrument', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an instrument code");

        await t.query(
          `INSERT INTO instruments
             (id, tenant_id, code, name, type, plant_id, area_id, method, tolerance, interval_months,
              owner, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
          [
            id,
            tenantId,
            formatCode("instrument", year, seq),
            body.name,
            body.type,
            body.plantId,
            body.areaId ?? null,
            body.method,
            body.tolerance,
            body.intervalMonths,
            body.owner ?? null,
            actorId,
          ],
        );
        return toInstrumentDto(await this.loadRow(t, id));
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: UpdateInstrumentBody,
    ctx: AuditContext,
  ): Promise<InstrumentDto> {
    const current = await this.loadRow(tx, id);
    this.assertDetailScope(membership, actorId, current);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "instruments",
        key: id,
        message: "This instrument changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    if (current.status === "retired") {
      throw new ApiError("VALIDATION_FAILED", "A retired instrument cannot be edited");
    }

    const targetPlantId = body.plantId ?? current.plant_id;
    if (body.plantId !== undefined) {
      const { rows: plantRows } = await tx.query("SELECT 1 FROM plants WHERE id = $1 AND deleted_at IS NULL", [
        body.plantId,
      ]);
      if (plantRows.length === 0) throw notFound();
    }

    // Transfer consistency (C4 AC2): when both plantId/areaId are present,
    // the target area must belong to the target plant. When only plantId
    // changes and the current area no longer belongs to it, clear the area.
    // `resolvedAreaId` is ALWAYS a concrete final value (never left
    // `undefined`) — nullable+optional fields need real tri-state handling
    // (unset / explicit-null-to-clear / set), which a `COALESCE($n, col)` SQL
    // pattern cannot express (it cannot tell "clear it" from "don't touch it").
    let resolvedAreaId: string | null;
    if (body.areaId !== undefined) {
      if (body.areaId !== null) await this.assertAreaBelongsToPlant(tx, body.areaId, targetPlantId);
      resolvedAreaId = body.areaId;
    } else if (body.plantId !== undefined && current.area_id !== null) {
      const { rows } = await tx.query(
        "SELECT 1 FROM areas WHERE id = $1 AND plant_id = $2 AND deleted_at IS NULL",
        [current.area_id, targetPlantId],
      );
      resolvedAreaId = rows.length === 0 ? null : current.area_id;
    } else {
      resolvedAreaId = current.area_id;
    }

    // Same tri-state reasoning as `resolvedAreaId` above.
    const resolvedOwner: string | null = body.owner !== undefined ? body.owner : current.owner;
    if (body.owner !== undefined && body.owner !== null) {
      const { rows } = await tx.query(
        "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
        [body.owner],
      );
      if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "instrument",
        entityId: id,
        action: "updated",
        before: { plantId: current.plant_id, areaId: current.area_id },
        after: { plantId: targetPlantId, areaId: resolvedAreaId },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<{ id: string }>(
          `UPDATE instruments SET
             name = COALESCE($3, name), type = COALESCE($4, type), plant_id = $5,
             area_id = $6,
             method = COALESCE($7, method), tolerance = COALESCE($8, tolerance),
             interval_months = COALESCE($9, interval_months), owner = $10,
             updated_by = $11
           WHERE id = $1 AND lock_version = $2
           RETURNING id`,
          [
            id,
            body.lockVersion,
            body.name ?? null,
            body.type ?? null,
            targetPlantId,
            resolvedAreaId,
            body.method ?? null,
            body.tolerance ?? null,
            body.intervalMonths ?? null,
            resolvedOwner,
            actorId,
          ],
        );
        if (rows.length === 0) {
          throw await staleWriteError(t, {
            table: "instruments",
            key: id,
            message: "This instrument changed since you loaded it",
            expected: body.lockVersion,
            actual: current.lock_version,
          });
        }
        return toInstrumentDto(await this.loadRow(t, id));
      },
    );
  }

  async retire(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: RetireInstrumentBody,
    ctx: AuditContext,
  ): Promise<InstrumentDto> {
    const current = await this.loadRow(tx, id);
    this.assertDetailScope(membership, actorId, current);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "instruments",
        key: id,
        message: "This instrument changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    if (current.status === "retired") {
      throw new ApiError("VALIDATION_FAILED", "This instrument is already retired");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "instrument",
        entityId: id,
        action: "status_changed",
        before: { status: current.status },
        after: { status: "retired" },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<{ id: string }>(
          `UPDATE instruments SET status = 'retired', updated_by = $3
            WHERE id = $1 AND lock_version = $2 RETURNING id`,
          [id, body.lockVersion, actorId],
        );
        if (rows.length === 0) {
          throw await staleWriteError(t, {
            table: "instruments",
            key: id,
            message: "This instrument changed since you loaded it",
          });
        }
        return toInstrumentDto(await this.loadRow(t, id));
      },
    );
  }

  // --- calibration events --------------------------------------------------

  async listCalibrationEvents(
    tx: Tx,
    membership: Membership,
    actorId: string,
    instrumentId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<CalibrationEventDto>> {
    const instrument = await this.loadRow(tx, instrumentId);
    this.assertDetailScope(membership, actorId, instrument);

    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [instrumentId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<CalibrationEventRow>(
      `SELECT ${CALIBRATION_EVENT_COLUMNS} FROM calibration_events
        WHERE instrument_id = $1 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toCalibrationEventDto);
  }

  /**
   * "Newest event" by the exact tie-break (§3.1 item 14): ordered by
   * `(performed_at DESC, created_at DESC)`.
   */
  private async loadNewestEvent(tx: Tx, instrumentId: string): Promise<CalibrationEventRow | null> {
    const { rows } = await tx.query<CalibrationEventRow>(
      `SELECT ${CALIBRATION_EVENT_COLUMNS} FROM calibration_events
        WHERE instrument_id = $1 AND deleted_at IS NULL
        ORDER BY performed_at DESC, created_at DESC LIMIT 1`,
      [instrumentId],
    );
    return rows[0] ?? null;
  }

  async recordCalibrationEvent(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    instrumentId: string,
    body: CreateCalibrationEventBody,
    ctx: AuditContext,
  ): Promise<CalibrationEventDto> {
    // Lock the parent row first (concurrency note, §3.1 item 14) — this also
    // serialises concurrent recordings against the same instrument.
    const { rows: locked } = await tx.query<InstrumentRow>(
      `SELECT ${INSTRUMENT_COLUMNS} FROM instruments i JOIN plants p ON p.id = i.plant_id
        WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE OF i`,
      [instrumentId],
    );
    const instrument = locked[0];
    if (instrument === undefined) throw notFound();
    this.assertDetailScope(membership, actorId, instrument);
    if (instrument.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "instruments",
        key: instrumentId,
        message: "This instrument changed since you loaded it",
        expected: body.lockVersion,
        actual: instrument.lock_version,
      });
    }
    if (instrument.status === "retired") {
      throw new ApiError("VALIDATION_FAILED", "A retired instrument cannot have a new calibration event recorded");
    }
    if (body.performedAt > todayIn(instrument.plant_timezone)) {
      throw new ApiError("VALIDATION_FAILED", "performedAt cannot be in the future");
    }

    let certificateFileId: string | null = null;
    if (body.certificateFileId != null) {
      certificateFileId = await this.verifyLinkableFile(tx, body.certificateFileId, "calibration_event");
    }

    const currentNewest = await this.loadNewestEvent(tx, instrumentId);
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      // Placeholder — real events (incl. the conditional parent update) are
      // computed inside the mutation once we know the inserted row's created_at.
      [
        {
          actorId,
          actorKind: "user",
          entityKind: "calibration_event",
          entityId: id,
          action: "created",
          after: { performedAt: body.performedAt, result: body.result },
          requestId: ctx.requestId,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      ],
      async (t) => {
        const { rows: inserted } = await t.query<CalibrationEventRow>(
          `INSERT INTO calibration_events
             (id, tenant_id, instrument_id, performed_at, result, performed_by, notes,
              certificate_file_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
           RETURNING ${CALIBRATION_EVENT_COLUMNS}`,
          [
            id,
            tenantId,
            instrumentId,
            body.performedAt,
            body.result,
            body.performedBy,
            body.notes,
            certificateFileId,
            actorId,
          ],
        );
        const event = inserted[0];
        if (event === undefined) throw new ApiError("INTERNAL", "Calibration event was not created");

        const isNewest =
          currentNewest === null ||
          event.performed_at > currentNewest.performed_at ||
          (event.performed_at === currentNewest.performed_at && event.created_at > currentNewest.created_at);

        if (isNewest) {
          const advancesDueDate = body.result === "pass" || body.result === "adjusted";
          const { rows: updated } = await t.query<{ id: string }>(
            `UPDATE instruments SET
               last_result = $3,
               last_calibrated = CASE WHEN $4 THEN $5::date ELSE last_calibrated END,
               updated_by = $6
             WHERE id = $1 AND lock_version = $2
             RETURNING id`,
            [instrumentId, body.lockVersion, body.result, advancesDueDate, body.performedAt, actorId],
          );
          if (updated.length === 0) {
            throw await staleWriteError(t, {
              table: "instruments",
              key: instrumentId,
              message: "This instrument changed since you loaded it",
              expected: body.lockVersion,
              actual: instrument.lock_version,
            });
          }
          if (advancesDueDate) {
            // Only pass/adjusted-and-newest gets a separate parent audit
            // (BLOCKING 3(c)) — a fail's last_result write is an unaudited
            // denormalized mirror of the event's own already-audited result.
            await withAudit(
              t,
              tenantId,
              {
                actorId,
                actorKind: "user",
                entityKind: "instrument",
                entityId: instrumentId,
                action: "updated",
                before: { lastCalibrated: instrument.last_calibrated, nextDue: instrument.next_due },
                after: { lastCalibrated: body.performedAt },
                requestId: ctx.requestId,
                ip: ctx.ip,
                userAgent: ctx.userAgent,
              },
              () => Promise.resolve(),
            );
          }
        }

        return toCalibrationEventDto(event);
      },
    );
  }

  /** Verifies a file is linkable as a certificate/evidence (§3.1 item 16). */
  private async verifyLinkableFile(tx: Tx, fileId: string, expectedEntityKind: string): Promise<string> {
    const { rows } = await tx.query<{ id: string; sha256: string | null; entity_kind: string | null; deleted_at: Date | null }>(
      "SELECT id, sha256, entity_kind, deleted_at FROM files WHERE id = $1",
      [fileId],
    );
    const file = rows[0];
    if (file === undefined) throw notFound();
    if (file.deleted_at !== null) throw new ApiError("VALIDATION_FAILED", "That file has been deleted");
    if (file.sha256 === null) {
      throw new ApiError("VALIDATION_FAILED", "That file has not finished uploading");
    }
    if (file.entity_kind !== expectedEntityKind) {
      throw new ApiError("VALIDATION_FAILED", "That file was not uploaded for this purpose");
    }
    return file.id;
  }

  async attachCertificate(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    instrumentId: string,
    eventId: string,
    body: AttachCertificateBody,
    ctx: AuditContext,
  ): Promise<CalibrationEventDto> {
    const instrument = await this.loadRow(tx, instrumentId);
    this.assertDetailScope(membership, actorId, instrument);

    const { rows } = await tx.query<CalibrationEventRow>(
      `SELECT ${CALIBRATION_EVENT_COLUMNS} FROM calibration_events
        WHERE id = $1 AND instrument_id = $2 AND deleted_at IS NULL`,
      [eventId, instrumentId],
    );
    const event = rows[0];
    if (event === undefined) throw notFound();

    const fileId = await this.verifyLinkableFile(tx, body.fileId, "calibration_event");

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "calibration_event",
        entityId: eventId,
        action: "updated",
        before: { certificateFileId: event.certificate_file_id },
        after: { certificateFileId: fileId },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<CalibrationEventRow>(
          `UPDATE calibration_events SET certificate_file_id = $3, updated_by = $4
            WHERE id = $1 AND instrument_id = $2 RETURNING ${CALIBRATION_EVENT_COLUMNS}`,
          [eventId, instrumentId, fileId, actorId],
        );
        const row = updated[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Certificate was not attached");
        return toCalibrationEventDto(row);
      },
    );
  }

  async raiseNcr(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    instrumentId: string,
    eventId: string,
    ctx: AuditContext,
  ): Promise<NcrDto> {
    const instrument = await this.loadRow(tx, instrumentId);
    this.assertDetailScope(membership, actorId, instrument);
    const { rows } = await tx.query<CalibrationEventRow>(
      `SELECT ${CALIBRATION_EVENT_COLUMNS} FROM calibration_events
        WHERE id = $1 AND instrument_id = $2 AND deleted_at IS NULL`,
      [eventId, instrumentId],
    );
    const event = rows[0];
    if (event === undefined) throw notFound();
    if (event.result === "pass") {
      throw new ApiError("VALIDATION_FAILED", "Only an out-of-tolerance event can raise an NCR");
    }
    if (event.ncr_id !== null) throw new ApiError("CONFLICT", "That event already has an NCR");

    // Redundant-but-harmless defense in depth (§0 smaller correction) — every
    // role holding calibration:manage already holds ncr:create.
    const decision = authorize(membership, "ncr:create");
    if (!decision.ok) throw ApiError.from(decision);

    const priority: NcrPriority = event.result === "fail" ? "critical" : "major";
    const ncr = await this.ncrs.create(
      tx,
      tenantId,
      membership,
      actorId,
      {
        title: `NCR from calibration event — ${instrument.code} (${event.result})`,
        priority,
        source: "calibration",
        sourceId: event.id,
        plantId: instrument.plant_id,
      },
      ctx,
    );

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "calibration_event",
        entityId: eventId,
        action: "updated",
        before: { ncrId: null },
        after: { ncrId: ncr.id },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const linked = await t.query(
          "UPDATE calibration_events SET ncr_id = $1, updated_by = $3 WHERE id = $2 AND ncr_id IS NULL",
          [ncr.id, eventId, actorId],
        );
        if (linked.rowCount === 0) throw new ApiError("CONFLICT", "That event was just linked to another NCR");
      },
    );
    return ncr;
  }
}

/** SQL mirror of `instrumentDueStatus` (packages/core/calibration.ts), used
 *  only where filtering/aggregation must happen before LIMIT — the DoD's own
 *  "SQL and core function agree at every boundary" test covers both. */
const DUE_STATUS_CASE = `CASE
  WHEN i.last_result = 'fail' THEN 'overdue'
  WHEN i.next_due IS NULL THEN 'unscheduled'
  WHEN i.next_due < (now() AT TIME ZONE p.timezone)::date THEN 'overdue'
  WHEN i.next_due <= (now() AT TIME ZONE p.timezone)::date + 30 THEN 'warn'
  ELSE 'ok'
END`;
