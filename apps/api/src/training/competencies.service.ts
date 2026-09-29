import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import type {
  ArchiveCompetencyBody,
  CompetencyDto,
  CompetencyListQuery,
  CreateCompetencyBody,
  Page,
  ReorderCompetenciesBody,
  ReorderCompetenciesResult,
  UnarchiveCompetencyBody,
  UpdateCompetencyBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { staleWriteError } from "../stale-write.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";

interface CompetencyRow {
  id: string;
  code: string;
  name: string;
  mandatory: boolean;
  valid_months: number | null;
  seq: number;
  archived_at: Date | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
  training_record_count: string;
}

const COMPETENCY_COLUMNS = `c.id, c.code, c.name, c.mandatory, c.valid_months, c.seq, c.archived_at,
  c.lock_version, c.created_at, c.updated_at,
  (SELECT count(DISTINCT tr.member_id) FROM training_records tr
     WHERE tr.competency_id = c.id AND tr.deleted_at IS NULL)::text AS training_record_count`;

function toCompetencyDto(row: CompetencyRow): CompetencyDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    mandatory: row.mandatory,
    validMonths: row.valid_months,
    seq: row.seq,
    archivedAt: row.archived_at === null ? null : row.archived_at.toISOString(),
    trainingRecordCount: Number(row.training_record_count),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Tenant-owned competency catalog (Sprint 05 T1 AC1/AC3, T5). Reads need
 * `training:view`, writes `training:manage`. Archival uses a dedicated
 * `archived_at` column, never the generic `deleted_at` soft-delete pattern
 * (§3.1 item 17) — every historical `training_records` row against an
 * archived competency stays fully readable (T1 AC9).
 */
@Injectable()
export class CompetenciesService {
  async list(tx: Tx, opts: Pick<CompetencyListQuery, "status" | "cursor" | "limit">): Promise<Page<CompetencyDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE c.deleted_at IS NULL";
    if (opts.status === "archived") where += " AND c.archived_at IS NOT NULL";
    else where += " AND c.archived_at IS NULL";

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<CompetencyRow>(
      `SELECT ${COMPETENCY_COLUMNS} FROM competencies c ${where} ${keyset.sql}
        ORDER BY c.created_at DESC, c.id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toCompetencyDto);
  }

  private async loadRow(tx: Tx, id: string): Promise<CompetencyRow> {
    const { rows } = await tx.query<CompetencyRow>(
      `SELECT ${COMPETENCY_COLUMNS} FROM competencies c WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async get(tx: Tx, id: string): Promise<CompetencyDto> {
    return toCompetencyDto(await this.loadRow(tx, id));
  }

  private async assertCodeFree(tx: Tx, tenantId: string, code: string, excludeId?: string): Promise<void> {
    const { rows } = await tx.query(
      `SELECT 1 FROM competencies WHERE tenant_id = $1 AND code = $2 AND archived_at IS NULL
         AND deleted_at IS NULL ${excludeId !== undefined ? "AND id <> $3" : ""}`,
      excludeId !== undefined ? [tenantId, code, excludeId] : [tenantId, code],
    );
    if (rows.length > 0) throw new ApiError("CONFLICT", "A non-archived competency already uses that code");
  }

  private async nextSeq(tx: Tx, tenantId: string): Promise<number> {
    const { rows } = await tx.query<{ max: number | null }>(
      "SELECT max(seq) AS max FROM competencies WHERE tenant_id = $1 AND archived_at IS NULL AND deleted_at IS NULL",
      [tenantId],
    );
    return (rows[0]?.max ?? 0) + 1;
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateCompetencyBody,
    ctx: AuditContext,
  ): Promise<CompetencyDto> {
    await this.assertCodeFree(tx, tenantId, body.code);
    const seq = await this.nextSeq(tx, tenantId);
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "competency",
        entityId: id,
        action: "created",
        after: { code: body.code, name: body.name, mandatory: body.mandatory },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        await t.query(
          `INSERT INTO competencies
             (id, tenant_id, code, name, mandatory, valid_months, seq, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
          [id, tenantId, body.code, body.name, body.mandatory, body.validMonths ?? null, seq, actorId],
        );
        return toCompetencyDto(await this.loadRow(t, id));
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateCompetencyBody,
    ctx: AuditContext,
  ): Promise<CompetencyDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "competencies",
        key: id,
        message: "This competency changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    if (body.code !== undefined && body.code !== current.code) {
      await this.assertCodeFree(tx, tenantId, body.code, id);
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "competency",
        entityId: id,
        action: "updated",
        before: { code: current.code, name: current.name, mandatory: current.mandatory },
        after: { code: body.code ?? current.code, name: body.name ?? current.name, mandatory: body.mandatory ?? current.mandatory },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<{ id: string }>(
          `UPDATE competencies SET
             code = COALESCE($3, code), name = COALESCE($4, name), mandatory = COALESCE($5, mandatory),
             valid_months = CASE WHEN $6 THEN $7 ELSE valid_months END,
             updated_by = $8
           WHERE id = $1 AND lock_version = $2 RETURNING id`,
          [
            id,
            body.lockVersion,
            body.code ?? null,
            body.name ?? null,
            body.mandatory ?? null,
            body.validMonths !== undefined,
            body.validMonths ?? null,
            actorId,
          ],
        );
        if (rows.length === 0) {
          throw await staleWriteError(t, {
            table: "competencies",
            key: id,
            message: "This competency changed since you loaded it",
          });
        }
        return toCompetencyDto(await this.loadRow(t, id));
      },
    );
  }

  async archive(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: ArchiveCompetencyBody,
    ctx: AuditContext,
  ): Promise<CompetencyDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "competencies",
        key: id,
        message: "This competency changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    if (current.archived_at !== null) {
      throw new ApiError("VALIDATION_FAILED", "This competency is already archived");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "competency",
        entityId: id,
        action: "status_changed",
        before: { archivedAt: null },
        after: { archivedAt: "now" },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<{ id: string }>(
          `UPDATE competencies SET archived_at = now(), updated_by = $3
            WHERE id = $1 AND lock_version = $2 RETURNING id`,
          [id, body.lockVersion, actorId],
        );
        if (rows.length === 0) {
          throw await staleWriteError(t, { table: "competencies", key: id, message: "This competency changed since you loaded it" });
        }
        return toCompetencyDto(await this.loadRow(t, id));
      },
    );
  }

  async unarchive(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UnarchiveCompetencyBody,
    ctx: AuditContext,
  ): Promise<CompetencyDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "competencies",
        key: id,
        message: "This competency changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    if (current.archived_at === null) {
      throw new ApiError("VALIDATION_FAILED", "This competency is not archived");
    }
    await this.assertCodeFree(tx, tenantId, current.code, id);
    const seq = await this.nextSeq(tx, tenantId);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "competency",
        entityId: id,
        action: "status_changed",
        before: { archivedAt: current.archived_at.toISOString() },
        after: { archivedAt: null, seq },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<{ id: string }>(
          `UPDATE competencies SET archived_at = NULL, seq = $3, updated_by = $4
            WHERE id = $1 AND lock_version = $2 RETURNING id`,
          [id, body.lockVersion, seq, actorId],
        );
        if (rows.length === 0) {
          throw await staleWriteError(t, { table: "competencies", key: id, message: "This competency changed since you loaded it" });
        }
        return toCompetencyDto(await this.loadRow(t, id));
      },
    );
  }

  /**
   * Atomic reorder (T5 AC3): the body's id set must exactly match the current
   * non-archived set (409 otherwise — count AND distinctness), and the write
   * itself is one statement, never N sequential per-row updates.
   */
  async reorder(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: ReorderCompetenciesBody,
    ctx: AuditContext,
  ): Promise<ReorderCompetenciesResult> {
    const { rows: current } = await tx.query<{ id: string }>(
      "SELECT id FROM competencies WHERE tenant_id = $1 AND archived_at IS NULL AND deleted_at IS NULL",
      [tenantId],
    );
    const currentSet = new Set(current.map((r) => r.id));
    const bodySet = new Set(body.ids);
    const matches = currentSet.size === bodySet.size && [...currentSet].every((id) => bodySet.has(id));
    if (!matches) {
      throw new ApiError("CONFLICT", "The competency set changed since you loaded the catalog");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "competency",
        entityId: tenantId,
        action: "updated",
        after: { reorder: body.ids },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        await t.query(
          `UPDATE competencies AS c SET seq = v.ord, updated_by = $2
             FROM (SELECT unnest($1::uuid[]) AS id, unnest($3::int[]) AS ord) AS v
            WHERE c.id = v.id AND c.tenant_id = $4`,
          [body.ids, actorId, body.ids.map((_, i) => i), tenantId],
        );
        const { rows } = await t.query<CompetencyRow>(
          `SELECT ${COMPETENCY_COLUMNS} FROM competencies c
            WHERE c.tenant_id = $1 AND c.archived_at IS NULL AND c.deleted_at IS NULL
            ORDER BY c.seq ASC, c.id ASC`,
          [tenantId],
        );
        return { items: rows.map(toCompetencyDto) };
      },
    );
  }
}
