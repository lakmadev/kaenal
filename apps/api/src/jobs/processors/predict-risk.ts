import type pg from "pg";
import { withAudit, withTenant, type Tx } from "@kaenal/db";
import {
  computeForecast,
  ppapCompleteness,
  ppapRiskScore,
  FORECAST_MODEL_VERSION,
  type PpapElementState,
} from "@kaenal/core";
import { parseElements } from "../../ppap/ppap.service.js";

/**
 * Predictive risk (06 §1 `predict-risk`, Sprint 03 Part B §3B — user-approved
 * 2026-09-28). Per tenant, in ONE tenant-scoped transaction (not one per
 * subject — mirrors `sla.ts`'s precedent):
 *   1. groups the tenant's own trailing 6 months of NCR volume by production
 *      line (`ncrs.area_id`) and by supplier (via `scars.supplier_id` —
 *      `ncrs` itself carries no `supplier_id` column; a supplier's NC volume
 *      is only reachable through the SCARs raised against it. This is a
 *      correction against the real schema, logged in PROGRESS.md Decisions
 *      log, of §3B's "ncrs.supplier_id" assumption, which does not exist);
 *   2. scores each subject with the v1 trend+seasonal-naive baseline
 *      (`packages/core/forecast.ts`), upserting one `risk_predictions` row
 *      per (subject, horizon) — a subject below the minimum-history gate gets
 *      no row this run, not a fabricated one;
 *   3. scores every in-flight PPAP submission's deadline risk (P6), writing
 *      `ppap_submissions.ai_prediction`.
 * Every write goes through `withAudit` as the `system` actor, in the same
 * transaction as its insert/update (rule 3).
 */

const HISTORY_MONTHS = 6;

export interface PredictRiskResult {
  linesScored: number;
  suppliersScored: number;
  ppapScored: number;
}

/** The 6 trailing calendar-month keys ('YYYY-MM'), oldest first, ending at `now`'s month. */
function monthKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function windowStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (HISTORY_MONTHS - 1), 1));
}

interface PeriodCountRow {
  subject_id: string;
  period: string;
  cnt: number;
}

/** Zero-fills each subject's history across all 6 month keys, oldest first. */
function toHistories(rows: readonly PeriodCountRow[], keys: readonly string[]): Map<string, number[]> {
  const bySubject = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const periods = bySubject.get(row.subject_id) ?? new Map<string, number>();
    periods.set(row.period, row.cnt);
    bySubject.set(row.subject_id, periods);
  }
  const out = new Map<string, number[]>();
  for (const [subjectId, periods] of bySubject) {
    out.set(subjectId, keys.map((k) => periods.get(k) ?? 0));
  }
  return out;
}

async function loadLineHistories(tx: Tx, now: Date): Promise<Map<string, number[]>> {
  const { rows } = await tx.query<PeriodCountRow>(
    `SELECT area_id AS subject_id, to_char(date_trunc('month', created_at), 'YYYY-MM') AS period,
            count(*)::int AS cnt
       FROM ncrs
      WHERE area_id IS NOT NULL AND deleted_at IS NULL AND created_at >= $1::timestamptz
      GROUP BY area_id, period`,
    [windowStart(now)],
  );
  return toHistories(rows, monthKeys(now));
}

/**
 * `ncrs` has no `supplier_id` column — an NCR is linked to a supplier only
 * through the SCARs raised against it (`scars.supplier_id`, `scars.ncr_id`).
 * `count(DISTINCT n.id)` guards against double-counting if more than one SCAR
 * ever references the same NCR for the same supplier.
 */
async function loadSupplierHistories(tx: Tx, now: Date): Promise<Map<string, number[]>> {
  const { rows } = await tx.query<PeriodCountRow>(
    `SELECT sc.supplier_id AS subject_id, to_char(date_trunc('month', n.created_at), 'YYYY-MM') AS period,
            count(DISTINCT n.id)::int AS cnt
       FROM scars sc
       JOIN ncrs n ON n.id = sc.ncr_id
      WHERE sc.deleted_at IS NULL AND sc.ncr_id IS NOT NULL AND n.deleted_at IS NULL
        AND n.created_at >= $1::timestamptz
      GROUP BY sc.supplier_id, period`,
    [windowStart(now)],
  );
  return toHistories(rows, monthKeys(now));
}

