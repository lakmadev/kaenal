import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  bumpMinorVersion,
  counterYear,
  ECN_GATED_STAGES,
  ECN_STAGE_ORDER,
  formatCode,
  isBumpableVersion,
  type Membership,
} from "@kaenal/core";
import type {
  AutoReviseResult,
  CreateEcnBody,
  DecideEcnApprovalBody,
  EcnApprovalDto,
  EcnAutoReviseSkipReason,
  EcnDto,
  EcnLinkBody,
  EcnLinkDto,
  EcnStage,
  EcnSummaryDto,
  Page,
  UpdateEcnBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { staleWriteError } from "../stale-write.js";
import { assertEntityVisible } from "../collab/entity-ref.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";
import type { DocumentsService } from "../documents/documents.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";

interface EcnRow {
  id: string;
  code: string;
  title: string;
  change_type: string;
  description: string;
  change_risk: string;
  stage: string;
  owner: string;
  created_by: string | null;
  effective_date: string | null;
  auto_revise_result: AutoReviseResult | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
  linked_document_count: string | undefined;
}

const ECN_COLUMNS = `id, code, title, change_type, description, change_risk, stage, owner, created_by,
  effective_date::text AS effective_date, auto_revise_result, lock_version, created_at, updated_at`;

const ECN_COLUMNS_WITH_COUNT = `${ECN_COLUMNS},
  (SELECT count(*) FROM entity_links WHERE from_kind = 'ecn' AND to_kind = 'document' AND from_id = ecns.id)::text
    AS linked_document_count`;

function toEcnDto(row: EcnRow): EcnDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    changeType: row.change_type as EcnDto["changeType"],
    description: row.description,
    changeRisk: row.change_risk as EcnDto["changeRisk"],
    stage: row.stage as EcnStage,
    owner: row.owner,
    effectiveDate: row.effective_date,
    linkedDocumentCount: Number(row.linked_document_count ?? "0"),
    autoReviseResult: row.auto_revise_result,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface ApprovalRow {
  id: string;
  ecn_id: string;
  stage: string;
  decision: string;
  approver: string | null;
  decided_at: Date | null;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

const APPROVAL_COLUMNS = "id, ecn_id, stage, decision, approver, decided_at, comment, created_at, updated_at";

function toApprovalDto(row: ApprovalRow): EcnApprovalDto {
  return {
    id: row.id,
    ecnId: row.ecn_id,
    stage: row.stage as EcnApprovalDto["stage"],
    decision: row.decision as EcnApprovalDto["decision"],
    approver: row.approver,
    decidedAt: row.decided_at?.toISOString() ?? null,
    comment: row.comment,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface LinkRow {
  id: string;
  to_kind: string;
  to_id: string;
  created_at: Date;
}

function toLinkDto(row: LinkRow): EcnLinkDto {
  return { id: row.id, kind: row.to_kind as EcnLinkDto["kind"], targetId: row.to_id, createdAt: row.created_at.toISOString() };
}

/** Stages before which linking/unlinking is allowed — draft through pilot,
 *  frozen from implementation onward (§0 S2, tightened from "past pilot"). */
const LINK_ALLOWED_STAGES = new Set<EcnStage>(["draft", "feasibility", "risk_review", "ppap", "cab_approval", "pilot"]);

/**
 * Engineering Change Notices (SPRINT-06 E1-E5, P19). Reads need `ecn:view`,
 * author/manage actions `ecn:manage`, the 5 gated stages' decisions
 * `ecn:approve` (admin/manager only). Not plant-scoped.
 */
@Injectable()
export class EcnService {
  constructor(
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async loadRow(tx: Tx, id: string): Promise<EcnRow> {
    const { rows } = await tx.query<EcnRow>(
      `SELECT ${ECN_COLUMNS_WITH_COUNT} FROM ecns WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  /** Plain read, no lock — used only for post-failure error classification,
   *  never as the basis for a write decision (§3.2 item 2). */
  private async peekRow(tx: Tx, id: string): Promise<EcnRow | null> {
    const { rows } = await tx.query<EcnRow>(`SELECT ${ECN_COLUMNS} FROM ecns WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return rows[0] ?? null;
  }

  private async assertMember(tx: Tx, userId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId],
    );
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
  }

  async list(
    tx: Tx,
    opts: {
      changeType?: string;
      stage?: string;
      changeRisk?: string;
      owner?: string;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<EcnDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;

    const params: unknown[] = [];
    let where = "WHERE ecns.deleted_at IS NULL";
    if (opts.changeType !== undefined) {
      params.push(opts.changeType);
      where += ` AND change_type = $${params.length}`;
    }
    if (opts.stage !== undefined) {
      params.push(opts.stage);
      where += ` AND stage = $${params.length}`;
    }
    if (opts.changeRisk !== undefined) {
      params.push(opts.changeRisk);
      where += ` AND change_risk = $${params.length}`;
    }
    if (opts.owner !== undefined) {
      params.push(opts.owner);
      where += ` AND owner = $${params.length}`;
    }
    if (opts.q !== undefined) {
      params.push(opts.q);
      where += ` AND search_vector @@ websearch_to_tsquery('english', $${params.length})`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<EcnRow>(
      `SELECT ${ECN_COLUMNS_WITH_COUNT} FROM ecns ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toEcnDto);
  }

  async summary(tx: Tx): Promise<EcnSummaryDto> {
    const { rows } = await tx.query<{ stage: string; n: string }>(
      "SELECT stage, count(*)::text AS n FROM ecns WHERE deleted_at IS NULL GROUP BY stage",
    );
    const counts = new Map(rows.map((r) => [r.stage, Number(r.n)]));
    return {
      draft: counts.get("draft") ?? 0,
      feasibility: counts.get("feasibility") ?? 0,
      risk_review: counts.get("risk_review") ?? 0,
      ppap: counts.get("ppap") ?? 0,
      cab_approval: counts.get("cab_approval") ?? 0,
      pilot: counts.get("pilot") ?? 0,
      implementation: counts.get("implementation") ?? 0,
      closed: counts.get("closed") ?? 0,
      rejected: counts.get("rejected") ?? 0,
    };
  }

  async get(tx: Tx, id: string): Promise<EcnDto> {
    return toEcnDto(await this.loadRow(tx, id));
  }

  async create(tx: Tx, tenantId: string, actorId: string, body: CreateEcnBody, context: AuditContext): Promise<EcnDto> {
    await this.assertMember(tx, body.owner);

    const id = randomUUID();
    const now = new Date();
    const year = counterYear(now, "UTC");

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ecn",
        entityId: id,
        action: "created",
        after: { title: body.title, changeType: body.changeType, changeRisk: body.changeRisk },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'ecn', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an ECN code");

        const { rows } = await t.query<EcnRow>(
          `INSERT INTO ecns
             (id, tenant_id, code, title, change_type, description, change_risk, owner, effective_date,
              created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
           RETURNING ${ECN_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("ecn", year, seq),
            body.title,
            body.changeType,
            body.description ?? "",
            body.changeRisk,
            body.owner,
            body.effectiveDate ?? null,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "ECN was not created");

        // All 5 gated-stage approval rows are pre-created pending, in the same
        // transaction (E4 AC1).
        for (const stage of ECN_GATED_STAGES) {
          await t.query(
            `INSERT INTO ecn_approvals (id, tenant_id, ecn_id, stage, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$5)`,
            [randomUUID(), tenantId, id, stage, actorId],
          );
        }

        return toEcnDto({ ...row, linked_document_count: "0" });
      },
    );
  }

  async update(tx: Tx, tenantId: string, actorId: string, id: string, body: UpdateEcnBody, context: AuditContext): Promise<EcnDto> {
    const current = await this.loadRow(tx, id);
    if (current.lock_version !== body.lockVersion) {
      throw await staleWriteError(tx, {
        table: "ecns",
        key: id,
        message: "This ECN changed since you loaded it",
        expected: body.lockVersion,
        actual: current.lock_version,
      });
    }
    // Fully frozen once closed or rejected (§0 S4).
    if (current.stage === "closed" || current.stage === "rejected") {
      throw new ApiError("VALIDATION_FAILED", "This ECN can no longer be edited", { stage: current.stage });
    }
    const draftOnlyFieldsProvided = body.changeType !== undefined || body.changeRisk !== undefined || body.owner !== undefined;
    if (draftOnlyFieldsProvided && current.stage !== "draft") {
      throw new ApiError("VALIDATION_FAILED", "changeType/changeRisk/owner can only change while the ECN is in draft", {
        stage: current.stage,
      });
    }
    if (body.owner !== undefined) await this.assertMember(tx, body.owner);

    const next = {
      title: body.title ?? current.title,
      description: body.description ?? current.description,
      effectiveDate: body.effectiveDate !== undefined ? body.effectiveDate : current.effective_date,
      changeType: body.changeType ?? current.change_type,
      changeRisk: body.changeRisk ?? current.change_risk,
      owner: body.owner ?? current.owner,
    };

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ecn",
        entityId: id,
        action: "updated",
        before: { title: current.title, changeType: current.change_type, changeRisk: current.change_risk, owner: current.owner },
        after: { title: next.title, changeType: next.changeType, changeRisk: next.changeRisk, owner: next.owner },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<EcnRow>(
          `UPDATE ecns
              SET title = $2, description = $3, effective_date = $4, change_type = $5, change_risk = $6,
                  owner = $7, updated_by = $8
            WHERE id = $1 AND lock_version = $9
            RETURNING ${ECN_COLUMNS}`,
          [id, next.title, next.description, next.effectiveDate, next.changeType, next.changeRisk, next.owner, actorId, body.lockVersion],
        );
        const row = rows[0];
        if (row === undefined) throw await staleWriteError(t, { table: "ecns", key: id, message: "This ECN changed since you loaded it" });
        return toEcnDto({ ...row, linked_document_count: current.linked_document_count });
      },
    );
  }

  // --- plain lifecycle: submit / withdraw / close / resubmit -----------------

  private async plainTransition(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    lockVersion: number,
    fromStage: EcnStage,
    toStage: EcnStage,
    context: AuditContext,
  ): Promise<EcnRow> {
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ecn",
        entityId: id,
        action: "status_changed",
        before: { stage: fromStage },
        after: { stage: toStage },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<EcnRow>(
          `UPDATE ecns SET stage = $2, updated_by = $3
            WHERE id = $1 AND lock_version = $4 AND stage = $5
            RETURNING ${ECN_COLUMNS}`,
          [id, toStage, actorId, lockVersion, fromStage],
        );
        const row = rows[0];
        if (row !== undefined) return row;

        const peek = await this.peekRow(t, id);
        if (peek === null) throw notFound();
        if (peek.lock_version !== lockVersion) {
          throw await staleWriteError(t, { table: "ecns", key: id, message: "This ECN changed since you loaded it", expected: lockVersion, actual: peek.lock_version });
        }
        throw new ApiError("INVALID_TRANSITION", `ECN is not currently '${fromStage}'`, { stage: peek.stage });
      },
    );
  }

  async submit(tx: Tx, tenantId: string, actorId: string, id: string, lockVersion: number, context: AuditContext): Promise<EcnDto> {
    const before = await this.loadRow(tx, id);
    const row = await this.plainTransition(tx, tenantId, actorId, id, lockVersion, "draft", "feasibility", context);

    // Notify every ecn:approve holder except owner/created_by, the moment the
    // ECN actually lands on feasibility — never at creation (§0 S7/X1 AC7).
    const { rows: approvers } = await tx.query<{ user_id: string }>(
      `SELECT m.user_id FROM memberships m
        WHERE m.status = 'active' AND m.role IN ('admin','manager')
          AND m.user_id <> $1 AND ($2::uuid IS NULL OR m.user_id <> $2)`,
      [row.owner, row.created_by],
    );
    for (const a of approvers) {
      await this.notifications.notify(tx, tenantId, {
        userId: a.user_id,
        kind: "ecn_approval_pending",
        title: `ECN ${row.code} is awaiting your approval`,
        entityKind: "ecn",
        entityId: id,
        actorId,
        dedupeKey: `ecn-approval-pending:${id}:${row.lock_version}:${a.user_id}`,
      });
    }
    return toEcnDto({ ...row, linked_document_count: before.linked_document_count });
  }

  async withdraw(tx: Tx, tenantId: string, actorId: string, id: string, lockVersion: number, context: AuditContext): Promise<EcnDto> {
    const before = await this.loadRow(tx, id);
    const row = await this.plainTransition(tx, tenantId, actorId, id, lockVersion, "draft", "rejected", context);
    return toEcnDto({ ...row, linked_document_count: before.linked_document_count });
  }

  async close(tx: Tx, tenantId: string, actorId: string, id: string, lockVersion: number, context: AuditContext): Promise<EcnDto> {
    const before = await this.loadRow(tx, id);
    const row = await this.plainTransition(tx, tenantId, actorId, id, lockVersion, "implementation", "closed", context);
    return toEcnDto({ ...row, linked_document_count: before.linked_document_count });
  }

  async resubmit(tx: Tx, tenantId: string, actorId: string, id: string, lockVersion: number, context: AuditContext): Promise<EcnDto> {
    const before = await this.loadRow(tx, id);

    // Read the 5 approval rows BEFORE resetting (§0b D3b) — to capture each
    // one's prior decision for the per-row audit events.
    const { rows: approvals } = await tx.query<ApprovalRow>(
      `SELECT ${APPROVAL_COLUMNS} FROM ecn_approvals WHERE ecn_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const notAlreadyPending = approvals.filter((a) => a.decision !== "pending");

    const events = [
      {
        actorId,
        actorKind: "user" as const,
        entityKind: "ecn",
        entityId: id,
        action: "status_changed" as const,
        before: { stage: "rejected" },
        after: { stage: "draft" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      ...notAlreadyPending.map((a) => ({
        actorId,
        actorKind: "user" as const,
        entityKind: "ecn_approval",
        entityId: a.id,
        action: "updated" as const,
        before: { decision: a.decision, approver: a.approver, decidedAt: a.decided_at?.toISOString() ?? null, comment: a.comment },
        after: { decision: "pending", approver: null, decidedAt: null, comment: null },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      })),
    ];

    return withAudit(tx, tenantId, events, async (t) => {
      const { rows } = await t.query<EcnRow>(
        `UPDATE ecns SET stage = 'draft', updated_by = $2
          WHERE id = $1 AND lock_version = $3 AND stage = 'rejected'
          RETURNING ${ECN_COLUMNS}`,
        [id, actorId, lockVersion],
      );
      const row = rows[0];
      if (row === undefined) {
        const peek = await this.peekRow(t, id);
        if (peek === null) throw notFound();
        if (peek.lock_version !== lockVersion) {
          throw await staleWriteError(t, { table: "ecns", key: id, message: "This ECN changed since you loaded it", expected: lockVersion, actual: peek.lock_version });
        }
        throw new ApiError("INVALID_TRANSITION", "ECN is not currently 'rejected'", { stage: peek.stage });
      }
      await t.query(
        `UPDATE ecn_approvals SET decision = 'pending', approver = NULL, decided_at = NULL, comment = NULL, updated_by = $2
          WHERE ecn_id = $1`,
        [id, actorId],
      );
      return toEcnDto({ ...row, linked_document_count: before.linked_document_count });
    });
  }

  // --- approvals ---------------------------------------------------------

  async listApprovals(tx: Tx, id: string): Promise<EcnApprovalDto[]> {
    await this.loadRow(tx, id); // 404 on a foreign/unknown id
    const order = new Map(ECN_GATED_STAGES.map((s, i) => [s, i]));
    const { rows } = await tx.query<ApprovalRow>(
      `SELECT ${APPROVAL_COLUMNS} FROM ecn_approvals WHERE ecn_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows
      .slice()
      .sort((a, b) => (order.get(a.stage as EcnStage) ?? 0) - (order.get(b.stage as EcnStage) ?? 0))
      .map(toApprovalDto);
  }

  /**
   * Approve or reject the ECN's CURRENT gated stage (§3.2 item 2 — exact
   * statement order). Role guard first (not row-dependent). The four-eyes
   * check is folded directly into the transition UPDATE's own WHERE clause —
   * never a separate unlocked read beforehand.
   */
  async decideApproval(
    tx: Tx,
    tenantId: string,
    actorRole: string,
    actorId: string,
    id: string,
    stage: string,
    body: DecideEcnApprovalBody,
    context: AuditContext,
  ): Promise<EcnDto> {
    // (a) Role guard first — a role check, not row-dependent, no TOCTOU risk.
    if (actorRole !== "admin" && actorRole !== "manager") {
      throw new ApiError("FORBIDDEN", "Only an admin or manager can approve or reject an ECN stage", {
        requiredRole: ["admin", "manager"],
      });
    }

    const before = await this.loadRow(tx, id);
    const gatedStage = stage as EcnStage;
    const stageIdx = ECN_STAGE_ORDER.indexOf(gatedStage);
    const nextStage: EcnStage = body.decision === "reject" ? "rejected" : (ECN_STAGE_ORDER[stageIdx + 1] as EcnStage);

    // Mutable "after" payload for the ecn's own status_changed event — the
    // autoReviseResult isn't known until the mutation runs (pilot->implementation
    // only), so it is filled in by the mutation closure before withAudit reads
    // the event list back out (withAudit runs the mutation BEFORE writing
    // events, so this mutation happens-before the audit insert).
    const afterEcn: Record<string, unknown> = { stage: nextStage };
    const afterApproval: Record<string, unknown> = { decision: body.decision === "approve" ? "approved" : "rejected", comment: body.comment ?? null };
    // Mutable holder for the approval row's id — unknown until the mutation
    // runs, corrected in place before withAudit reads the event back out.
    const approvalEventId = { current: id };

    const ecnEvent = {
      actorId,
      actorKind: "user" as const,
      entityKind: "ecn",
      entityId: id,
      action: "status_changed" as const,
      before: { stage: gatedStage },
      after: afterEcn,
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
    };
    const approvalEvent = {
      actorId,
      actorKind: "user" as const,
      entityKind: "ecn_approval",
      get entityId() {
        return approvalEventId.current;
      },
      action: "updated" as const,
      before: { decision: "pending" },
      after: afterApproval,
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
    };
    const events = [ecnEvent, approvalEvent];

    return withAudit(tx, tenantId, events, async (t) => {
      // (b) The four-eyes check folded atomically into the WHERE clause —
      // `created_by IS DISTINCT FROM` (not `<>`) because `created_by` is
      // nullable and a plain `<>` against NULL is never true, which would
      // wrongly make such an ECN permanently unapprovable by anyone.
      const { rows } = await t.query<EcnRow>(
        `UPDATE ecns SET stage = $2, updated_by = $3
          WHERE id = $1 AND lock_version = $4 AND stage = $5
            AND owner <> $3 AND created_by IS DISTINCT FROM $3
          RETURNING ${ECN_COLUMNS}`,
        [id, nextStage, actorId, body.lockVersion, gatedStage],
      );
      const row = rows[0];
      if (row === undefined) {
        const peek = await this.peekRow(t, id);
        if (peek === null) throw notFound();
        if (peek.lock_version !== body.lockVersion) {
          throw await staleWriteError(t, { table: "ecns", key: id, message: "This ECN changed since you loaded it", expected: body.lockVersion, actual: peek.lock_version });
        }
        if (peek.stage !== gatedStage) {
          throw new ApiError("INVALID_TRANSITION", `Stage '${gatedStage}' is not the current pending stage`, { stage: peek.stage });
        }
        throw new ApiError("FORBIDDEN", "An ECN cannot be approved or rejected by its own owner or creator", { requires: "four_eyes" });
      }

      const { rows: approvalRows } = await t.query<ApprovalRow>(
        `UPDATE ecn_approvals SET decision = $4, approver = $3, decided_at = now(), comment = $5, updated_by = $3
          WHERE ecn_id = $1 AND stage = $2 AND decision = 'pending'
          RETURNING ${APPROVAL_COLUMNS}`,
        [id, gatedStage, actorId, body.decision === "approve" ? "approved" : "rejected", body.comment ?? null],
      );
      const approvalRow = approvalRows[0];
      if (approvalRow === undefined) throw new ApiError("INTERNAL", "Approval row was not updated");
      // Correct the placeholder entity id now that the row is known — this
      // mutates the SAME object withAudit will read back for its INSERT.
      approvalEventId.current = approvalRow.id;

      let autoReviseResult: AutoReviseResult | null = null;
      if (gatedStage === "pilot" && nextStage === "implementation") {
        autoReviseResult = await this.runAutoRevise(t, tenantId, id, row.code, actorId, context);
        afterEcn["autoReviseResult"] = autoReviseResult;
        await t.query("UPDATE ecns SET auto_revise_result = $2 WHERE id = $1", [id, JSON.stringify(autoReviseResult)]);
      }

      return toEcnDto({ ...row, linked_document_count: before.linked_document_count, auto_revise_result: autoReviseResult });
    });
  }

  /**
   * E5 auto-revise (§0 B3/B3c-e): for every document-kind entity_links row
   * attached to this ECN, calls DocumentsService.newVersion for real — each
   * attempt isolated in its own SAVEPOINT (precedent: purge-soft-deleted.ts's
   * purgeRow) so one document's failure never aborts the ECN transition.
   */
  private async runAutoRevise(
    tx: Tx,
    tenantId: string,
    ecnId: string,
    ecnCode: string,
    actorId: string,
    context: AuditContext,
  ): Promise<AutoReviseResult> {
    const { rows: links } = await tx.query<{ to_id: string }>(
      `SELECT to_id FROM entity_links WHERE from_kind = 'ecn' AND to_kind = 'document' AND from_id = $1 AND deleted_at IS NULL`,
      [ecnId],
    );

    const revised: string[] = [];
    const skipped: { documentId: string; reason: EcnAutoReviseSkipReason }[] = [];

    for (const link of links) {
      const documentId = link.to_id;
      let doc: { status: string; version: string; fileId: string | null; ownerId: string | null; lockVersion: number };
      try {
        const dto = await this.documents.get(tx, documentId);
        doc = { status: dto.status, version: dto.version, fileId: dto.fileId, ownerId: dto.ownerId, lockVersion: dto.lockVersion };
      } catch {
        skipped.push({ documentId, reason: "not_approved" });
        continue;
      }

      // Pre-checked, named skip conditions (§0 B3c) — never relying on
      // catching these two specific errors.
      if (doc.status !== "approved") {
        skipped.push({ documentId, reason: "not_approved" });
        continue;
      }
      if (!isBumpableVersion(doc.version)) {
        skipped.push({ documentId, reason: "bad_version_format" });
        continue;
      }
      const nextVersion = bumpMinorVersion(doc.version);
      const { rows: exists } = await tx.query(
        "SELECT 1 FROM document_versions WHERE document_id = $1 AND version = $2",
        [documentId, nextVersion],
      );
      if (exists.length > 0) {
        skipped.push({ documentId, reason: "version_exists" });
        continue;
      }

      // The actual call runs inside its own SAVEPOINT — a genuine race
      // (stale-write 409) rolls back only this document's attempt.
      await tx.query("SAVEPOINT ecn_auto_revise");
      try {
        await this.documents.newVersion(
          tx,
          tenantId,
          actorId,
          documentId,
          {
            nextVersion,
            version: doc.lockVersion,
            fileId: doc.fileId, // the document's own CURRENT file — never null (§0 B3a).
            changelog: `Auto-revised by ${ecnCode} implementation`,
            ...(doc.ownerId !== null ? { ownerId: doc.ownerId } : {}), // preserve owner (§0 B3b).
          },
          context,
        );
        await tx.query("RELEASE SAVEPOINT ecn_auto_revise");
        revised.push(documentId);
      } catch {
        await tx.query("ROLLBACK TO SAVEPOINT ecn_auto_revise");
        await tx.query("RELEASE SAVEPOINT ecn_auto_revise");
        skipped.push({ documentId, reason: "concurrent_modification" });
      }
    }

    return { revised, skipped };
  }

  // --- links ---------------------------------------------------------------

  async listLinks(tx: Tx, id: string): Promise<EcnLinkDto[]> {
    await this.loadRow(tx, id);
    const { rows } = await tx.query<LinkRow>(
      `SELECT id, to_kind, to_id, created_at FROM entity_links
        WHERE from_kind = 'ecn' AND from_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [id],
    );
    return rows.map(toLinkDto);
  }

  async link(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: EcnLinkBody,
    context: AuditContext,
  ): Promise<EcnLinkDto> {
    // SELECT ... FOR SHARE on the parent first (§0 S2) — prevents a
    // concurrent approve from advancing the stage mid-link.
    const { rows } = await tx.query<{ stage: string }>(
      "SELECT stage FROM ecns WHERE id = $1 AND deleted_at IS NULL FOR SHARE",
      [id],
    );
    const ecn = rows[0];
    if (ecn === undefined) throw notFound();
    if (!LINK_ALLOWED_STAGES.has(ecn.stage as EcnStage)) {
      throw new ApiError("VALIDATION_FAILED", "Links can only be added before implementation", { stage: ecn.stage });
    }
    await assertEntityVisible(tx, body.kind, body.targetId, membership);

    const linkId = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ecn",
        entityId: id,
        action: "linked",
        after: { toKind: body.kind, toId: body.targetId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: inserted } = await t.query<LinkRow>(
          `INSERT INTO entity_links (id, tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by, updated_by)
           VALUES ($1,$2,'ecn',$3,$4,$5,'linked',$6,$6)
           RETURNING id, to_kind, to_id, created_at`,
          [linkId, tenantId, id, body.kind, body.targetId, actorId],
        );
        const row = inserted[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Link was not created");
        return toLinkDto(row);
      },
    );
  }

  async unlink(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    linkId: string,
    context: AuditContext,
  ): Promise<EcnDto> {
    // Same FOR SHARE lock as link() (round-3/round-4 review fix — S2 gave
    // link() this lock but not unlink originally).
    const { rows } = await tx.query<{ stage: string }>(
      "SELECT stage FROM ecns WHERE id = $1 AND deleted_at IS NULL FOR SHARE",
      [id],
    );
    const ecn = rows[0];
    if (ecn === undefined) throw notFound();
    if (!LINK_ALLOWED_STAGES.has(ecn.stage as EcnStage)) {
      throw new ApiError("VALIDATION_FAILED", "Links can only be removed before implementation", { stage: ecn.stage });
    }

    const { rows: linkRows } = await tx.query<{ id: string; to_kind: string; to_id: string }>(
      `SELECT id, to_kind, to_id FROM entity_links
        WHERE id = $1 AND from_kind = 'ecn' AND from_id = $2 AND deleted_at IS NULL`,
      [linkId, id],
    );
    const link = linkRows[0];
    if (link === undefined) throw notFound();

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "ecn",
        entityId: id,
        action: "unlinked",
        before: { toKind: link.to_kind, toId: link.to_id },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      (t) => t.query("UPDATE entity_links SET deleted_at = now(), updated_by = $2 WHERE id = $1", [linkId, actorId]),
    );

    return this.get(tx, id);
  }
}
