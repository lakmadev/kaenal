import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { actionPriority, rpn } from "@kaenal/core";
import type {
  CreateFmeaBody,
  CreateFmeaItemBody,
  FmeaDto,
  FmeaItemDto,
  Page,
  UpdateFmeaBody,
  UpdateFmeaItemBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface FmeaRow {
  id: string;
  fmea_type: string;
  part_code: string;
  part_name: string;
  revision: number;
  item_count?: number | string;
  lock_version: number;
}

interface ItemRow {
  id: string;
  fmea_id: string;
  seq: number;
  process_function: string;
  failure_mode: string;
  effect: string;
  severity: number;
  cause: string;
  occurrence: number;
  prevention_control: string;
  detection_control: string;
  detection: number;
  recommended_action: string;
  lock_version: number;
}

const FMEA_COLS = "id, fmea_type, part_code, part_name, revision, lock_version";
const ITEM_COLS =
  "id, fmea_id, seq, process_function, failure_mode, effect, severity, cause, occurrence, prevention_control, detection_control, detection, recommended_action, lock_version";

function toFmeaDto(row: FmeaRow): FmeaDto {
  return {
    id: row.id,
    type: row.fmea_type as FmeaDto["type"],
    partCode: row.part_code,
    partName: row.part_name,
    revision: row.revision,
    itemCount: Number(row.item_count ?? 0),
    lockVersion: row.lock_version,
  };
}

function toItemDto(row: ItemRow): FmeaItemDto {
  return {
    id: row.id,
    fmeaId: row.fmea_id,
    seq: row.seq,
    processFunction: row.process_function,
    failureMode: row.failure_mode,
    effect: row.effect,
    severity: row.severity,
    cause: row.cause,
    occurrence: row.occurrence,
    preventionControl: row.prevention_control,
    detectionControl: row.detection_control,
    detection: row.detection,
    recommendedAction: row.recommended_action,
    rpn: rpn(row.severity, row.occurrence, row.detection),
    actionPriority: actionPriority(row.severity, row.occurrence, row.detection),
    lockVersion: row.lock_version,
  };
}

/**
 * FMEA workbench (04 §FMEA; tables 0030). An FMEA is a per-part worksheet; its
 * items are failure modes whose RPN (S×O×D) and Action Priority are DERIVED from
 * `@kaenal/core` on read, so a rating edit always re-scores (rule 5). Reads need
 * `fmea:view`, writes `fmea:manage`; every change is audited in the same
 * transaction (rule 3) and edits are optimistic (rule 6).
 */
@Injectable()
export class FmeaService {
  // --- FMEA header ---------------------------------------------------------
  async list(tx: Tx): Promise<Page<FmeaDto>> {
    const { rows } = await tx.query<FmeaRow>(
      `SELECT f.id, f.fmea_type, f.part_code, f.part_name, f.revision, f.lock_version,
              count(i.id) FILTER (WHERE i.deleted_at IS NULL) AS item_count
         FROM fmeas f
         LEFT JOIN fmea_items i ON i.tenant_id = f.tenant_id AND i.fmea_id = f.id
        WHERE f.deleted_at IS NULL
        GROUP BY f.id, f.fmea_type, f.part_code, f.part_name, f.revision, f.lock_version
        ORDER BY f.created_at DESC, f.id DESC`,
    );
    return { items: rows.map(toFmeaDto), nextCursor: null };
  }

  private async loadFmea(tx: Tx, id: string): Promise<FmeaRow> {
    const { rows } = await tx.query<FmeaRow>(
      `SELECT ${FMEA_COLS} FROM fmeas WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async get(tx: Tx, id: string): Promise<FmeaDto> {
    const row = await this.loadFmea(tx, id);
    const { rows } = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM fmea_items WHERE fmea_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return toFmeaDto({ ...row, item_count: rows[0]?.n ?? 0 });
  }

  async create(tx: Tx, tenantId: string, actorId: string, body: CreateFmeaBody, ctx: AuditContext): Promise<FmeaDto> {
    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "created", "fmea", id, ctx, { after: { partCode: body.partCode, type: body.type } }),
      async (t) => {
        const { rows } = await t.query<FmeaRow>(
          `INSERT INTO fmeas (id, tenant_id, fmea_type, part_code, part_name, revision, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING ${FMEA_COLS}`,
          [id, tenantId, body.type, body.partCode, body.partName, body.revision, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "FMEA was not created");
        return toFmeaDto({ ...row, item_count: 0 });
      },
    );
  }

  async update(tx: Tx, tenantId: string, actorId: string, id: string, body: UpdateFmeaBody, ctx: AuditContext): Promise<FmeaDto> {
    const current = await this.loadFmea(tx, id);
    assertVersion(current.lock_version, body.version, "FMEA");
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", "fmea", id, ctx, { before: { partCode: current.part_code }, after: { partCode: body.partCode } }),
      async (t) => {
        const { rows } = await t.query<FmeaRow>(
          `UPDATE fmeas SET fmea_type=$3, part_code=$4, part_name=$5, revision=$6, updated_by=$7
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL RETURNING ${FMEA_COLS}`,
          [id, body.version, body.type, body.partCode, body.partName, body.revision, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw staleWrite("FMEA");
        return this.get(t, id);
      },
    );
  }

  async remove(tx: Tx, tenantId: string, actorId: string, id: string, ctx: AuditContext): Promise<FmeaDto> {
    const row = await this.loadFmea(tx, id);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "deleted", "fmea", id, ctx, { before: { partCode: row.part_code, deleted: false }, after: { deleted: true } }),
      async (t) => {
        // Cascade the soft delete to the worksheet rows.
        await t.query(`UPDATE fmea_items SET deleted_at = now(), updated_by = $2 WHERE fmea_id = $1 AND deleted_at IS NULL`, [id, actorId]);
        const { rows } = await t.query<FmeaRow>(
          `UPDATE fmeas SET deleted_at = now(), updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING ${FMEA_COLS}`,
          [id, actorId],
        );
        return toFmeaDto({ ...(rows[0] ?? row), item_count: 0 });
      },
    );
  }

  // --- Failure modes -------------------------------------------------------
  async listItems(tx: Tx, fmeaId: string): Promise<Page<FmeaItemDto>> {
    await this.loadFmea(tx, fmeaId); // 404 if the FMEA isn't visible/real
    const { rows } = await tx.query<ItemRow>(
      `SELECT ${ITEM_COLS} FROM fmea_items WHERE fmea_id = $1 AND deleted_at IS NULL
        ORDER BY seq ASC, created_at ASC, id ASC`,
      [fmeaId],
    );
    return { items: rows.map(toItemDto), nextCursor: null };
  }

  private async loadItem(tx: Tx, fmeaId: string, itemId: string): Promise<ItemRow> {
    const { rows } = await tx.query<ItemRow>(
      `SELECT ${ITEM_COLS} FROM fmea_items WHERE id = $1 AND fmea_id = $2 AND deleted_at IS NULL`,
      [itemId, fmeaId],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async createItem(tx: Tx, tenantId: string, actorId: string, fmeaId: string, body: CreateFmeaItemBody, ctx: AuditContext): Promise<FmeaItemDto> {
    await this.loadFmea(tx, fmeaId);
    const id = randomUUID();
    const { rows: seqRows } = await tx.query<{ next: number }>(
      `SELECT COALESCE(max(seq), 0) + 1 AS next FROM fmea_items WHERE fmea_id = $1 AND deleted_at IS NULL`,
      [fmeaId],
    );
    const seq = seqRows[0]?.next ?? 1;
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "created", "fmea_item", id, ctx, { after: { fmeaId, failureMode: body.failureMode } }),
      async (t) => {
        const { rows } = await t.query<ItemRow>(
          `INSERT INTO fmea_items
             (id, tenant_id, fmea_id, seq, process_function, failure_mode, effect, severity, cause,
              occurrence, prevention_control, detection_control, detection, recommended_action, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING ${ITEM_COLS}`,
          [
            id, tenantId, fmeaId, seq, body.processFunction, body.failureMode, body.effect, body.severity, body.cause,
            body.occurrence, body.preventionControl, body.detectionControl, body.detection, body.recommendedAction, actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Failure mode was not created");
        return toItemDto(row);
      },
    );
  }

  async updateItem(tx: Tx, tenantId: string, actorId: string, fmeaId: string, itemId: string, body: UpdateFmeaItemBody, ctx: AuditContext): Promise<FmeaItemDto> {
    const current = await this.loadItem(tx, fmeaId, itemId);
    assertVersion(current.lock_version, body.version, "failure mode");
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", "fmea_item", itemId, ctx, {
        before: { severity: current.severity, occurrence: current.occurrence, detection: current.detection },
        after: { severity: body.severity, occurrence: body.occurrence, detection: body.detection },
      }),
      async (t) => {
        const { rows } = await t.query<ItemRow>(
          `UPDATE fmea_items SET process_function=$3, failure_mode=$4, effect=$5, severity=$6, cause=$7,
             occurrence=$8, prevention_control=$9, detection_control=$10, detection=$11, recommended_action=$12, updated_by=$13
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL RETURNING ${ITEM_COLS}`,
          [
            itemId, body.version, body.processFunction, body.failureMode, body.effect, body.severity, body.cause,
            body.occurrence, body.preventionControl, body.detectionControl, body.detection, body.recommendedAction, actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw staleWrite("failure mode");
        return toItemDto(row);
      },
    );
  }

  async removeItem(tx: Tx, tenantId: string, actorId: string, fmeaId: string, itemId: string, ctx: AuditContext): Promise<FmeaItemDto> {
    const row = await this.loadItem(tx, fmeaId, itemId);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "deleted", "fmea_item", itemId, ctx, { before: { failureMode: row.failure_mode, deleted: false }, after: { deleted: true } }),
      async (t) => {
        const { rows } = await t.query<ItemRow>(
          `UPDATE fmea_items SET deleted_at = now(), updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING ${ITEM_COLS}`,
          [itemId, actorId],
        );
        return toItemDto(rows[0] ?? row);
      },
    );
  }
}

function assertVersion(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new ApiError("STALE_WRITE", `This ${label} changed since you loaded it`, { expected, actual });
  }
}
function staleWrite(label: string): ApiError {
  return new ApiError("STALE_WRITE", `This ${label} changed since you loaded it`);
}
type AuditVerb = "created" | "updated" | "deleted";
function audit(
  actorId: string,
  action: AuditVerb,
  entityKind: string,
  entityId: string,
  ctx: AuditContext,
  data: { before?: Record<string, unknown>; after?: Record<string, unknown> },
) {
  return {
    actorId,
    actorKind: "user" as const,
    entityKind,
    entityId,
    action,
    ...(data.before !== undefined ? { before: data.before } : {}),
    ...(data.after !== undefined ? { after: data.after } : {}),
    requestId: ctx.requestId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}
