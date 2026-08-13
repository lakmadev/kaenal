import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  counterYear,
  formatCode,
  scoreSupplier,
  DEFAULT_SCORE_WEIGHTS,
  type ScoreWeights,
  type SupplierMetrics,
} from "@kaenal/core";
import type {
  CreateSupplierBody,
  Page,
  RiskLevel,
  SupplierDto,
  SupplierScorecard,
  SupplierStatus,
  UpdateSupplierBody,
} from "@kaenal/types";
import { SupplierScorecard as SupplierScorecardSchema, SupplierProfile as SupplierProfileSchema } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  tier: number | null;
  category: string | null;
  country: string | null;
  city: string | null;
  status: string;
  risk_tier: string | null;
  ai_risk_tier: string | null;
  ai_risk_confidence: number | null;
  flags: string[];
  contact: Record<string, unknown> | null;
  cert_expires: string | null;
  last_audit: string | null;
  next_audit: string | null;
  scorecard: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

// Date columns are cast to text so pg hands back a plain 'YYYY-MM-DD' string
// rather than a timezone-shifted Date at local midnight.
const SUPPLIER_COLUMNS = `id, code, name, tier, category, country, city, status, risk_tier,
  ai_risk_tier, ai_risk_confidence, flags, contact,
  cert_expires::text AS cert_expires, last_audit::text AS last_audit, next_audit::text AS next_audit,
  scorecard, profile, lock_version, created_at, updated_at`;

/** Weighted score + grade from the raw scorecard metrics, under the given weights. */
function scoreOf(scorecard: SupplierScorecard, weights: ScoreWeights): { score: number | null; grade: SupplierDto["grade"] } {
  const metrics: SupplierMetrics = scorecard;
  const hasAny =
    metrics.ppm != null || metrics.otd != null || metrics.oqe != null || metrics.scarHours != null;
  if (!hasAny) return { score: null, grade: null };
  const { score, grade } = scoreSupplier(metrics, weights);
  return { score, grade };
}

