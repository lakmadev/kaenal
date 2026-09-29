import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  analyzeGaugeRr,
  counterYear,
  formatCode,
  GaugeRrError,
  type GaugeRrResult,
  type GaugeRrSourceResult,
} from "@kaenal/core";
import type {
  CreateMsaStudyBody,
  MsaAnalysisResult,
  MsaCompleteBody,
  MsaGaugeRrSourceDto,
  MsaMeasurementBatchBody,
  MsaMeasurementDto,
  MsaReopenBody,
  MsaStudyDto,
  Page,
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
import type { AuditContext } from "../ncr/audit-context.js";

interface StudyRow {
  id: string;
  code: string;
  characteristic: string;
  gauge_label: string;
  method: string;
  n_appraisers: number;
  n_parts: number;
  n_trials: number;
  tolerance: string | null;
  status: string;
  completed_at: Date | null;
  owner: string;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

interface MeasurementRow {
  appraiser: number;
  part: number;
  trial: number;
  value: string;
}

const STUDY_COLUMNS = `id, code, characteristic, gauge_label, method, n_appraisers, n_parts, n_trials,
  tolerance, status, completed_at, owner, lock_version, created_at, updated_at`;

function toMeasurementDto(row: MeasurementRow): MsaMeasurementDto {
  return { appraiser: row.appraiser, part: row.part, trial: row.trial, value: Number(row.value) };
}

function toStudyDto(row: StudyRow, measurements: readonly MeasurementRow[]): MsaStudyDto {
  return {
    id: row.id,
    code: row.code,
    characteristic: row.characteristic,
    gaugeLabel: row.gauge_label,
    method: row.method as MsaStudyDto["method"],
    nAppraisers: row.n_appraisers,
    nParts: row.n_parts,
    nTrials: row.n_trials,
    tolerance: row.tolerance === null ? null : Number(row.tolerance),
    status: row.status as MsaStudyDto["status"],
    completedAt: row.completed_at === null ? null : row.completed_at.toISOString(),
    owner: row.owner,
    measurements: measurements.map(toMeasurementDto),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSourceDto(r: GaugeRrSourceResult): MsaGaugeRrSourceDto {
  return { stdDev: r.stdDev, studyVariation: r.studyVariation, pctStudyVar: r.pctStudyVar, pctTolerance: r.pctTolerance };
}

function toAnalysisDto(result: GaugeRrResult): MsaAnalysisResult {
  return {
    status: "complete",
    method: result.method,
    repeatability: toSourceDto(result.repeatability),
    appraiser: result.appraiser === null ? null : toSourceDto(result.appraiser),
    appraiserByPart: result.appraiserByPart === null ? null : toSourceDto(result.appraiserByPart),
    reproducibility: toSourceDto(result.reproducibility),
    grr: toSourceDto(result.grr),
    partToPart: toSourceDto(result.partToPart),
    total: toSourceDto(result.total),
    ndc: result.ndc,
    verdict: result.verdict,
    interactionPooled: result.interactionPooled,
  };
}

/**
 * MSA / Gauge R&R studies (SPRINT-04 M1-M5; P15). AIAG 4th-edition variance-
 * component math lives in `packages/core/gauge-rr.ts` (rule 5) and is NEVER
 * stored pre-computed (M1 AC3) — `analysis` always recomputes from the
 * study's real measurements. Reads need `msa:view`, writes `msa:manage`;
 * every mutation is audited (rule 3) and optimistic (rule 6). Dimensions
 * (`method`/`nAppraisers`/`nParts`/`nTrials`/`gaugeLabel`/`tolerance`/
 * `characteristic`) are set once at create and are immutable for the life of
 * the study (M2 AC3).
 */
@Injectable()
export class MsaService {
  async list(
    tx: Tx,
    opts: { status?: string; method?: string; cursor?: string; limit: number },
  ): Promise<Page<MsaStudyDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.method !== undefined) {
      params.push(opts.method);
      where += ` AND method = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<StudyRow>(
      `SELECT ${STUDY_COLUMNS} FROM msa_studies ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const measurementsByStudy = await this.loadMeasurements(tx, visible.map((r) => r.id));
    return toPage(rows, limit, (r) => toStudyDto(r, measurementsByStudy.get(r.id) ?? []));
  }

  private async loadRow(tx: Tx, id: string): Promise<StudyRow> {
    const { rows } = await tx.query<StudyRow>(
      `SELECT ${STUDY_COLUMNS} FROM msa_studies WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  private async loadMeasurements(tx: Tx, studyIds: readonly string[]): Promise<Map<string, MeasurementRow[]>> {
    const out = new Map<string, MeasurementRow[]>();
    if (studyIds.length === 0) return out;
    const { rows } = await tx.query<MeasurementRow & { study_id: string }>(
      `SELECT study_id, appraiser, part, trial, value FROM msa_measurements
        WHERE study_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [studyIds],
    );
    for (const row of rows) {
      const list = out.get(row.study_id) ?? [];
      list.push(row);
      out.set(row.study_id, list);
    }
    return out;
  }

  async get(tx: Tx, id: string): Promise<MsaStudyDto> {
    const row = await this.loadRow(tx, id);
    const measurements = await this.loadMeasurements(tx, [id]);
    return toStudyDto(row, measurements.get(id) ?? []);
  }

  /** Used by `ExportsService` (gauge_rr_aiag_report) to 404 on a foreign/
   *  unknown studyId before enqueueing a render (mirrors audit_report). */
  async assertViewable(tx: Tx, id: string): Promise<void> {
    await this.loadRow(tx, id);
  }

  private async assertMember(tx: Tx, userId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId],
    );
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    owner: string,
    body: CreateMsaStudyBody,
    ctx: AuditContext,
  ): Promise<MsaStudyDto> {
    // Bounds (upper cap + method-keyed lower bounds) are fully enforced by
    // `CreateMsaStudyBody`'s own shape + `.superRefine` (packages/types) —
    // verified this slice; no duplicate check needed here.
    await this.assertMember(tx, owner);

    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "msa_study",
        entityId: id,
        action: "created",
        after: { characteristic: body.characteristic, method: body.method },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'msa', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an MSA code");

        const { rows } = await t.query<StudyRow>(
          `INSERT INTO msa_studies
             (id, tenant_id, code, characteristic, gauge_label, method, n_appraisers, n_parts, n_trials,
              tolerance, owner, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
           RETURNING ${STUDY_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("msa", year, seq),
            body.characteristic,
            body.gaugeLabel,
            body.method,
            body.nAppraisers,
            body.nParts,
            body.nTrials,
            body.tolerance ?? null,
            owner,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "MSA study was not created");
        return toStudyDto(row, []);
      },
    );
  }

  /**
   * Bulk-upsert grid cells (M2 AC2, `[AMENDED-4]`). Guards, in order, all in
   * one transaction: (1) `lockVersion` match (409); (2) not `completed`
   * (422 — "reopen the study first"); (3) every cell's index within the
   * study's OWN declared dimensions (422). Bumps `lock_version` on success
   * (closes the race a concurrent completion could otherwise slip through);
   * one audited `updated` event for the whole batch, never per-cell.
   */
  async recordMeasurements(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: MsaMeasurementBatchBody,
    ctx: AuditContext,
  ): Promise<MsaStudyDto> {
    const study = await this.loadRow(tx, id);
    if (study.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "msa_studies",
        key: id,
        message: "This study changed since you loaded it",
        expected: body.lockVersion,
        actual: study.lock_version,
      });
    }
    if (study.status === "completed") {
      throw new ApiError("VALIDATION_FAILED", "This study is completed — reopen it before entering measurements");
    }
    for (const cell of body.cells) {
      if (
        cell.appraiser < 1 ||
        cell.appraiser > study.n_appraisers ||
        cell.part < 1 ||
        cell.part > study.n_parts ||
        cell.trial < 1 ||
        cell.trial > study.n_trials
      ) {
        throw new ApiError(
          "VALIDATION_FAILED",
          `Cell (appraiser ${cell.appraiser}, part ${cell.part}, trial ${cell.trial}) is outside this study's ${study.n_appraisers}×${study.n_parts}×${study.n_trials} design`,
        );
      }
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "msa_study",
        entityId: id,
        action: "updated",
        after: { measurementsSubmitted: body.cells.length },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        for (const cell of body.cells) {
          await t.query(
            `INSERT INTO msa_measurements (id, tenant_id, study_id, appraiser, part, trial, value, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
             ON CONFLICT (tenant_id, study_id, appraiser, part, trial)
             DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [randomUUID(), tenantId, id, cell.appraiser, cell.part, cell.trial, cell.value, actorId],
          );
        }
        const { rows } = await t.query<StudyRow>(
          `UPDATE msa_studies SET updated_by = $2, updated_at = now()
            WHERE id = $1 AND lock_version = $3 RETURNING ${STUDY_COLUMNS}`,
          [id, actorId, body.lockVersion],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, {
            table: "msa_studies",
            key: id,
            message: "This study changed since you loaded it",
            expected: body.lockVersion,
          });
        }
        const measurements = await this.loadMeasurements(t, [id]);
        return toStudyDto(row, measurements.get(id) ?? []);
      },
    );
  }

  /**
   * `draft → completed` (M2 AC3). Guards: `lockVersion` match (409); study
   * must be `draft` (422 — no-op re-completion is refused, not silently
   * accepted); every `nAppraisers×nParts×nTrials` cell must exist (422 —
   * "incomplete grid"). `completedAt` is set fresh, or OVERWRITTEN on a
   * later re-completion after a reopen (§3-Addendum). Audited
   * `status_changed`, never generic `updated`.
   */
  async complete(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: MsaCompleteBody,
    ctx: AuditContext,
  ): Promise<MsaStudyDto> {
    const study = await this.loadRow(tx, id);
    if (study.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "msa_studies",
        key: id,
        message: "This study changed since you loaded it",
        expected: body.lockVersion,
        actual: study.lock_version,
      });
    }
    if (study.status !== "draft") {
      throw new ApiError("VALIDATION_FAILED", "Only a draft study can be completed");
    }
    const { rows: countRows } = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM msa_measurements WHERE study_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const entered = Number(countRows[0]?.n ?? 0);
    const required = study.n_appraisers * study.n_parts * study.n_trials;
    if (entered < required) {
      throw new ApiError(
        "VALIDATION_FAILED",
        `Incomplete grid — ${entered}/${required} measurements entered`,
        { entered, required },
      );
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "msa_study",
        entityId: id,
        action: "status_changed",
        before: { status: study.status },
        after: { status: "completed" },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<StudyRow>(
          `UPDATE msa_studies SET status = 'completed', completed_at = now(), updated_by = $2
            WHERE id = $1 AND lock_version = $3 RETURNING ${STUDY_COLUMNS}`,
          [id, actorId, body.lockVersion],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, {
            table: "msa_studies",
            key: id,
            message: "This study changed since you loaded it",
            expected: body.lockVersion,
          });
        }
        const measurements = await this.loadMeasurements(t, [id]);
        return toStudyDto(row, measurements.get(id) ?? []);
      },
    );
  }

  /**
   * `completed → draft` (M2 AC5). Guards: `lockVersion` match (409); study
   * must be `completed` (422 if already `draft`). `completedAt` is KEPT, not
   * cleared (§3-Addendum). Audited `status_changed`.
   */
  async reopen(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: MsaReopenBody,
    ctx: AuditContext,
  ): Promise<MsaStudyDto> {
    const study = await this.loadRow(tx, id);
    if (study.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "msa_studies",
        key: id,
        message: "This study changed since you loaded it",
        expected: body.lockVersion,
        actual: study.lock_version,
      });
    }
    if (study.status !== "completed") {
      throw new ApiError("VALIDATION_FAILED", "Only a completed study can be reopened");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "msa_study",
        entityId: id,
        action: "status_changed",
        before: { status: study.status },
        after: { status: "draft" },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<StudyRow>(
          `UPDATE msa_studies SET status = 'draft', updated_by = $2
            WHERE id = $1 AND lock_version = $3 RETURNING ${STUDY_COLUMNS}`,
          [id, actorId, body.lockVersion],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, {
            table: "msa_studies",
            key: id,
            message: "This study changed since you loaded it",
            expected: body.lockVersion,
          });
        }
        const measurements = await this.loadMeasurements(t, [id]);
        return toStudyDto(row, measurements.get(id) ?? []);
      },
    );
  }

  /**
   * Recomputed live from the study's real measurements every time (rule 5;
   * M1 AC3) — never stored pre-computed. An incomplete grid returns the
   * honest `"incomplete"` shape, never a divide-by-zero or a fabricated
   * result.
   */
  async analysis(tx: Tx, id: string): Promise<MsaAnalysisResult> {
    const study = await this.loadRow(tx, id);
    const measurements = await this.loadMeasurements(tx, [id]);
    const cells = measurements.get(id) ?? [];
    const required = study.n_appraisers * study.n_parts * study.n_trials;
    if (cells.length < required) {
      return { status: "incomplete", measurementsEntered: cells.length, measurementsRequired: required };
    }
    try {
      const result = analyzeGaugeRr({
        method: study.method as "crossed_anova" | "average_range",
        appraisers: study.n_appraisers,
        parts: study.n_parts,
        trials: study.n_trials,
        tolerance: study.tolerance === null ? null : Number(study.tolerance),
        measurements: cells.map(toMeasurementDto),
      });
      return toAnalysisDto(result);
    } catch (err) {
      if (err instanceof GaugeRrError) {
        // A grid that is "full by count" but still has a duplicate/missing
        // cell (shouldn't happen given the unique constraint + index guards,
        // but never fabricate a result over it) reports honestly as incomplete.
        return { status: "incomplete", measurementsEntered: cells.length, measurementsRequired: required };
      }
      throw err;
    }
  }
}