async function scoreSubject(
  tx: Tx,
  tenantId: string,
  subjectKind: "line" | "supplier",
  subjectId: string,
  history: readonly number[],
  now: Date,
): Promise<boolean> {
  const forecast = computeForecast(history, now);
  if (forecast === null) return false; // below the minimum-history gate (§3B) — no row written

  for (const point of forecast.points) {
    await withAudit(
      tx,
      tenantId,
      {
        actorId: null,
        actorKind: "system",
        entityKind: "risk_prediction",
        entityId: subjectId,
        action: "created",
        after: {
          subjectKind,
          horizon: point.horizon,
          predictedValue: point.predictedValue,
          confidence: point.confidence,
        },
      },
      (t) =>
        t.query(
          `INSERT INTO risk_predictions
             (tenant_id, subject_kind, subject_id, horizon, predicted_value, confidence,
              band_low, band_high, history, reasoning, model_version, generated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (tenant_id, subject_kind, subject_id, horizon) WHERE deleted_at IS NULL
           DO UPDATE SET
             predicted_value = EXCLUDED.predicted_value,
             confidence      = EXCLUDED.confidence,
             band_low        = EXCLUDED.band_low,
             band_high       = EXCLUDED.band_high,
             history          = EXCLUDED.history,
             reasoning        = EXCLUDED.reasoning,
             model_version    = EXCLUDED.model_version,
             generated_at     = EXCLUDED.generated_at`,
          [
            tenantId,
            subjectKind,
            subjectId,
            point.horizon,
            point.predictedValue,
            point.confidence,
            point.bandLow,
            point.bandHigh,
            history,
            point.reasoning,
            FORECAST_MODEL_VERSION,
            now,
          ],
        ),
    );
  }
  return true;
}

interface PpapRow {
  id: string;
  submitted_date: string | null;
  due_date: string | null;
  elements: unknown;
}

/**
 * P6: score every in-flight (not yet approved/rejected) PPAP submission's
 * deadline risk and write `ppap_submissions.ai_prediction` — a writer only,
 * no schema change (the column has shipped empty since migration 0020).
 */
async function scorePpapSubmissions(tx: Tx, tenantId: string, now: Date): Promise<number> {
  const { rows } = await tx.query<PpapRow>(
    `SELECT id, submitted_date::text AS submitted_date, due_date::text AS due_date, elements
       FROM ppap_submissions
      WHERE deleted_at IS NULL AND status NOT IN ('approved', 'rejected')`,
  );

  let scored = 0;
  for (const row of rows) {
    const elements = parseElements(row.elements);
    const states: PpapElementState[] = elements.map((e) => ({ id: e.id, status: e.status }));
    const completeness = ppapCompleteness(states);
    const completionRate = completeness.required > 0 ? completeness.approved / completeness.required : 0;

    const score = ppapRiskScore({
      submittedDate: row.submitted_date,
      dueDate: row.due_date,
      completionRate,
      now,
    });
    // No due/submitted date to project from → stays `{}` (the existing
    // nullable-field UI handling already treats that as "no prediction").
    const prediction =
      score === null
        ? {}
        : {
            confidence: score.confidence,
            willMissDeadline: score.willMissDeadline,
            daysLikelyOver: score.daysLikelyOver,
            reasoning: score.reasoning,
          };

    await withAudit(
      tx,
      tenantId,
      {
        actorId: null,
        actorKind: "system",
        entityKind: "ppap_submission",
        entityId: row.id,
        action: "updated",
        after: { aiPrediction: prediction },
      },
      (t) => t.query(`UPDATE ppap_submissions SET ai_prediction = $2::jsonb WHERE id = $1`, [row.id, JSON.stringify(prediction)]),
    );
    if (score !== null) scored++;
  }
  return scored;
}

export async function computePredictionsForTenant(
  tenantId: string,
  now: Date,
  deps: { pool?: pg.Pool | undefined },
): Promise<PredictRiskResult> {
  return withTenant(
    tenantId,
    null,
    async (tx) => {
      const [lineHistories, supplierHistories] = await Promise.all([
        loadLineHistories(tx, now),
        loadSupplierHistories(tx, now),
      ]);

      let linesScored = 0;
      for (const [subjectId, history] of lineHistories) {
        if (await scoreSubject(tx, tenantId, "line", subjectId, history, now)) linesScored++;
      }

      let suppliersScored = 0;
      for (const [subjectId, history] of supplierHistories) {
        if (await scoreSubject(tx, tenantId, "supplier", subjectId, history, now)) suppliersScored++;
      }

      const ppapScored = await scorePpapSubmissions(tx, tenantId, now);

      return { linesScored, suppliersScored, ppapScored };
    },
    deps.pool,
  );
}
