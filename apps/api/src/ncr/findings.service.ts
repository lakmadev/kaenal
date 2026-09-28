import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { isPlantScoped, type Membership } from "@kaenal/core";
import type { CreateFindingBody, FindingDto, Page } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import type { AuditContext } from "./audit-context.js";

interface FindingRow {
  id: string;
  inspection_id: string;
  item_ref: string;
  severity: string;
  description: string;
  ncr_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = "id, inspection_id, item_ref, severity, description, ncr_id, created_at, updated_at";

function toDto(row: FindingRow): FindingDto {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    itemRef: row.item_ref,
    severity: row.severity as FindingDto["severity"],
    description: row.description,
    ncrId: row.ncr_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Findings (02 §4) — the observations an inspection produces, and the seam
 * between inspection and NCR: a finding is what an NCR is raised FROM. Access
 * is gated on the parent inspection's plant scope, so an inspector who cannot
 * see an inspection cannot see or add its findings either (404, rule 8).
 */
@Injectable()
export class FindingsService {
  async list(
    tx: Tx,
    membership: Membership,
    inspectionId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<FindingDto>> {
    await this.assertInspectionInScope(tx, membership, inspectionId);

    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [inspectionId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<FindingRow>(
      `SELECT ${COLUMNS} FROM findings
        WHERE inspection_id = $1 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }

  async create(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    inspectionId: string,
    body: CreateFindingBody,
    context: AuditContext,
  ): Promise<FindingDto> {
    await this.assertInspectionInScope(tx, membership, inspectionId);

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      [
        {
          actorId,
          actorKind: "user",
          entityKind: "finding",
          entityId: id,
          action: "created",
          after: { inspectionId, severity: body.severity, itemRef: body.itemRef },
          requestId: context.requestId,
          ip: context.ip,
          userAgent: context.userAgent,
        },
        // Sprint 03 G1 AC4 — a finding's inspection is known at creation, so
        // the inspection->finding graph edge is written here, in the same
        // transaction. (The finding->ncr edge, when one gets raised from this
        // finding, is written separately at ncr.service.ts's raise-from-
        // finding transaction, per the architecture review's correction #1.)
        {
          actorId,
          actorKind: "user",
          entityKind: "inspection",
          entityId: inspectionId,
          action: "linked",
          after: { toKind: "finding", toId: id, relation: "linked" },
          requestId: context.requestId,
          ip: context.ip,
          userAgent: context.userAgent,
        },
      ],
      async (t) => {
        const { rows } = await t.query<FindingRow>(
          `INSERT INTO findings (id, tenant_id, inspection_id, item_ref, severity, description, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
           RETURNING ${COLUMNS}`,
          [id, tenantId, inspectionId, body.itemRef, body.severity, body.description, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Finding was not created");

        await t.query(
          `INSERT INTO entity_links
             (id, tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by, updated_by)
           VALUES ($1,$2,'inspection',$3,'finding',$4,'linked',$5,$5)
           ON CONFLICT (tenant_id, from_kind, from_id, to_kind, to_id, relation)
             WHERE deleted_at IS NULL DO NOTHING`,
          [randomUUID(), tenantId, inspectionId, id, actorId],
        );

        return toDto(row);
      },
    );
  }

  private async assertInspectionInScope(
    tx: Tx,
    membership: Membership,
    inspectionId: string,
  ): Promise<void> {
    const { rows } = await tx.query<{ plant_id: string | null }>(
      "SELECT plant_id FROM inspections WHERE id = $1 AND deleted_at IS NULL",
      [inspectionId],
    );
    const inspection = rows[0];
    if (inspection === undefined) throw notFound();

    if (!isPlantScoped(membership.role)) return;
    if (membership.plantIds.length === 0) return;
    if (inspection.plant_id !== null && membership.plantIds.includes(inspection.plant_id)) return;
    throw notFound();
  }
}
