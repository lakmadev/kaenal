import { Injectable } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import { riskLevel, trailingAverage } from "@kaenal/core";
import type { Page, PredictionDetailResponse, PredictionSubjectKind, RiskPredictionDto } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { clampLimit } from "../http/pagination.js";

interface PredictionRow {
  id: string;
  subject_kind: string;
  subject_id: string;
  subject_name: string | null;
  horizon: string;
  predicted_value: string;
  confidence: number;
  band_low: string;
  band_high: string;
  history: string[];
  reasoning: string;
  model_version: string;
  generated_at: Date;
  created_at: Date;
}

/**
 * `subject_id` is polymorphic (`areas.id` for `line`, `suppliers.id` for
 * `supplier`) — no DB-level FK, so the name is resolved at read time via a
 * conditional LEFT JOIN, mirroring how `entity-ref.ts` closes a kind→table
 * map for the (unrelated) `entity_links` polymorphism. Deliberately a small
 * local map here, NOT a reuse of `entity-ref.ts`'s `tableFor` — that map has
 * no line/supplier pair (architecture review, Sprint 03 Part B slice 4).
 */
const COLUMNS = `
  rp.id, rp.subject_kind, rp.subject_id,
  COALESCE(a.name, s.name) AS subject_name,
  rp.horizon, rp.predicted_value, rp.confidence, rp.band_low, rp.band_high,
  rp.history, rp.reasoning, rp.model_version, rp.generated_at, rp.created_at
`;
const FROM = `
  risk_predictions rp
  LEFT JOIN areas a ON rp.subject_kind = 'line' AND a.id = rp.subject_id AND a.tenant_id = rp.tenant_id
  LEFT JOIN suppliers s ON rp.subject_kind = 'supplier' AND s.id = rp.subject_id AND s.tenant_id = rp.tenant_id
`;

interface CursorValue {
  readonly sortValue: string;
  readonly id: string;
}

function encodePredictionCursor(c: CursorValue): string {
  return Buffer.from(`${c.sortValue}|${c.id}`, "utf8").toString("base64url");
}

function decodePredictionCursor(raw: string): CursorValue {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  }
  const sep = decoded.lastIndexOf("|");
  const sortValue = sep === -1 ? "" : decoded.slice(0, sep);
  const id = sep === -1 ? "" : decoded.slice(sep + 1);
  if (sortValue === "" || id === "") throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  return { sortValue, id };
}

function toDto(row: PredictionRow): RiskPredictionDto {
  const predictedValue = Number(row.predicted_value);
  const history = row.history.map(Number);
  return {
    id: row.id,
    subjectKind: row.subject_kind as PredictionSubjectKind,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    horizon: row.horizon,
    predictedValue,
    confidence: row.confidence,
    bandLow: Number(row.band_low),
    bandHigh: Number(row.band_high),
    history,
    level: riskLevel(predictedValue, trailingAverage(history), row.confidence),
    reasoning: row.reasoning,
    modelVersion: row.model_version,
    generatedAt: row.generated_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Predictive risk — read-only (P2). The nightly `predict-risk` job owns every
 * row (`packages/core/forecast.ts` + `predict-risk.ts` processor); no
 * create/update route exists here by design. `prediction:view` gates both
 * routes; RLS scopes the tenant; a foreign-tenant subject id 404s (rule 8).
 */
@Injectable()
export class PredictionsService {
  async list(
    tx: Tx,
    opts: {
      subjectKind?: PredictionSubjectKind;
      horizon?: string;
      order?: "predicted_value" | "created_at";
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<RiskPredictionDto>> {
    const limit = clampLimit(opts.limit);
    const order = opts.order ?? "created_at";
    const sortColumn = order === "predicted_value" ? "rp.predicted_value" : "rp.created_at";

    const params: unknown[] = [];
    let where = "WHERE rp.deleted_at IS NULL";

    if (opts.subjectKind !== undefined) {
      params.push(opts.subjectKind);
      where += ` AND rp.subject_kind = $${params.length}`;
    }
    if (opts.horizon !== undefined) {
      params.push(opts.horizon);
      where += ` AND rp.horizon = $${params.length}`;
    }

    if (opts.cursor !== undefined) {
      const cursor = decodePredictionCursor(opts.cursor);
      if (order === "predicted_value") {
        params.push(Number(cursor.sortValue), cursor.id);
        where += ` AND (rp.predicted_value, rp.id) < ($${params.length - 1}::numeric, $${params.length}::uuid)`;
      } else {
        params.push(cursor.sortValue, cursor.id);
        where += ` AND (rp.created_at, rp.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      }
    }

    params.push(limit + 1);
    const { rows } = await tx.query<PredictionRow>(
      `SELECT ${COLUMNS} FROM ${FROM} ${where}
        ORDER BY ${sortColumn} DESC, rp.id DESC LIMIT $${params.length}`,
      params,
    );

    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const last = visible[visible.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? encodePredictionCursor({
            sortValue: order === "predicted_value" ? last.predicted_value : last.created_at.toISOString(),
            id: last.id,
          })
        : null;

    return { items: visible.map(toDto), nextCursor };
  }

  /**
   * One subject's full set of horizon rows (P2 detail). The subject's own
   * existence (RLS + tenant-scoped) is checked separately from whether it has
   * been scored yet: a real subject with too little history to score (P1's
   * "not enough history" gate) returns an empty `predictions` array, not a
   * 404 — only a subject that does not exist in this tenant at all (or
   * belongs to another tenant) 404s, never a 403 that would confirm it exists
   * elsewhere (rule 8).
   */
  async detail(tx: Tx, subjectKind: PredictionSubjectKind, subjectId: string): Promise<PredictionDetailResponse> {
    const table = subjectKind === "line" ? "areas" : "suppliers";
    const { rows: subjectRows } = await tx.query<{ name: string }>(
      `SELECT name FROM ${table} WHERE id = $1 AND deleted_at IS NULL`,
      [subjectId],
    );
    const subject = subjectRows[0];
    if (subject === undefined) throw notFound();

    const { rows } = await tx.query<PredictionRow>(
      `SELECT ${COLUMNS} FROM ${FROM}
        WHERE rp.deleted_at IS NULL AND rp.subject_kind = $1 AND rp.subject_id = $2
        ORDER BY rp.horizon ASC`,
      [subjectKind, subjectId],
    );

    return {
      subjectKind,
      subjectId,
      subjectName: subject.name,
      predictions: rows.map(toDto),
    };
  }
}
