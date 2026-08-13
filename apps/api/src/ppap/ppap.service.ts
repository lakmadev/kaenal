import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  counterYear,
  formatCode,
  ppapCompleteness,
  ppapDaysOpen,
  isPpapApprovable,
  seedPpapElements,
  type PpapElementState,
} from "@kaenal/core";
import type {
  CreatePpapBody,
  Page,
  PpapDecisionBody,
  PpapElementDto,
  PpapStatus,
  PpapSubmissionDto,
  UpdatePpapBody,
  UpdatePpapElementBody,
} from "@kaenal/types";
import { PpapElementDto as PpapElementSchema, PpapAiPrediction as PpapAiPredictionSchema } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface PpapRow {
  id: string;
  code: string | null;
  supplier_id: string;
  supplier_name: string | null;
  part_number: string;
  part_rev: string | null;
  program_name: string | null;
  level: number;
  customer: string | null;
  status: string;
  submitted_date: string | null;
  due_date: string | null;
  approved_date: string | null;
  owner: string | null;
  elements: unknown;
  ai_prediction: Record<string, unknown> | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

// Date columns cast to text so pg returns a plain 'YYYY-MM-DD' rather than a
// timezone-shifted Date. `supplier_name` is a correlated subquery (not a JOIN)
// so `ppap_submissions p` stays the ONLY table in FROM — the shared keyset
// predicate emits an unqualified `(created_at, id)`, which a join would make
// ambiguous. The subquery is RLS-scoped the same way the table is.
const PPAP_COLUMNS = `p.id, p.code, p.supplier_id,
  (SELECT s.name FROM suppliers s WHERE s.id = p.supplier_id AND s.tenant_id = p.tenant_id) AS supplier_name,
  p.part_number, p.part_rev, p.program_name, p.level, p.customer, p.status,
  p.submitted_date::text AS submitted_date, p.due_date::text AS due_date, p.approved_date::text AS approved_date,
  p.owner, p.elements, p.ai_prediction, p.lock_version, p.created_at, p.updated_at`;

const FROM = `ppap_submissions p`;

/** Parse the inline elements jsonb into typed DTOs (tolerant of the legacy `{}`). */
function parseElements(raw: unknown): PpapElementDto[] {
  if (!Array.isArray(raw)) return [];
  const out: PpapElementDto[] = [];
  for (const e of raw) {
    const parsed = PpapElementSchema.safeParse(e);
    if (parsed.success) out.push(parsed.data);
  }
  return out.sort((a, b) => a.id - b.id);
}

function toPpapDto(row: PpapRow, now: Date = new Date()): PpapSubmissionDto {
  const elements = parseElements(row.elements);
  const states: PpapElementState[] = elements.map((e) => ({ id: e.id, status: e.status }));
  return {
    id: row.id,
    code: row.code,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    partNumber: row.part_number,
    partRev: row.part_rev,
    programName: row.program_name,
    level: row.level,
    customer: row.customer,
    status: row.status as PpapStatus,
    submittedDate: row.submitted_date,
    dueDate: row.due_date,
    approvedDate: row.approved_date,
    owner: row.owner,
    elements,
    aiPrediction: PpapAiPredictionSchema.parse(row.ai_prediction ?? {}),
    daysOpen: ppapDaysOpen(row.submitted_date, now),
    completeness: ppapCompleteness(states),
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * PPAP submissions (FEATURES §11.2, P09). Tenant-wide like suppliers — RLS is the
 * only isolation, a foreign-tenant id is 404 (rule 8). `ppap:view` reads;
 * `ppap:manage` (admin/manager/auditor) creates, edits elements, and decides. The
 * 18 elements live inline in the `elements` jsonb; the approvability rule is the
 * pure `packages/core` completeness check, not a query.
 */
@Injectable()
export class PpapService {
  async list(
    tx: Tx,
    opts: {
      supplierId?: string;
      status?: string;
      customer?: string;
      level?: number;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<PpapSubmissionDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE p.deleted_at IS NULL";

    if (opts.supplierId !== undefined) {
      params.push(opts.supplierId);
      where += ` AND p.supplier_id = $${params.length}`;
    }
    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND p.status = $${params.length}`;
    }
    if (opts.customer !== undefined) {
      params.push(opts.customer);
      where += ` AND p.customer = $${params.length}`;
    }
    if (opts.level !== undefined) {
      params.push(opts.level);
      where += ` AND p.level = $${params.length}`;
    }
    if (opts.q !== undefined) {
      params.push(`%${opts.q}%`);
      where += ` AND (p.part_number ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.program_name ILIKE $${params.length})`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<PpapRow>(
      `SELECT ${PPAP_COLUMNS} FROM ${FROM} ${where} ${keyset.sql}
        ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, (r) => toPpapDto(r));
  }

  async get(tx: Tx, id: string): Promise<PpapSubmissionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toPpapDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreatePpapBody,
    context: AuditContext,
  ): Promise<PpapSubmissionDto> {
    // Cross-tenant / missing supplier is invisible under RLS → 404 (rule 8).
    const { rows: supplier } = await tx.query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = $1 AND deleted_at IS NULL`,
      [body.supplierId],
    );
    if (supplier[0] === undefined) throw notFound();

    const now = new Date();
    const year = counterYear(now, "UTC");
    const id = randomUUID();
    const elements = seedPpapElements();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ppap_submission",
        entityId: id,
        action: "created",
        after: { partNumber: body.partNumber, supplierId: body.supplierId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        let code = body.code;
        if (code === undefined) {
          const { rows: counter } = await t.query<{ value: number }>(
            `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'ppap', $2, 1)
             ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
             RETURNING value`,
            [tenantId, year],
          );
          const seq = counter[0]?.value;
          if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a PPAP code");
          code = formatCode("ppap", year, seq);
        }

        try {
          const { rows } = await t.query<PpapRow>(
            `WITH ins AS (
               INSERT INTO ppap_submissions
                 (id, tenant_id, code, supplier_id, part_number, part_rev, program_name, level, customer,
                  status, submitted_date, due_date, owner, elements, created_by, updated_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'pending'),$11,$12,$13,$14::jsonb,$15,$15)
               RETURNING *
             )
             SELECT ${PPAP_COLUMNS} FROM ins p`,
            [
              id,
              tenantId,
              code,
              body.supplierId,
              body.partNumber,
              body.partRev ?? null,
              body.programName ?? null,
              body.level,
              body.customer ?? null,
              body.status ?? null,
              body.submittedDate ?? null,
              body.dueDate ?? null,
              body.owner ?? null,
              JSON.stringify(elements),
              actorId,
            ],
          );
          const row = rows[0];
          if (row === undefined) throw new ApiError("INTERNAL", "PPAP submission was not created");
          return toPpapDto(row);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ApiError("CONFLICT", `A PPAP submission with code '${code}' already exists`);
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
    body: UpdatePpapBody,
    context: AuditContext,
  ): Promise<PpapSubmissionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    const sets: string[] = [];
    const params: unknown[] = [id, body.version];
    const set = (col: string, value: unknown): void => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (body.partNumber !== undefined) set("part_number", body.partNumber);
    if (body.level !== undefined) set("level", body.level);
    if (body.partRev !== undefined) set("part_rev", body.partRev);
    if (body.programName !== undefined) set("program_name", body.programName);
    if (body.customer !== undefined) set("customer", body.customer);
    if (body.status !== undefined) set("status", body.status);
    if (body.submittedDate !== undefined) set("submitted_date", body.submittedDate);
    if (body.dueDate !== undefined) set("due_date", body.dueDate);
    if (body.owner !== undefined) set("owner", body.owner);

    params.push(actorId);
    sets.push(`updated_by = $${params.length}`);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ppap_submission",
        entityId: id,
        action: "updated",
        before: { status: row.status },
        after: { status: body.status ?? row.status },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, sets, params),
    );
  }

  /** Set one element's status / reviewer / comment. Optimistic on the submission. */
  async updateElement(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    elementNo: number,
    body: UpdatePpapElementBody,
    context: AuditContext,
  ): Promise<PpapSubmissionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    const elements = parseElements(row.elements);
    const idx = elements.findIndex((e) => e.id === elementNo);
    if (idx === -1) throw notFound();
    const current = elements[idx]!;
    const next: PpapElementDto = {
      ...current,
      status: body.status,
      ...(body.reviewer !== undefined ? { reviewer: body.reviewer } : {}),
      ...(body.comment !== undefined ? { comment: body.comment } : {}),
    };
    elements[idx] = next;

    const params: unknown[] = [id, body.version, JSON.stringify(elements), actorId];

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ppap_submission",
        entityId: id,
        action: "updated",
        before: { element: elementNo, status: current.status },
        after: { element: elementNo, status: body.status },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, ["elements = $3::jsonb", "updated_by = $4"], params),
    );
  }

  /**
   * Overall approve/reject. Approve is refused unless every non-N/A element is
   * approved (the core completeness rule) — a package cannot be warranted while
   * elements are still pending or have changes requested.
   */
  async decide(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: PpapDecisionBody,
    context: AuditContext,
  ): Promise<PpapSubmissionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row, body.version);

    const elements = parseElements(row.elements).map((e) => ({ id: e.id, status: e.status }));
    if (body.decision === "approve" && !isPpapApprovable(elements)) {
      throw new ApiError(
        "VALIDATION_FAILED",
        "Cannot approve: every non-N/A element must be approved first",
        { ...ppapCompleteness(elements) },
      );
    }

    const status: PpapStatus = body.decision === "approve" ? "approved" : "rejected";
    const sets = ["status = $3", "updated_by = $4"];
    const params: unknown[] = [id, body.version, status, actorId];
    if (body.decision === "approve") {
      // Stamp the approval date (today) only on approve.
      sets.push("approved_date = CURRENT_DATE");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ppap_submission",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status },
        ...(body.reason != null ? { reason: body.reason } : {}),
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.writeAndReturn(t, sets, params),
    );
  }

  private assertVersion(row: PpapRow, version: number): void {
    if (row.lock_version !== version) {
      throw new ApiError("STALE_WRITE", "The PPAP submission changed since you loaded it", {
        expected: version,
        actual: row.lock_version,
      });
    }
  }

  private async writeAndReturn(t: Tx, sets: string[], params: unknown[]): Promise<PpapSubmissionDto> {
    const { rows } = await t.query<PpapRow>(
      `WITH upd AS (
         UPDATE ppap_submissions SET ${sets.join(", ")} WHERE id = $1 AND lock_version = $2
         RETURNING *
       )
       SELECT ${PPAP_COLUMNS} FROM upd p`,
      params,
    );
    const updated = rows[0];
    if (updated === undefined) throw new ApiError("STALE_WRITE", "The PPAP submission changed since you loaded it");
    return toPpapDto(updated);
  }

  private async fetch(tx: Tx, id: string): Promise<PpapRow | null> {
    const { rows } = await tx.query<PpapRow>(
      `SELECT ${PPAP_COLUMNS} FROM ${FROM} WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}
