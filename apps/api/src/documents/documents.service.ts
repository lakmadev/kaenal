import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { counterYear, documentMachine, formatCode, type Membership } from "@kaenal/core";
import type {
  CreateDocumentBody,
  DocumentCategory,
  DocumentDto,
  DocumentStatus,
  DocumentVersionDto,
  NewDocumentVersionBody,
  Page,
  ReviewDocumentBody,
  TransitionDocumentBody,
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

interface DocumentRow {
  id: string;
  code: string;
  title: string;
  category: string;
  status: string;
  version: string;
  file_id: string | null;
  owner_id: string | null;
  approver_id: string | null;
  expires_at: Date | null;
  frameworks: string[];
  ai_summary: string | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
  // Resolved from the attached file on list/get (absent on mutation RETURNING).
  file_mime?: string | null;
  file_size_bytes?: string | null; // bigint arrives as string from pg
}

const DOCUMENT_COLUMNS = `id, code, title, category, status, version, file_id, owner_id, approver_id,
  expires_at, frameworks, ai_summary, lock_version, created_at, updated_at`;

// Resolve the attached file's mime + size as correlated subqueries so the
// documents FROM stays single-table — the keyset predicate and column list stay
// unqualified, and there is no N+1 fetch for the library's file-type icons/sizes.
const FILE_META = `(SELECT mime FROM files WHERE files.id = documents.file_id) AS file_mime,
  (SELECT size_bytes FROM files WHERE files.id = documents.file_id) AS file_size_bytes`;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function toDocumentDto(row: DocumentRow): DocumentDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    category: row.category as DocumentCategory,
    status: row.status as DocumentStatus,
    version: row.version,
    fileId: row.file_id,
    fileMime: row.file_mime ?? null,
    fileSizeBytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
    ownerId: row.owner_id,
    approverId: row.approver_id,
    expiresAt: iso(row.expires_at),
    frameworks: row.frameworks,
    aiSummary: row.ai_summary,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface VersionRow {
  id: string;
  document_id: string;
  version: string;
  file_id: string | null;
  changelog: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
}

const VERSION_COLUMNS =
  "id, document_id, version, file_id, changelog, approved_by, approved_at, created_at";

function toVersionDto(row: VersionRow): DocumentVersionDto {
  return {
    id: row.id,
    documentId: row.document_id,
    version: row.version,
    fileId: row.file_id,
    changelog: row.changelog,
    approvedBy: row.approved_by,
    approvedAt: iso(row.approved_at),
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Controlled documents (02 §4, 03 §3). The lifecycle
 * (draft → pending → approved|rejected, approved → archived, rejected → draft)
 * runs through `documentMachine`, which carries the three rules that make a
 * document "controlled": only an admin/manager approves, an author cannot
 * approve their own document (four-eyes), and the last approved version cannot
 * be archived out from under the shop floor. A new version never moves the
 * record backwards — it opens a fresh draft `document_versions` row while the
 * approved version stays approved and auditable. Documents are not plant-scoped
 * (no plant_id), so every `document:view` holder can read them; `document:manage`
 * authors and `document:approve` reviews.
 */
@Injectable()
export class DocumentsService {
  async list(
    tx: Tx,
    opts: { status?: string; category?: string; cursor?: string; limit: number },
  ): Promise<Page<DocumentDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.category !== undefined) {
      params.push(opts.category);
      where += ` AND category = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS}, ${FILE_META} FROM documents ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDocumentDto);
  }

  async get(tx: Tx, id: string): Promise<DocumentDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toDocumentDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateDocumentBody,
    context: AuditContext,
  ): Promise<DocumentDto> {
    const now = new Date();
    const year = counterYear(now, "UTC"); // documents have no plant/timezone
    const id = randomUUID();
    const version = "1.0";

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "document",
        entityId: id,
        action: "created",
        after: { title: body.title, category: body.category, version },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'document', $2, 1)
           ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate a document code");

        const { rows } = await t.query<DocumentRow>(
          `INSERT INTO documents
             (id, tenant_id, code, title, category, status, version, file_id, owner_id,
              expires_at, frameworks, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$8,$8)
           RETURNING ${DOCUMENT_COLUMNS}`,
          [
            id,
            tenantId,
            formatCode("document", year, seq),
            body.title,
            body.category,
            version,
            body.fileId ?? null,
            actorId,
            body.expiresAt ?? null,
            body.frameworks ?? [],
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Document was not created");

        await this.insertVersion(t, tenantId, id, version, body.fileId ?? null, body.changelog ?? null, actorId);
        return toDocumentDto(row);
      },
    );
  }

  /** Author-side lifecycle: submit (→pending), revise (rejected→draft), archive. */
  async transition(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: TransitionDocumentBody,
    context: AuditContext,
  ): Promise<DocumentDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row.lock_version, body.version);

    const decision = documentMachine.canTransition(row.status as DocumentStatus, body.to, {
      actorId,
      actorRole: membership.role,
      ownerId: row.owner_id,
      otherApprovedVersionCount:
        body.to === "archived" ? await this.otherApprovedVersionCount(tx, id, row.version) : 0,
    });
    if (!decision.ok) throw ApiError.from(decision);

    return this.applyStatusChange(tx, tenantId, actorId, id, row.status, body.to, body.version, body.reason ?? null, "status = $3", [body.to], context);
  }

  /** Approve or reject a pending document — its own capability + the four-eyes rule. */
  async review(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: ReviewDocumentBody,
    context: AuditContext,
  ): Promise<DocumentDto> {
    const to: DocumentStatus = body.decision === "approve" ? "approved" : "rejected";
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row.lock_version, body.version);

    const decision = documentMachine.canTransition(row.status as DocumentStatus, to, {
      actorId,
      actorRole: membership.role,
      ownerId: row.owner_id,
      otherApprovedVersionCount: 0, // only relevant to archiving
    });
    if (!decision.ok) throw ApiError.from(decision);

    if (to === "approved") {
      return this.applyStatusChange(
        tx,
        tenantId,
        actorId,
        id,
        row.status,
        to,
        body.version,
        body.reason ?? null,
        "status = 'approved', approver_id = $3",
        [actorId],
        context,
        // Stamp the version under review as approved, in the same transaction.
        async (t) => {
          await t.query(
            `UPDATE document_versions SET approved_by = $3, approved_at = now(), updated_by = $3
              WHERE document_id = $1 AND version = $2`,
            [id, row.version, actorId],
          );
        },
      );
    }

    return this.applyStatusChange(tx, tenantId, actorId, id, row.status, to, body.version, body.reason ?? null, "status = 'rejected'", [], context);
  }

  async listVersions(
    tx: Tx,
    documentId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<DocumentVersionDto>> {
    await this.get(tx, documentId); // 404 if the document does not exist
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [documentId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<VersionRow>(
      `SELECT ${VERSION_COLUMNS} FROM document_versions
        WHERE document_id = $1 ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toVersionDto);
  }

  /**
   * Open a new draft version of an approved document. The previously approved
   * version keeps its `document_versions` row (and its approval stamp); the
   * `documents` record moves to draft at the new label.
   */
  async newVersion(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: NewDocumentVersionBody,
    context: AuditContext,
  ): Promise<DocumentDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertVersion(row.lock_version, body.version);

    if (row.status !== "approved") {
      throw new ApiError("INVALID_TRANSITION", "A new version can only be opened from an approved document", {
        status: row.status,
      });
    }
    if (body.nextVersion === row.version || (await this.versionExists(tx, id, body.nextVersion))) {
      throw new ApiError("CONFLICT", `Version '${body.nextVersion}' already exists`);
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "document",
        entityId: id,
        action: "updated",
        before: { version: row.version, status: row.status },
        after: { version: body.nextVersion, status: "draft" },
        reason: body.changelog ?? null,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await this.insertVersion(t, tenantId, id, body.nextVersion, body.fileId ?? null, body.changelog ?? null, actorId);
        const { rows } = await t.query<DocumentRow>(
          `UPDATE documents
              SET status = 'draft', version = $3, file_id = $4, approver_id = NULL, owner_id = $5, updated_by = $5
            WHERE id = $1 AND lock_version = $2
            RETURNING ${DOCUMENT_COLUMNS}`,
          [id, body.version, body.nextVersion, body.fileId ?? null, actorId],
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("STALE_WRITE", "The document changed since you loaded it");
        return toDocumentDto(updated);
      },
    );
  }

  // --- internals ------------------------------------------------------------

  private async applyStatusChange(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    from: string,
    to: string,
    version: number,
    reason: string | null,
    setClause: string,
    extraParams: unknown[],
    context: AuditContext,
    sideEffect?: (t: Tx) => Promise<void>,
  ): Promise<DocumentDto> {
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "document",
        entityId: id,
        action: "status_changed",
        before: { status: from },
        after: { status: to },
        reason,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<DocumentRow>(
          `UPDATE documents SET ${setClause}, updated_by = $2 WHERE id = $1 AND lock_version = $${extraParams.length + 3}
            RETURNING ${DOCUMENT_COLUMNS}`,
          [id, actorId, ...extraParams, version],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "The document changed since you loaded it");
        if (sideEffect !== undefined) await sideEffect(t);
        return toDocumentDto(row);
      },
    );
  }

  private async insertVersion(
    tx: Tx,
    tenantId: string,
    documentId: string,
    version: string,
    fileId: string | null,
    changelog: string | null,
    actorId: string,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO document_versions (id, tenant_id, document_id, version, file_id, changelog, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [randomUUID(), tenantId, documentId, version, fileId, changelog, actorId],
    );
  }

  private async otherApprovedVersionCount(tx: Tx, documentId: string, currentVersion: string): Promise<number> {
    const { rows } = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM document_versions
        WHERE document_id = $1 AND approved_at IS NOT NULL AND version <> $2`,
      [documentId, currentVersion],
    );
    return Number(rows[0]?.n ?? "0");
  }

  private async versionExists(tx: Tx, documentId: string, version: string): Promise<boolean> {
    const { rows } = await tx.query(
      "SELECT 1 FROM document_versions WHERE document_id = $1 AND version = $2",
      [documentId, version],
    );
    return rows.length > 0;
  }

  private async fetch(tx: Tx, id: string): Promise<DocumentRow | null> {
    const { rows } = await tx.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS}, ${FILE_META} FROM documents WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ApiError("STALE_WRITE", "The record changed since you loaded it", { expected, actual });
    }
  }
}
