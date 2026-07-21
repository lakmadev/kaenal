import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  type CreateTemplateBody,
  type FormSchema,
  type Page,
  type TemplateDto,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";

interface TemplateRow {
  id: string;
  name: string;
  version: number;
  status: string;
  schema: FormSchema;
  usage_count: number;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS =
  "id, name, version, status, schema, usage_count, lock_version, created_at, updated_at";

function toDto(row: TemplateRow): TemplateDto {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    status: row.status as TemplateDto["status"],
    schema: row.schema,
    usageCount: row.usage_count,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Inspection templates (02 §2, 02 §7).
 *
 * A published template's schema is immutable — the database trigger enforces
 * it, this service never tries to edit one. Publishing is the only state change
 * offered here; versioning a published template into a new draft is a later
 * slice.
 */
@Injectable()
export class TemplatesService {
  async list(
    tx: Tx,
    opts: { status?: string; cursor?: string; limit: number },
  ): Promise<Page<TemplateDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;

    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";
    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<TemplateRow>(
      `SELECT ${COLUMNS} FROM inspection_templates
        ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }

  async get(tx: Tx, id: string): Promise<TemplateRow | null> {
    const { rows } = await tx.query<TemplateRow>(
      `SELECT ${COLUMNS} FROM inspection_templates WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateTemplateBody,
    context: { requestId: string | null; ip: string | null; userAgent: string | null },
  ): Promise<TemplateDto> {
    // The id is minted here, not left to the DB default, because the audit
    // event must carry the real entity id and withAudit fixes the event before
    // the INSERT's RETURNING is available.
    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection_template",
        entityId: id,
        action: "created",
        after: { name: body.name },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<TemplateRow>(
          `INSERT INTO inspection_templates (id, tenant_id, name, version, status, schema, created_by, updated_by)
           VALUES ($1, $2, $3, 1, 'draft', $4, $5, $5)
           RETURNING ${COLUMNS}`,
          [id, tenantId, body.name, JSON.stringify(body.schema), actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Template was not created");
        return toDto(row);
      },
    );
  }

  /**
   * Draft → published, with optimistic concurrency (03 §6). A template that is
   * already published or archived is a CONFLICT, not a silent no-op; a stale
   * `version` is STALE_WRITE.
   */
  async publish(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    expectedVersion: number,
    context: { requestId: string | null; ip: string | null; userAgent: string | null },
  ): Promise<TemplateDto> {
    const current = await this.get(tx, id);
    if (current === null) throw notFound();
    if (current.status !== "draft") {
      throw new ApiError("CONFLICT", `Only a draft can be published (this template is ${current.status})`);
    }
    if (current.lock_version !== expectedVersion) {
      throw new ApiError("STALE_WRITE", "The template changed since you loaded it", {
        expected: expectedVersion,
        actual: current.lock_version,
      });
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection_template",
        entityId: id,
        action: "status_changed",
        before: { status: "draft" },
        after: { status: "published" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<TemplateRow>(
          `UPDATE inspection_templates
              SET status = 'published', updated_by = $3
            WHERE id = $1 AND lock_version = $2 AND status = 'draft'
            RETURNING ${COLUMNS}`,
          [id, expectedVersion, actorId],
        );
        const row = rows[0];
        // Lost the compare-and-set to a concurrent writer between the read and
        // here: the row moved, so the caller's version is now stale.
        if (row === undefined) {
          throw new ApiError("STALE_WRITE", "The template changed since you loaded it");
        }
        return toDto(row);
      },
    );
  }
}
