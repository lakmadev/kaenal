import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { MAX_FILE_BYTES, validateUpload } from "@kaenal/core";
import type { ActorKind, DownloadFileResult, FileDto, PresignFileBody, PresignFileResult } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { NoopProducer, type JobProducer } from "../jobs/producer.js";
import type { Disposition, Storage } from "./storage.js";

interface FileRow {
  id: string;
  bucket: string;
  key: string;
  filename: string;
  mime: string;
  size_bytes: string; // bigint arrives as string from pg
  sha256: string | null;
  scan_status: string;
  entity_kind: string | null;
  entity_id: string | null;
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const FILE_COLUMNS = `id, bucket, key, filename, mime, size_bytes, sha256, scan_status,
  entity_kind, entity_id, uploaded_by, created_at, updated_at`;

function toFileDto(row: FileRow): FileDto {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    scanStatus: row.scan_status as FileDto["scanStatus"],
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return cleaned.length > 0 ? cleaned : "file";
}

/**
 * Files & uploads (03 §7, 07 §3). Three-step flow: presign (validate + a pending
 * row + a short-TTL PUT), the client uploads to storage directly, then complete
 * (verify the object exists, record its hash, hand off to the AV scan). The
 * security rule lives in `download`: a file that is not `clean` is not
 * downloadable — except by its own uploader while a scan is pending (watermarked
 * client-side) — and an `infected` file is downloadable by no one. Every
 * successful download is audited (07 §1). Storage is a port so this all runs
 * against a fake in tests, no live bucket required.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly storage: Storage,
    private readonly bucket: string,
    private readonly urlTtlSeconds: number,
    private readonly jobs: JobProducer = new NoopProducer(),
  ) {}

  async presign(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: PresignFileBody,
    context: AuditContext,
    actorKind: ActorKind = "user",
  ): Promise<PresignFileResult> {
    const decision = validateUpload({ mime: body.mime, sizeBytes: body.sizeBytes });
    if (!decision.ok) throw ApiError.from(decision);

    const id = randomUUID();
    const key = `${tenantId}/${id}/${sanitizeFilename(body.filename)}`;

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind,
        entityKind: "file",
        entityId: id,
        action: "created",
        after: { filename: body.filename, mime: body.mime, sizeBytes: body.sizeBytes },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(
          `INSERT INTO files
             (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status,
              entity_kind, entity_id, uploaded_by, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$10,$10)`,
          [
            id,
            tenantId,
            this.bucket,
            key,
            body.filename,
            body.mime,
            body.sizeBytes,
            body.entityKind ?? null,
            body.entityId ?? null,
            actorId,
          ],
        );
      },
    );

    const uploadUrl = await this.storage.presignPut(key, body.mime);
    return { fileId: id, uploadUrl, expiresIn: this.urlTtlSeconds };
  }

  async complete(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
    actorKind: ActorKind = "user",
  ): Promise<FileDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    // You complete your own upload — the presign issuer is the uploader.
    if (row.uploaded_by !== actorId) {
      throw new ApiError("FORBIDDEN", "Only the uploader can complete this upload");
    }
    if (row.scan_status !== "pending" || row.sha256 !== null) {
      throw new ApiError("CONFLICT", "This file has already been completed");
    }

    // Verify the client actually uploaded, and trust storage for the real size
    // (a client that under-declared size to pass the cap is caught here).
    const stat = await this.storage.stat(row.key);
    if (stat === null) {
      throw new ApiError("VALIDATION_FAILED", "No uploaded object was found for this file");
    }
    if (stat.sizeBytes > MAX_FILE_BYTES) {
      throw new ApiError("VALIDATION_FAILED", "The uploaded object exceeds the maximum size", {
        maxBytes: MAX_FILE_BYTES,
      });
    }

    const dto = await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind,
        entityKind: "file",
        entityId: id,
        action: "file_attached",
        after: { sha256: stat.etag, sizeBytes: stat.sizeBytes },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        // scan_status stays 'pending' — the AV scan job flips it to 'clean' or
        // 'infected' (06). Until then downloads are gated to the uploader.
        const { rows } = await t.query<FileRow>(
          `UPDATE files SET sha256 = $2, size_bytes = $3, updated_by = $4
            WHERE id = $1 AND scan_status = 'pending' AND sha256 IS NULL
            RETURNING ${FILE_COLUMNS}`,
          [id, stat.etag, stat.sizeBytes, actorId],
        );
        const updated = rows[0];
        if (updated === undefined) throw new ApiError("CONFLICT", "This file has already been completed");
        return toFileDto(updated);
      },
    );

    // Enqueue the AV scan (06 §1 `files`). A no-op when jobs are disabled.
    await this.jobs.scanFile({ tenantId, fileId: id });
    return dto;
  }

  async get(tx: Tx, id: string): Promise<FileDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    return toFileDto(row);
  }

  async download(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
    disposition: Disposition = "attachment",
  ): Promise<DownloadFileResult> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();

    // The AV scan gate (03 §7, 07 §3).
    if (row.scan_status === "infected") {
      throw new ApiError("FORBIDDEN", "This file failed a malware scan and cannot be downloaded");
    }
    if (row.scan_status !== "clean" && row.uploaded_by !== actorId) {
      throw new ApiError("FORBIDDEN", "This file is still being scanned and is not yet downloadable");
    }

    const url = await this.storage.presignGet(row.key, row.filename, disposition);

    // Downloads of quality records are audited: who, when, which file (07 §1).
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "file",
        entityId: id,
        action: "file_downloaded",
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      () => Promise.resolve({ url, expiresIn: this.urlTtlSeconds, scanPending: row.scan_status !== "clean" }),
    );
  }

  private async fetch(tx: Tx, id: string): Promise<FileRow | null> {
    const { rows } = await tx.query<FileRow>(
      `SELECT ${FILE_COLUMNS} FROM files WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }
}
