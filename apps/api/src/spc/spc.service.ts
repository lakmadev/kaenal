import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { computeXbarR, SpcError } from "@kaenal/core";
import type {
  IngestMeasurementsBody,
  SpcChartDto,
  SpcCharacteristicsResult,
  SpcViolationDto,
} from "@kaenal/types";
import { ApiError } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface MeasurementRow {
  value: string;
  subgroup: number;
  usl: string | null;
  lsl: string | null;
  target: string | null;
  unit: string | null;
}

/**
 * SPC analytics (B5; tables 0034). Reads measurement rows for a characteristic,
 * groups them by subgroup, and computes the X̄/R chart + Western-Electric rules +
 * capability in `@kaenal/core` (all the math is pure + unit-tested). Reads are
 * `spc:view`; ingest is `measurement:manage` and audited. Everything runs on the
 * request's tenant transaction, so RLS scopes it exactly like every other read.
 */
@Injectable()
export class SpcService {
  /** The characteristics that have measurement data (the chart's series picker). */
  async characteristics(tx: Tx): Promise<SpcCharacteristicsResult> {
    const { rows } = await tx.query<{
      part: string;
      characteristic: string;
      unit: string | null;
      subgroups: string;
      measurements: string;
    }>(
      `SELECT part, characteristic, max(unit) AS unit,
              count(DISTINCT subgroup)::text AS subgroups, count(*)::text AS measurements
         FROM measurements WHERE deleted_at IS NULL
        GROUP BY part, characteristic
        ORDER BY part, characteristic`,
    );
    return {
      items: rows.map((r) => ({
        part: r.part,
        characteristic: r.characteristic,
        unit: r.unit,
        subgroups: Number(r.subgroups),
        measurements: Number(r.measurements),
      })),
    };
  }

  /** The computed X̄/R chart for one characteristic. */
  async chart(tx: Tx, part: string, characteristic: string): Promise<SpcChartDto> {
    const { rows } = await tx.query<MeasurementRow>(
      `SELECT value, subgroup, usl, lsl, target, unit
         FROM measurements
        WHERE part = $1 AND characteristic = $2 AND deleted_at IS NULL
        ORDER BY subgroup, taken_at, id`,
      [part, characteristic],
    );
    if (rows.length === 0) throw new ApiError("NOT_FOUND", "No measurements for that characteristic");

    // Group values by subgroup, preserving subgroup order.
    const bySubgroup = new Map<number, number[]>();
    for (const r of rows) {
      const list = bySubgroup.get(r.subgroup) ?? [];
      list.push(Number(r.value));
      bySubgroup.set(r.subgroup, list);
    }
    const subgroups = [...bySubgroup.keys()].sort((a, b) => a - b).map((k) => bySubgroup.get(k)!);

    const first = rows[0]!;
    const spec = { usl: numOrNull(first.usl), lsl: numOrNull(first.lsl) };

    let result;
    try {
      result = computeXbarR(subgroups, spec);
    } catch (err) {
      if (err instanceof SpcError) throw new ApiError("VALIDATION_FAILED", err.message);
      throw err;
    }

    const violations: SpcViolationDto[] = result.violations.map((v) => ({
      rule: v.rule,
      description: v.description,
      subgroups: [...v.subgroups],
    }));

    return {
      part,
      characteristic,
      unit: first.unit,
      subgroupSize: result.subgroupSize,
      points: result.points.map((p) => ({ subgroup: p.subgroup, mean: p.mean, range: p.range, values: [...p.values] })),
      centerLine: result.centerLine,
      uclX: result.uclX,
      lclX: result.lclX,
      rBar: result.rBar,
      uclR: result.uclR,
      lclR: result.lclR,
      capability: {
        cp: result.capability.cp,
        cpk: result.capability.cpk,
        sigma: result.capability.sigma,
        usl: result.capability.usl,
        lsl: result.capability.lsl,
      },
      violations,
    };
  }

  /** Ingest a batch of measurements for one characteristic (audited). */
  async ingest(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: IngestMeasurementsBody,
    ctx: AuditContext,
  ): Promise<{ inserted: number }> {
    const batchId = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user" as const,
        entityKind: "measurement",
        entityId: batchId,
        action: "created" as const,
        after: { characteristic: body.characteristic, part: body.part, count: body.points.length },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        for (const point of body.points) {
          await t.query(
            `INSERT INTO measurements
               (id, tenant_id, part, characteristic, value, subgroup, unit, usl, lsl, target, source, taken_at, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12, now()),$13,$13)`,
            [
              randomUUID(),
              tenantId,
              body.part,
              body.characteristic,
              point.value,
              point.subgroup,
              body.unit ?? null,
              body.usl ?? null,
              body.lsl ?? null,
              body.target ?? null,
              body.source,
              point.takenAt ?? null,
              actorId,
            ],
          );
        }
        return { inserted: body.points.length };
      },
    );
  }
}

function numOrNull(v: string | null): number | null {
  return v === null ? null : Number(v);
}
