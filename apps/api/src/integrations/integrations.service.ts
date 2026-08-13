import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { connectorMeta, connectorSchema } from "@kaenal/core";
import type {
  ConnectIntegrationBody,
  ConnectorSchemaResult,
  CreateIntegrationBody,
  IntegrationDto,
  IntegrationEventDto,
  IntegrationProvider,
  Page,
  UpdateIntegrationBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface Row {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: unknown;
  credentials_ref: string | null;
  last_error: string | null;
  connected_at: Date | null;
  last_ok_at: Date | null;
  connected_by: string | null;
  lock_version: number;
}

const COLS =
  "id, provider, name, status, config, credentials_ref, last_error, connected_at, last_ok_at, connected_by, lock_version";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The connector registry (09 §1; table 0032). One substrate for every external
 * system. Secrets never cross this boundary: `credentials_ref` is a pointer, the
 * DTO exposes only `hasCredentials`. All writes need `integration:manage` (admin)
 * and are audited + optimistic; disconnect purges the credential pointer.
 */
@Injectable()
export class IntegrationsService {
  async list(tx: Tx): Promise<Page<IntegrationDto>> {
    const { rows } = await tx.query<Row>(
      `SELECT ${COLS} FROM integrations WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC`,
    );
    return { items: rows.map(toDto), nextCursor: null };
  }

  private async load(tx: Tx, id: string): Promise<Row> {
    if (!UUID_RE.test(id)) throw notFound();
    const { rows } = await tx.query<Row>(`SELECT ${COLS} FROM integrations WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async get(tx: Tx, id: string): Promise<IntegrationDto> {
    return toDto(await this.load(tx, id));
  }

  /** The provider's declared field schema (adapter `listSchema()`). */
  schema(id: string, tx: Tx): Promise<ConnectorSchemaResult> {
    return this.load(tx, id).then((row) => ({ fields: connectorSchema(row.provider as IntegrationProvider) }));
  }

  async events(tx: Tx, id: string): Promise<Page<IntegrationEventDto>> {
    await this.load(tx, id);
    const { rows } = await tx.query<{
      id: string;
      direction: string;
      kind: string;
      status: string;
      attempts: number;
      detail: string | null;
      created_at: Date;
    }>(
      `SELECT id, direction, kind, status, attempts, detail, created_at
         FROM integration_events WHERE integration_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [id],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        direction: r.direction as IntegrationEventDto["direction"],
        kind: r.kind,
        status: r.status as IntegrationEventDto["status"],
        attempts: r.attempts,
        detail: r.detail,
        createdAt: r.created_at.toISOString(),
      })),
      nextCursor: null,
    };
  }

  async create(tx: Tx, tenantId: string, actorId: string, body: CreateIntegrationBody, ctx: AuditContext): Promise<IntegrationDto> {
    connectorMeta(body.provider); // provider is validated by the enum; keeps the dependency honest
    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "created", id, ctx, { after: { provider: body.provider, name: body.name } }),
      async (t) => {
        const { rows } = await t.query<Row>(
          `INSERT INTO integrations (id, tenant_id, provider, name, config, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING ${COLS}`,
          [id, tenantId, body.provider, body.name, JSON.stringify(body.config ?? {}), actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Integration was not created");
        return toDto(row);
      },
    );
  }

  async update(tx: Tx, tenantId: string, actorId: string, id: string, body: UpdateIntegrationBody, ctx: AuditContext): Promise<IntegrationDto> {
    const current = await this.load(tx, id);
    assertVersion(current.lock_version, body.version);
    const config = body.config ?? (current.config as Record<string, string>);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", id, ctx, { before: { name: current.name }, after: { name: body.name } }),
      async (t) => {
        const { rows } = await t.query<Row>(
          `UPDATE integrations SET name=$3, config=$4, updated_by=$5
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, body.version, body.name, JSON.stringify(config), actorId],
        );
        const row = rows[0];
        if (row === undefined) throw staleWrite();
        return toDto(row);
      },
    );
  }

  /**
   * Connect: flip to `connected` and record a credential *pointer* + when/who.
   * The real OAuth exchange is out of scope — the pointer is what the callback
   * would have stored in the secret manager. A token is never accepted here.
   */
  async connect(tx: Tx, tenantId: string, actorId: string, id: string, body: ConnectIntegrationBody, ctx: AuditContext): Promise<IntegrationDto> {
    const current = await this.load(tx, id);
    const ref = body.credentialsRef ?? `secret://${tenantId}/${id}`;
    const config = body.config ?? (current.config as Record<string, string>);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", id, ctx, { before: { status: current.status }, after: { status: "connected" } }),
      async (t) => {
        const { rows } = await t.query<Row>(
          `UPDATE integrations
              SET status='connected', credentials_ref=$2, config=$3, last_error=NULL,
                  connected_at=now(), last_ok_at=now(), connected_by=$4, updated_by=$4
            WHERE id=$1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, ref, JSON.stringify(config), actorId],
        );
        await t.query(
          `INSERT INTO integration_events (id, tenant_id, integration_id, direction, kind, status)
           VALUES ($1,$2,$3,'out','connect','ok')`,
          [randomUUID(), tenantId, id],
        );
        return toDto(rows[0] ?? current);
      },
    );
  }

  /** Disconnect: purge the credential pointer and mark disconnected. */
  async disconnect(tx: Tx, tenantId: string, actorId: string, id: string, ctx: AuditContext): Promise<IntegrationDto> {
    const current = await this.load(tx, id);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", id, ctx, { before: { status: current.status }, after: { status: "disconnected" } }),
      async (t) => {
        const { rows } = await t.query<Row>(
          `UPDATE integrations SET status='disconnected', credentials_ref=NULL, connected_at=NULL, updated_by=$2
            WHERE id=$1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, actorId],
        );
        return toDto(rows[0] ?? current);
      },
    );
  }

  async remove(tx: Tx, tenantId: string, actorId: string, id: string, ctx: AuditContext): Promise<IntegrationDto> {
    const row = await this.load(tx, id);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "deleted", id, ctx, { before: { name: row.name, deleted: false }, after: { deleted: true } }),
      async (t) => {
        // Purge secrets on delete (09 §8).
        const { rows } = await t.query<Row>(
          `UPDATE integrations SET deleted_at = now(), credentials_ref = NULL, updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, actorId],
        );
        return toDto(rows[0] ?? row);
      },
    );
  }
}

function toDto(row: Row): IntegrationDto {
  return {
    id: row.id,
    provider: row.provider as IntegrationDto["provider"],
    name: row.name,
    status: row.status as IntegrationDto["status"],
    config: (row.config ?? {}) as Record<string, string>,
    hasCredentials: row.credentials_ref !== null,
    lastError: row.last_error,
    connectedAt: row.connected_at?.toISOString() ?? null,
    lastOkAt: row.last_ok_at?.toISOString() ?? null,
    connectedBy: row.connected_by,
    lockVersion: row.lock_version,
  };
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) throw new ApiError("STALE_WRITE", "This integration changed since you loaded it", { expected, actual });
}
function staleWrite(): ApiError {
  return new ApiError("STALE_WRITE", "This integration changed since you loaded it");
}

type AuditVerb = "created" | "updated" | "deleted";
function audit(
  actorId: string,
  action: AuditVerb,
  entityId: string,
  ctx: AuditContext,
  data: { before?: Record<string, unknown>; after?: Record<string, unknown> },
) {
  return {
    actorId,
    actorKind: "user" as const,
    entityKind: "integration",
    entityId,
    action,
    ...(data.before !== undefined ? { before: data.before } : {}),
    ...(data.after !== undefined ? { after: data.after } : {}),
    requestId: ctx.requestId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}
