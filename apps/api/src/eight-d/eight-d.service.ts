import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  EIGHT_D_STEPS,
  allStepsComplete,
  canCompleteStep,
  counterYear,
  formatCode,
  stepKey,
  type StepStatuses,
} from "@kaenal/core";
import type {
  CreateEightDBody,
  EightDDto,
  EightDStatus,
  EightDStepDto,
  EightDStepStatus,
  Page,
  TransitionEightDBody,
  UpdateEightDStepBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface StepObject {
  status: EightDStepStatus;
  completedAt?: string | null;
  completedBy?: string | null;
  data?: Record<string, unknown>;
}
type Steps = Record<string, StepObject>;

interface EightDRow {
  id: string;
  code: string;
  title: string;
  ncr_id: string | null;
  status: string;
  team_lead_id: string | null;
  champion_id: string | null;
  member_ids: string[];
  started_at: Date | null;
  target_at: Date | null;
  current_step: number;
  steps: Steps;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const EIGHT_D_COLUMNS = `id, code, title, ncr_id, status, team_lead_id, champion_id, member_ids,
  started_at, target_at, current_step, steps, lock_version, created_at, updated_at`;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function toDto(row: EightDRow): EightDDto {
  const steps: Record<string, EightDStepDto> = {};
  for (const [key, step] of Object.entries(row.steps)) {
    steps[key] = {
      status: step.status,
      completedAt: step.completedAt ?? null,
      completedBy: step.completedBy ?? null,
      ...(step.data !== undefined ? { data: step.data } : {}),
    };
  }
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    ncrId: row.ncr_id,
    status: row.status as EightDStatus,
    teamLeadId: row.team_lead_id,
    championId: row.champion_id,
    memberIds: row.member_ids,
    startedAt: iso(row.started_at),
    targetAt: iso(row.target_at),
    currentStep: row.current_step,
    steps,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function statusesOf(steps: Steps): StepStatuses {
  const out: StepStatuses = {};
  for (const step of EIGHT_D_STEPS) out[step] = steps[step]?.status ?? "pending";
  return out;
}

/**
 * 8D problem-solving (02 §4, 03 §10). The eight disciplines are stored as a
 * `steps` jsonb; completing one is gated by `canCompleteStep` in packages/core
 * (strictly in order, except D3 may run parallel to D2). An 8D opened from an
 * NCR links it and — while still `active` — blocks that NCR from closing
 * (enforced in `ncrMachine`); completing or cancelling the 8D releases the
 * block. 8Ds are not plant-scoped; they ride the NCR capabilities (`ncr:view`
 * to read, `ncr:manage` to run) since an 8D is the deep problem-solving on an
 * NCR and the RBAC matrix has no separate row for it.
 */
@Injectable()
export class EightDService {
  async list(
    tx: Tx,
    opts: { status?: string; ncrId?: string; cursor?: string; limit: number },
  ): Promise<Page<EightDDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.ncrId !== undefined) {
      params.push(opts.ncrId);
      where += ` AND ncr_id = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<EightDRow>(
      `SELECT ${EIGHT_D_COLUMNS} FROM eight_ds ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }

  async get(tx: Tx, id: string): Promise<EightDDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateEightDBody,
    context: AuditContext,
  ): Promise<EightDDto> {
    for (const uid of [body.teamLeadId, body.championId, ...(body.memberIds ?? [])]) {
      if (uid != null) await this.assertMember(tx, uid);
    }

    let ncrId: string | null = null;
    if (body.ncrId !== undefined) {
      ncrId = await this.loadUnlinkedNcr(tx, body.ncrId);
    }

    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();
    const steps: Steps = {};
    for (const step of EIGHT_D_STEPS) steps[step] = { status: "pending" };

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "eight_d",
        entityId: id,
        action: "created",
        after: { title: body.title, ncrId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'eight_d', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an 8D code");

        const { rows } = await t.query<EightDRow>(
          `INSERT INTO eight_ds
             (id, tenant_id, code, title, ncr_id, status, team_lead_id, champion_id, member_ids,
              started_at, target_at, current_step, steps, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,1,$11,$12,$12)
           RETURNING ${EIGHT_D_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("eight_d", year, seq),
            body.title,
            ncrId,
            body.teamLeadId ?? null,
            body.championId ?? null,
            body.memberIds ?? [],
            now,
            body.targetAt ?? null,
            JSON.stringify(steps),
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "8D was not created");

        if (ncrId !== null) {
          const linked = await t.query(
            "UPDATE ncrs SET eight_d_id = $1 WHERE id = $2 AND eight_d_id IS NULL",
            [id, ncrId],
          );
          if (linked.rowCount === 0) {
            throw new ApiError("CONFLICT", "That NCR already has an 8D");
          }
        }
        return toDto(row);
      },
    );
  }

  async updateStep(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    stepN: number,
    body: UpdateEightDStepBody,
    context: AuditContext,
  ): Promise<EightDDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    if (row.status !== "active") {
      throw new ApiError("INVALID_TRANSITION", "This 8D is not active; its disciplines are frozen");
    }
    this.assertVersion(row.lock_version, body.version);

    const key = stepKey(stepN);
    const current = row.steps[key] ?? { status: "pending" };

    if (body.status === "complete") {
      const decision = canCompleteStep(stepN, statusesOf(row.steps));
      if (!decision.ok) throw ApiError.from(decision);
    }

    const next: StepObject = {
      status: body.status,
      completedAt: body.status === "complete" ? new Date().toISOString() : null,
      completedBy: body.status === "complete" ? actorId : null,
      ...(body.data !== undefined ? { data: body.data } : current.data !== undefined ? { data: current.data } : {}),
    };
    const steps: Steps = { ...row.steps, [key]: next };
    const currentStep = Math.max(row.current_step, stepN);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "eight_d",
        entityId: id,
        action: "updated",
        before: { step: key, status: current.status },
        after: { step: key, status: body.status },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<EightDRow>(
          `UPDATE eight_ds SET steps = $3, current_step = $4, updated_by = $5
            WHERE id = $1 AND lock_version = $2
            RETURNING ${EIGHT_D_COLUMNS}`,
          [id, body.version, JSON.stringify(steps), currentStep, actorId],
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("STALE_WRITE", "The 8D changed since you loaded it");
        return toDto(updated);
      },
    );
  }

  async transition(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: TransitionEightDBody,
    context: AuditContext,
  ): Promise<EightDDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    if (row.status !== "active") {
      throw new ApiError("INVALID_TRANSITION", `An 8D that is '${row.status}' cannot change state`);
    }
    this.assertVersion(row.lock_version, body.version);

    if (body.to === "completed" && !allStepsComplete(statusesOf(row.steps))) {
      throw new ApiError("INVALID_TRANSITION", "All eight disciplines must be complete before an 8D can be completed", {
        requires: "all_steps_complete",
      });
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "eight_d",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status: body.to },
        reason: body.reason ?? null,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<EightDRow>(
          `UPDATE eight_ds SET status = $3, updated_by = $4 WHERE id = $1 AND lock_version = $2
            RETURNING ${EIGHT_D_COLUMNS}`,
          [id, body.version, body.to, actorId],
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("STALE_WRITE", "The 8D changed since you loaded it");
        return toDto(updated);
      },
    );
  }

  // --- internals ------------------------------------------------------------

  private async fetch(tx: Tx, id: string): Promise<EightDRow | null> {
    const { rows } = await tx.query<EightDRow>(
      `SELECT ${EIGHT_D_COLUMNS} FROM eight_ds WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async loadUnlinkedNcr(tx: Tx, ncrId: string): Promise<string> {
    const { rows } = await tx.query<{ id: string; eight_d_id: string | null }>(
      "SELECT id, eight_d_id FROM ncrs WHERE id = $1 AND deleted_at IS NULL",
      [ncrId],
    );
    const ncr = rows[0];
    if (ncr === undefined) throw new ApiError("VALIDATION_FAILED", "Unknown NCR");
    if (ncr.eight_d_id !== null) throw new ApiError("CONFLICT", "That NCR already has an 8D");
    return ncr.id;
  }

  private async assertMember(tx: Tx, userId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId],
    );
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ApiError("STALE_WRITE", "The record changed since you loaded it", { expected, actual });
    }
  }
}
