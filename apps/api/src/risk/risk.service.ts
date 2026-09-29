import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { counterYear, formatCode, scoreBand, type RiskScoreBand } from "@kaenal/core";
import type {
  CreateRiskBody,
  Page,
  RiskControlDto,
  RiskDto,
  RiskSummaryDto,
  UpdateRiskBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { staleWriteError } from "../stale-write.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface RiskRow {
  id: string;
  code: string;
  category: string;
  title: string;
  owner: string;
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_score: number;
  trend: string;
  treatment: string;
  status: string;
  plan: string;
  review_due: Date | string | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

interface ControlRow {
  id: string;
  risk_id: string;
  kind: string;
  description: string;
  strength: string;
  seq: number;
}

const RISK_COLUMNS = `id, code, category, title, owner, likelihood, impact, inherent_score,
  residual_score, trend, treatment, status, plan, review_due, lock_version, created_at, updated_at`;
const CONTROL_COLUMNS = "id, risk_id, kind, description, strength, seq";

const dateOnly = (d: Date | string | null): string | null => {
  if (d === null) return null;
  return d instanceof Date ? d.toISOString().slice(0, 10) : d;
};

function toControlDto(row: ControlRow): RiskControlDto {
  return { id: row.id, kind: row.kind as RiskControlDto["kind"], description: row.description, strength: row.strength as RiskControlDto["strength"], seq: row.seq };
}

function toRiskDto(row: RiskRow, controls: readonly ControlRow[]): RiskDto {
  return {
    id: row.id,
    code: row.code,
    category: row.category as RiskDto["category"],
    title: row.title,
    owner: row.owner,
    likelihood: row.likelihood,
    impact: row.impact,
    inherentScore: row.inherent_score,
    residualScore: row.residual_score,
    trend: row.trend as RiskDto["trend"],
    treatment: row.treatment as RiskDto["treatment"],
    status: row.status as RiskDto["status"],
    plan: row.plan,
    reviewDue: dateOnly(row.review_due),
    controls: controls.map(toControlDto).sort((a, b) => a.seq - b.seq),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface CursorValue {
  readonly residualScore: number;
  readonly id: string;
}

function encodeRiskCursor(c: CursorValue): string {
  return Buffer.from(`${c.residualScore}|${c.id}`, "utf8").toString("base64url");
}

function decodeRiskCursor(raw: string): CursorValue {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  }
  const sep = decoded.lastIndexOf("|");
  const scoreStr = sep === -1 ? "" : decoded.slice(0, sep);
  const id = sep === -1 ? "" : decoded.slice(sep + 1);
  const residualScore = Number(scoreStr);
  if (id === "" || !Number.isInteger(residualScore)) throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  return { residualScore, id };
}

/**
 * Risk register (SPRINT-04 R1/R2/R3/R4/R5; P12). A 5×5 likelihood×impact
 * register; band math lives in `packages/core/risk-matrix.ts` (rule 5), never
 * here. Reads need `risk:view`, writes `risk:manage`; every mutation is
 * audited (rule 3) and optimistic (rule 6). `controls[]` is a full-array
 * replace folded into `PATCH /v1/risks/:id` (R2 AC2), not its own routes.
 */
@Injectable()
export class RiskService {
  async list(
    tx: Tx,
    opts: {
      category?: string;
      status?: string;
      treatment?: string;
      owner?: string;
      likelihood?: number;
      impact?: number;
      ids?: readonly string[];
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<RiskDto>> {
    const limit = Math.min(Math.max(Math.trunc(opts.limit), 1), 100);
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.category !== undefined) {
      params.push(opts.category);
      where += ` AND category = $${params.length}`;
    }
    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.treatment !== undefined) {
      params.push(opts.treatment);
      where += ` AND treatment = $${params.length}`;
    }
    if (opts.owner !== undefined) {
      params.push(opts.owner);
      where += ` AND owner = $${params.length}`;
    }
    if (opts.likelihood !== undefined) {
      params.push(opts.likelihood);
      where += ` AND likelihood = $${params.length}`;
    }
    if (opts.impact !== undefined) {
      params.push(opts.impact);
      where += ` AND impact = $${params.length}`;
    }
    if (opts.ids !== undefined && opts.ids.length > 0) {
      params.push(opts.ids);
      where += ` AND id = ANY($${params.length}::uuid[])`;
    }
    if (opts.cursor !== undefined) {
      const cursor = decodeRiskCursor(opts.cursor);
      params.push(cursor.residualScore, cursor.id);
      where += ` AND (residual_score, id) < ($${params.length - 1}::int, $${params.length}::uuid)`;
    }

    params.push(limit + 1);
    const { rows } = await tx.query<RiskRow>(
      `SELECT ${RISK_COLUMNS} FROM risks ${where}
        ORDER BY residual_score DESC, id DESC LIMIT $${params.length}`,
      params,
    );

    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const controlsByRisk = await this.loadControls(tx, visible.map((r) => r.id));
    const last = visible[visible.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? encodeRiskCursor({ residualScore: last.residual_score, id: last.id })
        : null;
    return { items: visible.map((r) => toRiskDto(r, controlsByRisk.get(r.id) ?? [])), nextCursor };
  }

  /**
   * Register-wide aggregate (architect-flagged addition to §4's route table,
   * not originally in it — the KPI strip/heat-map/category panel need counts
   * across ALL of the caller's visible risks, which the paginated `list`
   * above cannot supply without violating rule 6). Score-banding always goes
   * through `packages/core/risk-matrix.ts`'s `scoreBand` (rule 5) — never
   * re-implemented as a SQL CASE.
   */
  async summary(tx: Tx): Promise<RiskSummaryDto> {
    const { rows } = await tx.query<{
      id: string;
      category: string;
      status: string;
      residual_score: number;
      review_due: Date | string | null;
    }>(`SELECT id, category, status, residual_score, review_due FROM risks WHERE deleted_at IS NULL`);

    const total = rows.length;
    const byCategory: Record<string, number> = {};
    const byBand: Record<RiskScoreBand, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    let highResidual = 0;
    let treatmentsOverdue = 0;
    let accepted = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      const band = scoreBand(r.residual_score);
      byBand[band] += 1;
      if (band === "high" || band === "critical") highResidual += 1;
      if (r.status === "accepted") accepted += 1;
      const due = dateOnly(r.review_due);
      if (due !== null && due < today) treatmentsOverdue += 1;
    }

    let reviewedThisQuarterPct: number | null = null;
    if (total > 0) {
      const { rows: reviewed } = await tx.query<{ n: string }>(
        `SELECT count(DISTINCT ae.entity_id)::text AS n
           FROM audit_events ae
           JOIN risks r ON r.id = ae.entity_id AND r.deleted_at IS NULL
          WHERE ae.entity_kind = 'risk'
            AND ae.action IN ('created', 'updated')
            AND ae.created_at >= date_trunc('quarter', now())
            AND ae.created_at < date_trunc('quarter', now()) + interval '3 months'`,
      );
      const reviewedCount = Number(reviewed[0]?.n ?? 0);
      reviewedThisQuarterPct = (100 * reviewedCount) / total;
    }

    return { total, byCategory, byBand, highResidual, treatmentsOverdue, accepted, reviewedThisQuarterPct };
  }

  private async loadRow(tx: Tx, id: string): Promise<RiskRow> {
    const { rows } = await tx.query<RiskRow>(
      `SELECT ${RISK_COLUMNS} FROM risks WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  private async loadControls(tx: Tx, riskIds: readonly string[]): Promise<Map<string, ControlRow[]>> {
    const out = new Map<string, ControlRow[]>();
    if (riskIds.length === 0) return out;
    const { rows } = await tx.query<ControlRow>(
      `SELECT ${CONTROL_COLUMNS} FROM risk_controls WHERE risk_id = ANY($1::uuid[]) AND deleted_at IS NULL
        ORDER BY seq ASC, created_at ASC, id ASC`,
      [riskIds],
    );
    for (const row of rows) {
      const list = out.get(row.risk_id) ?? [];
      list.push(row);
      out.set(row.risk_id, list);
    }
    return out;
  }

  async get(tx: Tx, id: string): Promise<RiskDto> {
    const row = await this.loadRow(tx, id);
    const controls = await this.loadControls(tx, [id]);
    return toRiskDto(row, controls.get(id) ?? []);
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
    body: CreateRiskBody,
    ctx: AuditContext,
  ): Promise<RiskDto> {
    await this.assertMember(tx, body.owner);

    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();
    // R4 AC1: not captured at create defaults to the inherent (not-yet-scored)
    // value — the owner's post-control judgment call is applied later via Edit/Re-score.
    const residualScore = body.residualScore ?? body.likelihood * body.impact;

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "risk",
        entityId: id,
        action: "created",
        after: { title: body.title, category: body.category, likelihood: body.likelihood, impact: body.impact },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'risk', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a risk code");

        const { rows } = await t.query<RiskRow>(
          `INSERT INTO risks
             (id, tenant_id, code, category, title, owner, likelihood, impact, residual_score,
              trend, treatment, status, plan, review_due, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
           RETURNING ${RISK_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("risk", year, seq),
            body.category,
            body.title,
            body.owner,
            body.likelihood,
            body.impact,
            residualScore,
            body.trend,
            body.treatment,
            body.status,
            body.plan,
            body.reviewDue ?? null,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Risk was not created");
        return toRiskDto(row, []);
      },
    );
  }

  /**
   * Full edit surface, incl. Re-score (same route) and a `controls[]`
   * full-array replace (R2 AC2) guarded by the PARENT risk's own
   * `lockVersion` and audited as a single `updated` event on the parent —
   * never a per-control audit row.
   */
  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateRiskBody,
    ctx: AuditContext,
  ): Promise<RiskDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "risks",
        key: id,
        message: "This risk changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    await this.assertMember(tx, body.owner);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "risk",
        entityId: id,
        action: "updated",
        before: { residualScore: current.residual_score, status: current.status, treatment: current.treatment },
        after: { residualScore: body.residualScore, status: body.status, treatment: body.treatment },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<RiskRow>(
          `UPDATE risks SET category=$3, title=$4, owner=$5, likelihood=$6, impact=$7, residual_score=$8,
             trend=$9, treatment=$10, status=$11, plan=$12, review_due=$13, updated_by=$14
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL RETURNING ${RISK_COLUMNS}`,
          [
            id,
            body.lockVersion,
            body.category,
            body.title,
            body.owner,
            body.likelihood,
            body.impact,
            body.residualScore,
            body.trend,
            body.treatment,
            body.status,
            body.plan,
            body.reviewDue,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) {
          throw await staleWriteError(t, {
            table: "risks",
            key: id,
            message: "This risk changed since you loaded it",
            expected: body.lockVersion,
            actual: current.lock_version,
          });
        }

        let controls: ControlRow[];
        if (body.controls !== undefined) {
          // Full-array replace, in one transaction: delete-and-reinsert, in
          // `seq` order (R2 AC2/AC3) — guarded by the parent's own lock
          // already checked above, not a separate per-control version.
          await t.query(`DELETE FROM risk_controls WHERE risk_id = $1`, [id]);
          controls = [];
          for (const c of body.controls) {
            const { rows: inserted } = await t.query<ControlRow>(
              `INSERT INTO risk_controls (id, tenant_id, risk_id, kind, description, strength, seq, created_by, updated_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING ${CONTROL_COLUMNS}`,
              [c.id ?? randomUUID(), tenantId, id, c.kind, c.description, c.strength, c.seq, actorId],
            );
            const insertedRow = inserted[0];
            if (insertedRow === undefined) throw new ApiError("INTERNAL", "A control was not saved");
            controls.push(insertedRow);
          }
        } else {
          const map = await this.loadControls(t, [id]);
          controls = map.get(id) ?? [];
        }
        return toRiskDto(row, controls);
      },
    );
  }
}
