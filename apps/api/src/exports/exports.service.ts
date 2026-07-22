import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { authorize, type Capability, type Membership } from "@kaenal/core";
import type { CreateExportBody, ExportDto, ExportResource, ExportStatus, Page } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { NoopProducer, type JobProducer } from "../jobs/producer.js";
import type { Storage } from "../files/storage.js";

interface ExportRow {
  id: string;
  resource: string;
  format: string;
  status: string;
  filters: { status?: string };
  row_count: number | null;
  byte_size: string | null; // bigint arrives as string from pg
  bucket: string | null;
  object_key: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const EXPORT_COLUMNS = `id, resource, format, status, filters, row_count, byte_size, bucket,
  object_key, error, requested_by, created_at, updated_at`;

/** The `<resource>:view` capability an export requires — you can only export
 *  records you are allowed to read. */
const VIEW_CAPABILITY: Readonly<Record<ExportResource, Capability>> = {
  ncrs: "ncr:view",
  inspections: "inspection:view",
  capas: "capa:view",
  audits: "audit:view",
};

/**
 * Async exports (03 §8). `create` records a `queued` row and enqueues a render
 * on the `reports` queue — the HTTP call returns 202 immediately rather than
 * blocking on a large query. The worker (`run-export`) renders, uploads, and
 * flips the row to `completed`; the client polls `get`, which mints a short-TTL
 * presigned download URL once the artifact exists.
 *
 * Exports are scoped to their requester (a foreign export is a 404, not a 403 —
 * rule 8), because an export freezes a snapshot that was plant-scoped to whoever
 * asked for it; handing it to another user would leak rows outside their scope.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly storage: Storage,
    private readonly jobs: JobProducer = new NoopProducer(),
  ) {}

  async create(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    body: CreateExportBody,
    context: AuditContext,
  ): Promise<ExportDto> {
    // You can only export what you may view. Fails closed on an unknown resource.
    const capability = VIEW_CAPABILITY[body.resource];
    const decision = authorize(membership, capability);
    if (!decision.ok) throw ApiError.from(decision);

    const id = randomUUID();
    const filters = body.filters ?? {};

    const dto = await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "export",
        entityId: id,
        action: "created",
        after: { resource: body.resource, format: body.format },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<ExportRow>(
          `INSERT INTO exports
             (id, tenant_id, resource, format, filters, status, requested_by, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,'queued',$6,$6,$6)
           RETURNING ${EXPORT_COLUMNS}`,
          [id, tenantId, body.resource, body.format, JSON.stringify(filters), actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Could not create the export");
        return this.toDto(row, null);
      },
    );

    // Hand off the render (06 `reports`). A no-op when jobs are disabled.
    await this.jobs.runExport({ tenantId, exportId: id });
    return dto;
  }

  async get(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
  ): Promise<ExportDto> {
    const row = await this.fetch(tx, actorId, id);
    if (row === null) throw notFound();

    // Not yet done: report status only, no URL to mint.
    if (row.status !== "completed" || row.object_key === null) {
      return this.toDto(row, null);
    }

    const url = await this.storage.presignGet(row.object_key, this.downloadName(row));

    // Minting the URL is the data egress (03 §8, 07 §1) — audited like a file
    // download, each time, since each URL is a fresh chance to pull the data.
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "export",
        entityId: id,
        action: "exported",
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      () => Promise.resolve(this.toDto(row, url)),
    );
  }

  async list(
    tx: Tx,
    actorId: string,
    opts: { resource?: string; status?: string; cursor?: string; limit: number },
  ): Promise<Page<ExportDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [actorId];
    let where = "WHERE requested_by = $1 AND deleted_at IS NULL";

    if (opts.resource !== undefined) {
      params.push(opts.resource);
      where += ` AND resource = $${params.length}`;
    }
    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<ExportRow>(
      `SELECT ${EXPORT_COLUMNS} FROM exports ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    // No URLs in the list — a completed row's download URL is minted by `get`.
    return toPage(rows, limit, (row) => this.toDto(row, null));
  }

  private async fetch(tx: Tx, actorId: string, id: string): Promise<ExportRow | null> {
    const { rows } = await tx.query<ExportRow>(
      `SELECT ${EXPORT_COLUMNS} FROM exports
        WHERE id = $1 AND requested_by = $2 AND deleted_at IS NULL`,
      [id, actorId],
    );
    return rows[0] ?? null;
  }

  private downloadName(row: ExportRow): string {
    const ext = row.object_key?.endsWith(".zip") === true ? "zip" : "csv";
    return `${row.resource}-export-${row.id}.${ext}`;
  }

  private toDto(row: ExportRow, downloadUrl: string | null): ExportDto {
    return {
      id: row.id,
      resource: row.resource as ExportResource,
      format: row.format as ExportDto["format"],
      status: row.status as ExportStatus,
      filters: row.filters,
      rowCount: row.row_count,
      byteSize: row.byte_size === null ? null : Number(row.byte_size),
      error: row.error,
      downloadUrl,
      requestedBy: row.requested_by,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
