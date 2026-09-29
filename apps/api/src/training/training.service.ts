import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { authorize, competencyCellState, isPlantScoped, type CompetencyCellState, type Membership } from "@kaenal/core";
import type {
  CreateTrainingRecordBody,
  CreateTrainingRecordResult,
  Page,
  TrainingGapDto,
  TrainingMatrixCellDto,
  TrainingMatrixRowDto,
  TrainingRecordDto,
  TrainingSummaryDto,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";

interface MemberRow {
  id: string;
  user_id: string;
  title: string | null;
  plant_ids: string[];
  created_at: Date;
}

interface CompetencyRow {
  id: string;
  mandatory: boolean;
}

interface RecordRow {
  member_id: string;
  competency_id: string;
  completed_at: string;
  expires_at: string | null;
}

interface TrainingRecordRow {
  id: string;
  member_id: string;
  competency_id: string;
  completed_at: string;
  valid_months: number | null;
  expires_at: string | null;
  evidence_file_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const TRAINING_RECORD_COLUMNS = `id, member_id, competency_id, completed_at::text AS completed_at, valid_months,
  expires_at::text AS expires_at, evidence_file_id, created_at, updated_at`;

function toTrainingRecordDto(row: TrainingRecordRow): TrainingRecordDto {
  return {
    id: row.id,
    memberId: row.member_id,
    competencyId: row.competency_id,
    completedAt: row.completed_at,
    validMonths: row.valid_months,
    expiresAt: row.expires_at,
    evidenceFileId: row.evidence_file_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** `now()` as YYYY-MM-DD in the given IANA timezone. */
function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  );
}

/**
 * Training & competency matrix + records (Sprint 05 T1-T4; P17). Reads need
 * `training:view`, writes `training:manage`. Cell-state derivation is
 * `packages/core/competency.ts` (rule 5); "today" is always the TENANT's own
 * timezone (§3.1 item 15). Matrix visibility follows the symmetric plant
 * overlap rule (§3.1 item 3 / T1 UC), not `GET /v1/members`'s (non-existent)
 * plant filter.
 */
@Injectable()
export class TrainingService {
  private async tenantTimezone(tx: Tx, tenantId: string): Promise<string> {
    const { rows } = await tx.query<{ timezone: string }>("SELECT timezone FROM control.tenants WHERE id = $1", [
      tenantId,
    ]);
    return rows[0]?.timezone ?? "UTC";
  }

  /** Members visible to this caller: active, non-partner, symmetric plant-overlap (§3.1 item 3). */
  private async visibleMembers(
    tx: Tx,
    membership: Membership,
    opts: { cursor?: string; limit: number; userIdFilter?: readonly string[] },
  ): Promise<{ rows: MemberRow[]; nextCursor: string | null }> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE status = 'active' AND role <> 'partner' AND deleted_at IS NULL";

    if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      where += ` AND (plant_ids = '{}' OR plant_ids && $${params.length}::uuid[])`;
    }
    if (opts.userIdFilter !== undefined) {
      params.push(opts.userIdFilter);
      where += ` AND user_id = ANY($${params.length}::uuid[])`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<MemberRow>(
      `SELECT id, user_id, title, plant_ids, created_at FROM memberships ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const last = visible[visible.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? Buffer.from(`${last.created_at.toISOString()}|${last.id}`, "utf8").toString("base64url")
        : null;
    return { rows: visible, nextCursor };
  }

  private async activeCompetencies(tx: Tx, tenantId: string): Promise<CompetencyRow[]> {
    const { rows } = await tx.query<CompetencyRow>(
      "SELECT id, mandatory FROM competencies WHERE tenant_id = $1 AND archived_at IS NULL AND deleted_at IS NULL",
      [tenantId],
    );
    return rows;
  }

  /** The newest record per (member, competency) pair, over non-archived competencies. */
  private async newestRecordsFor(
    tx: Tx,
    memberIds: readonly string[],
  ): Promise<Map<string, RecordRow>> {
    const out = new Map<string, RecordRow>();
    if (memberIds.length === 0) return out;
    const { rows } = await tx.query<RecordRow>(
      `SELECT DISTINCT ON (tr.member_id, tr.competency_id)
              tr.member_id, tr.competency_id, tr.completed_at::text AS completed_at, tr.expires_at::text AS expires_at
         FROM training_records tr
         JOIN competencies c ON c.id = tr.competency_id AND c.archived_at IS NULL AND c.deleted_at IS NULL
        WHERE tr.member_id = ANY($1::uuid[]) AND tr.deleted_at IS NULL
        ORDER BY tr.member_id, tr.competency_id, tr.completed_at DESC, tr.created_at DESC`,
      [memberIds],
    );
    for (const r of rows) out.set(`${r.member_id}:${r.competency_id}`, r);
    return out;
  }

  private async resolveUserIdsByName(tx: Tx, q: string): Promise<string[]> {
    // control.users is outside RLS; resolved on the request tx (readable, as
    // ncr.service.ts's own correlated subselects already prove) and only ever
    // intersected against this tenant's own memberships downstream, never
    // exposed on its own (rule 8's spirit — a name is only ever surfaced for a
    // confirmed member of this tenant).
    const { rows } = await tx.query<{ id: string }>("SELECT id FROM control.users WHERE name ILIKE $1", [`%${q}%`]);
    return rows.map((r) => r.id);
  }

  async matrix(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    opts: { mandatoryOnly?: boolean; gapsOnly?: boolean; q?: string; cursor?: string; limit: number },
  ): Promise<Page<TrainingMatrixRowDto>> {
    const userIdFilter = opts.q !== undefined ? await this.resolveUserIdsByName(tx, opts.q) : undefined;
    if (userIdFilter !== undefined && userIdFilter.length === 0) {
      return { items: [], nextCursor: null };
    }

    const { rows: members, nextCursor } = await this.visibleMembers(tx, membership, {
      ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
      limit: opts.limit,
      ...(userIdFilter !== undefined ? { userIdFilter } : {}),
    });
    if (members.length === 0) return { items: [], nextCursor: null };

    const competencies = await this.activeCompetencies(tx, tenantId);
    const tz = await this.tenantTimezone(tx, tenantId);
    const today = todayIn(tz);
    const records = await this.newestRecordsFor(tx, members.map((m) => m.user_id));

    const names = await this.namesFor(tx, members.map((m) => m.user_id));

    const rows: TrainingMatrixRowDto[] = [];
    for (const member of members) {
      const cells: TrainingMatrixCellDto[] = [];
      for (const c of competencies) {
        const rec = records.get(`${member.user_id}:${c.id}`);
        const state: CompetencyCellState = competencyCellState({
          hasRecord: rec !== undefined,
          mandatory: c.mandatory,
          expiresAt: rec?.expires_at ?? null,
          today,
        });
        if (opts.mandatoryOnly === true && !c.mandatory) continue;
        if (opts.gapsOnly === true && state !== "gap" && state !== "overdue" && state !== "warn") continue;
        cells.push({ competencyId: c.id, state, recordId: null, expiresAt: rec?.expires_at ?? null });
      }
      rows.push({
        memberId: member.user_id,
        memberName: names.get(member.user_id) ?? "Unknown",
        title: member.title,
        cells,
      });
    }
    return { items: rows, nextCursor };
  }

  private async namesFor(tx: Tx, userIds: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (userIds.length === 0) return out;
    const { rows } = await tx.query<{ id: string; name: string }>(
      "SELECT id, name FROM control.users WHERE id = ANY($1::uuid[])",
      [userIds],
    );
    for (const r of rows) out.set(r.id, r.name);
    return out;
  }

  async summary(tx: Tx, tenantId: string, membership: Membership): Promise<TrainingSummaryDto> {
    // Unpaginated pass over every visible member — bounded by the tenant's
    // roster size, same shape as InstrumentsService.summary.
    const { rows: members } = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM memberships
        WHERE status = 'active' AND role <> 'partner' AND deleted_at IS NULL
        ${isPlantScoped(membership.role) && membership.plantIds.length > 0 ? "AND (plant_ids = '{}' OR plant_ids && $1::uuid[])" : ""}`,
      isPlantScoped(membership.role) && membership.plantIds.length > 0 ? [membership.plantIds] : [],
    );
    const memberIds = members.map((m) => m.user_id);
    const membersTracked = memberIds.length;

    const competencies = await this.activeCompetencies(tx, tenantId);
    const tz = await this.tenantTimezone(tx, tenantId);
    const today = todayIn(tz);
    const records = await this.newestRecordsFor(tx, memberIds);

    let coverageOk = 0;
    let coverageTotal = 0;
    let expiringSoon = 0;
    let overdue = 0;
    for (const memberId of memberIds) {
      for (const c of competencies) {
        const rec = records.get(`${memberId}:${c.id}`);
        const state = competencyCellState({
          hasRecord: rec !== undefined,
          mandatory: c.mandatory,
          expiresAt: rec?.expires_at ?? null,
          today,
        });
        if (state === "warn") expiringSoon += 1;
        if (state === "overdue" || state === "gap") overdue += 1;
        if (c.mandatory) {
          coverageTotal += 1;
          if (state === "ok" || state === "warn") coverageOk += 1;
        }
      }
    }
    const coverage = coverageTotal === 0 ? null : (100 * coverageOk) / coverageTotal;

    return { membersTracked, coverage, expiringSoon, overdue };
  }

  async gaps(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<TrainingGapDto>> {
    // Computed over the full visible set then paginated in-process — the
    // "worst first" ordering isn't expressible as a simple keyset over a
    // computed, non-stored state, and a tenant's member x competency space is
    // bounded (mirrors the matrix's own per-tenant scan shape).
    const { rows: members } = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM memberships
        WHERE status = 'active' AND role <> 'partner' AND deleted_at IS NULL
        ${isPlantScoped(membership.role) && membership.plantIds.length > 0 ? "AND (plant_ids = '{}' OR plant_ids && $1::uuid[])" : ""}`,
      isPlantScoped(membership.role) && membership.plantIds.length > 0 ? [membership.plantIds] : [],
    );
    const memberIds = members.map((m) => m.user_id);
    const competencies = await this.activeCompetencies(tx, tenantId);
    const tz = await this.tenantTimezone(tx, tenantId);
    const today = todayIn(tz);
    const records = await this.newestRecordsFor(tx, memberIds);
    const names = await this.namesFor(tx, memberIds);
    const { rows: compNames } = await tx.query<{ id: string; name: string }>(
      "SELECT id, name FROM competencies WHERE tenant_id = $1",
      [tenantId],
    );
    const compNameMap = new Map(compNames.map((c) => [c.id, c.name]));

    const rank: Record<string, number> = { gap: 0, overdue: 0, warn: 1 };
    const out: TrainingGapDto[] = [];
    for (const memberId of memberIds) {
      for (const c of competencies) {
        const rec = records.get(`${memberId}:${c.id}`);
        const state = competencyCellState({
          hasRecord: rec !== undefined,
          mandatory: c.mandatory,
          expiresAt: rec?.expires_at ?? null,
          today,
        });
        if (state !== "gap" && state !== "overdue" && state !== "warn") continue;
        out.push({
          memberId,
          memberName: names.get(memberId) ?? "Unknown",
          competencyId: c.id,
          competencyName: compNameMap.get(c.id) ?? "Unknown",
          state,
          expiresAt: rec?.expires_at ?? null,
        });
      }
    }
    out.sort((a, b) => {
      const r = (rank[a.state] ?? 1) - (rank[b.state] ?? 1);
      if (r !== 0) return r;
      const ea = a.expiresAt ?? "9999-99-99";
      const eb = b.expiresAt ?? "9999-99-99";
      return ea < eb ? -1 : ea > eb ? 1 : 0;
    });

    const limit = clampLimit(opts.limit);
    // Not a (createdAt, id) keyset — this list is a computed, in-process,
    // "worst first" ranking with no stable row order to key off, so its
    // cursor is a plain opaque offset instead of `decodeCursor`'s shape.
    const offset = opts.cursor !== undefined ? Number(Buffer.from(opts.cursor, "base64url").toString("utf8")) || 0 : 0;
    const page = out.slice(offset, offset + limit);
    const nextCursor = offset + limit < out.length ? Buffer.from(String(offset + limit)).toString("base64url") : null;
    return { items: page, nextCursor };
  }

  // --- training records ------------------------------------------------------

  async recordTraining(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateTrainingRecordBody,
    ctx: AuditContext,
  ): Promise<CreateTrainingRecordResult> {
    const { rows: compRows } = await tx.query<{ id: string; valid_months: number | null; archived_at: Date | null }>(
      "SELECT id, valid_months, archived_at FROM competencies WHERE id = $1 AND deleted_at IS NULL",
      [body.competencyId],
    );
    const competency = compRows[0];
    if (competency === undefined) throw notFound();

    const { rows: memberRows } = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM memberships WHERE user_id = ANY($1::uuid[]) AND status = 'active' AND deleted_at IS NULL",
      [body.memberIds],
    );
    if (memberRows.length !== new Set(body.memberIds).size) throw notFound();

    let evidenceFileId: string | null = null;
    if (body.evidenceFileId != null) {
      const { rows } = await tx.query<{ id: string; sha256: string | null; entity_kind: string | null; deleted_at: Date | null }>(
        "SELECT id, sha256, entity_kind, deleted_at FROM files WHERE id = $1",
        [body.evidenceFileId],
      );
      const file = rows[0];
      if (file === undefined) throw notFound();
      if (file.deleted_at !== null) throw new ApiError("VALIDATION_FAILED", "That file has been deleted");
      if (file.sha256 === null) throw new ApiError("VALIDATION_FAILED", "That file has not finished uploading");
      if (file.entity_kind !== "training_batch") {
        throw new ApiError("VALIDATION_FAILED", "That file was not uploaded for this purpose");
      }
      evidenceFileId = file.id;
    }

    const ids = body.memberIds.map(() => randomUUID());

    return withAudit(
      tx,
      tenantId,
      body.memberIds.map((memberId, i) => ({
        actorId,
        actorKind: "user" as const,
        entityKind: "training_record" as const,
        entityId: ids[i]!,
        action: "created" as const,
        after: { memberId, competencyId: body.competencyId, completedAt: body.completedAt },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })),
      async (t) => {
        const items: TrainingRecordDto[] = [];
        for (let i = 0; i < body.memberIds.length; i++) {
          const memberId = body.memberIds[i]!;
          const id = ids[i]!;
          const { rows } = await t.query<TrainingRecordRow>(
            `INSERT INTO training_records
               (id, tenant_id, member_id, competency_id, completed_at, valid_months, evidence_file_id,
                created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
             RETURNING ${TRAINING_RECORD_COLUMNS}`,
            [id, tenantId, memberId, body.competencyId, body.completedAt, competency.valid_months, evidenceFileId, actorId],
          );
          const row = rows[0];
          if (row === undefined) throw new ApiError("INTERNAL", "Training record was not created");
          items.push(toTrainingRecordDto(row));
        }
        return { items };
      },
    );
  }

  private isOwnRecord(membership: Membership, actorId: string, memberId: string): boolean {
    return authorize(membership, "training:manage").ok || memberId === actorId;
  }

  async listRecords(
    tx: Tx,
    membership: Membership,
    actorId: string,
    opts: { memberId: string; competencyId?: string; cursor?: string; limit: number },
  ): Promise<Page<TrainingRecordDto>> {
    // Cross-tenant/plant memberId -> 404, checked before the capability rule.
    const { rows: memberRows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND deleted_at IS NULL",
      [opts.memberId],
    );
    if (memberRows.length === 0) throw notFound();

    if (!this.isOwnRecord(membership, actorId, opts.memberId)) {
      throw new ApiError("FORBIDDEN", "You may only view your own training history");
    }

    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [opts.memberId];
    let where = "WHERE member_id = $1 AND deleted_at IS NULL";
    if (opts.competencyId !== undefined) {
      params.push(opts.competencyId);
      where += ` AND competency_id = $${params.length}`;
    }
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<TrainingRecordRow>(
      `SELECT ${TRAINING_RECORD_COLUMNS} FROM training_records ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toTrainingRecordDto);
  }

  async getRecord(tx: Tx, membership: Membership, actorId: string, id: string): Promise<TrainingRecordDto> {
    const { rows } = await tx.query<TrainingRecordRow>(
      `SELECT ${TRAINING_RECORD_COLUMNS} FROM training_records WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    if (!this.isOwnRecord(membership, actorId, row.member_id)) {
      throw new ApiError("FORBIDDEN", "You may only view your own training history");
    }
    return toTrainingRecordDto(row);
  }
}