function toSupplierDto(row: SupplierRow, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): SupplierDto {
  const scorecard = SupplierScorecardSchema.parse(row.scorecard ?? {});
  const { score, grade } = scoreOf(scorecard, weights);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    tier: row.tier,
    category: row.category,
    country: row.country,
    city: row.city,
    status: row.status as SupplierStatus,
    riskTier: row.risk_tier as RiskLevel | null,
    aiRiskTier: row.ai_risk_tier as RiskLevel | null,
    aiRiskConfidence: row.ai_risk_confidence,
    flags: row.flags,
    contact: row.contact,
    certExpires: row.cert_expires,
    lastAudit: row.last_audit,
    nextAudit: row.next_audit,
    scorecard,
    profile: SupplierProfileSchema.parse(row.profile ?? {}),
    score,
    grade,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Suppliers (FEATURES §11.1, P08). Supplier records are tenant-wide, not
 * plant-scoped, so RLS is the only isolation needed — a foreign-tenant id is
 * invisible and surfaces as 404 (rule 8). `supplier:view` reads (everyone);
 * `supplier:manage` (admin/manager) creates and edits. Raw KPI metrics live in
 * the `scorecard` jsonb; the weighted score is computed here via
 * `packages/core` so the weighting stays testable and re-weightable per request.
 */
@Injectable()
export class SuppliersService {
  async list(
    tx: Tx,
    opts: {
      status?: string;
      riskTier?: string;
      tier?: number;
      category?: string;
      country?: string;
      flag?: string;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<SupplierDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.riskTier !== undefined) {
      params.push(opts.riskTier);
      where += ` AND risk_tier = $${params.length}`;
    }
    if (opts.tier !== undefined) {
      params.push(opts.tier);
      where += ` AND tier = $${params.length}`;
    }
    if (opts.category !== undefined) {
      params.push(opts.category);
      where += ` AND category = $${params.length}`;
    }
    if (opts.country !== undefined) {
      params.push(opts.country);
      where += ` AND country = $${params.length}`;
    }
    if (opts.flag !== undefined) {
      params.push([opts.flag]);
      where += ` AND flags @> $${params.length}::text[]`;
    }
    if (opts.q !== undefined) {
      params.push(`%${opts.q}%`);
      where += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length})`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<SupplierRow>(
      `SELECT ${SUPPLIER_COLUMNS} FROM suppliers ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, (r) => toSupplierDto(r));
  }

  async get(tx: Tx, id: string): Promise<SupplierDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toSupplierDto(row);
  }

  /**
   * Suppliers ranked by weighted score. Ordering is on a computed value, so this
   * fetches the tenant's suppliers (capped) and sorts in memory rather than by a
   * keyset — the supplier count per tenant is small (hundreds), unlike the
   * transactional tables. Returns a single page (nextCursor null).
   */
  async scorecard(tx: Tx, weights: ScoreWeights): Promise<Page<SupplierDto>> {
    const { rows } = await tx.query<SupplierRow>(
      `SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE deleted_at IS NULL
        ORDER BY created_at DESC, id DESC LIMIT 500`,
      [],
    );
    const scored = rows.map((r) => toSupplierDto(r, weights));
    scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { items: scored, nextCursor: null };
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateSupplierBody,
    context: AuditContext,
  ): Promise<SupplierDto> {
    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "supplier",
        entityId: id,
        action: "created",
        after: { name: body.name },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        let code = body.code;
        if (code === undefined) {
          const { rows: counter } = await t.query<{ value: number }>(
            `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'supplier', $2, 1)
             ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
             RETURNING value`,
            [tenantId, year],
          );
          const seq = counter[0]?.value;
          if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a supplier code");
          code = formatCode("supplier", year, seq);
        }

        try {
          const { rows } = await t.query<SupplierRow>(
            `INSERT INTO suppliers
               (id, tenant_id, code, name, tier, category, country, city, status, risk_tier,
                ai_risk_tier, ai_risk_confidence, flags, contact, cert_expires, last_audit, next_audit,
                scorecard, profile, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'active'),$10,
                     $11,$12,COALESCE($13::text[],'{}'::text[]),$14::jsonb,$15,$16,$17,
                     COALESCE($18::jsonb,'{}'::jsonb),COALESCE($19::jsonb,'{}'::jsonb),$20,$20)
             RETURNING ${SUPPLIER_COLUMNS}`,
            [
              id,
              tenantId,
              code,
              body.name,
              body.tier ?? null,
              body.category ?? null,
              body.country ?? null,
              body.city ?? null,
              body.status ?? null,
              body.riskTier ?? null,
              body.aiRiskTier ?? null,
              body.aiRiskConfidence ?? null,
              body.flags ?? null,
              body.contact != null ? JSON.stringify(body.contact) : null,
              body.certExpires ?? null,
              body.lastAudit ?? null,
              body.nextAudit ?? null,
              body.scorecard != null ? JSON.stringify(body.scorecard) : null,
              body.profile != null ? JSON.stringify(body.profile) : null,
              actorId,
            ],
          );
          const row = rows[0];
          if (row === undefined) throw new ApiError("INTERNAL", "Supplier was not created");
          return toSupplierDto(row);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ApiError("CONFLICT", `A supplier with code '${code}' already exists`);
          }
          throw err;
        }
      },
    );
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateSupplierBody,
    context: AuditContext,
  ): Promise<SupplierDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    if (row.lock_version !== body.version) {
      throw new ApiError("STALE_WRITE", "The supplier changed since you loaded it", {
        expected: body.version,
        actual: row.lock_version,
      });
    }

    // Only columns the body actually carries are touched (a partial update).
    const sets: string[] = [];
    const params: unknown[] = [id, body.version];
    const set = (col: string, value: unknown, cast = ""): void => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };

    if (body.name !== undefined) set("name", body.name);
    if (body.tier !== undefined) set("tier", body.tier);
    if (body.category !== undefined) set("category", body.category);
    if (body.country !== undefined) set("country", body.country);
    if (body.city !== undefined) set("city", body.city);
    if (body.status !== undefined) set("status", body.status);
    if (body.riskTier !== undefined) set("risk_tier", body.riskTier);
    if (body.aiRiskTier !== undefined) set("ai_risk_tier", body.aiRiskTier);
    if (body.aiRiskConfidence !== undefined) set("ai_risk_confidence", body.aiRiskConfidence);
    if (body.flags !== undefined) set("flags", body.flags);
    if (body.contact !== undefined) set("contact", body.contact != null ? JSON.stringify(body.contact) : null, "::jsonb");
    if (body.certExpires !== undefined) set("cert_expires", body.certExpires);
    if (body.lastAudit !== undefined) set("last_audit", body.lastAudit);
    if (body.nextAudit !== undefined) set("next_audit", body.nextAudit);
    if (body.scorecard !== undefined) set("scorecard", JSON.stringify(body.scorecard), "::jsonb");
    if (body.profile !== undefined) set("profile", JSON.stringify(body.profile), "::jsonb");

    params.push(actorId);
    sets.push(`updated_by = $${params.length}`);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "supplier",
        entityId: id,
        action: "updated",
        before: { name: row.name, status: row.status },
        after: { name: body.name ?? row.name },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<SupplierRow>(
          `UPDATE suppliers SET ${sets.join(", ")} WHERE id = $1 AND lock_version = $2
            RETURNING ${SUPPLIER_COLUMNS}`,
          params,
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("STALE_WRITE", "The supplier changed since you loaded it");
        return toSupplierDto(updated);
      },
    );
  }

  private async fetch(tx: Tx, id: string): Promise<SupplierRow | null> {
    const { rows } = await tx.query<SupplierRow>(
      `SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}
