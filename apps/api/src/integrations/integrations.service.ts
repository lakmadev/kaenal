import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { connectorMeta, connectorSchema } from "@kaenal/core";
import {
  decodeWebhookEvents,
  encodeWebhookEvents,
  webhookConfigSchema,
  type ConfigureWebhookBody,
  type ConfigureWebhookResult,
  type WebhookPolicyDto,
  type WebhookTargetPolicy,
} from "@kaenal/types";
import type {
  ConnectIntegrationBody,
  ConnectorSchemaResult,
  CreateIntegrationBody,
  IntegrationDto,
  IntegrationEventDto,
  IntegrationProvider,
  Page,
  UpdateIntegrationBody,
  WebhookTestResultDto,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { EnvSecretResolver, type SecretResolver } from "../tenant/secret-resolver.js";
import { FetchWebhookTransport, type WebhookTransport } from "../outbox/webhook-transport.js";
import { deliverToEndpoint } from "../outbox/webhook-deliver.js";
import type { OutboxEvent } from "../outbox/outbox.types.js";
import { ENC_PREFIX, WebhookSecretBox, webhookPolicyFromEnv } from "../outbox/webhook-secret-box.js";

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
  /**
   * Delivery deps are injectable so the webhook test-send is unit-testable with a
   * fake transport/secret manager; the Nest provider constructs the real ones
   * (env-backed secret resolution + `fetch`). Only `sendTest` uses them.
   */
  constructor(
    private readonly secrets: SecretResolver = new EnvSecretResolver(),
    private readonly transport: WebhookTransport = new FetchWebhookTransport(),
    private readonly clock: () => Date = () => new Date(),
    private readonly options: { policy?: WebhookTargetPolicy; box?: WebhookSecretBox } = {},
  ) {}

  private get policy(): WebhookTargetPolicy {
    return this.options.policy ?? webhookPolicyFromEnv();
  }

  private get box(): WebhookSecretBox {
    if (this.options.box !== undefined) return this.options.box;
    const authSecret = process.env["AUTH_SECRET"] ?? "";
    if (authSecret === "") throw new ApiError("INTERNAL", "Webhook secret encryption is not configured");
    return new WebhookSecretBox({ authSecret, key: process.env["WEBHOOK_ENCRYPTION_KEY"] });
  }

  /** Deployment's webhook target policy — the web form validates inline against it. */
  webhookPolicy(): WebhookPolicyDto {
    return { allowPrivateTargets: this.policy.allowPrivateTargets };
  }

  /** Validate a webhook config map (url + events) under the deployment policy; 400 on violation. */
  private assertWebhookConfig(config: Record<string, string>): void {
    const parsed = webhookConfigSchema(this.policy).safeParse({
      url: config["url"] ?? "",
      events: decodeWebhookEvents(config["events"]),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError("VALIDATION_FAILED", issue?.message ?? "Invalid webhook configuration", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
  }

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
    if (body.provider === "generic_webhook" && body.config !== undefined && Object.keys(body.config).length > 0) {
      this.assertWebhookConfig(body.config);
    }
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
    if (current.provider === "generic_webhook" && body.config !== undefined) this.assertWebhookConfig(config);
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
    const config = body.config ?? (current.config as Record<string, string>);
    let ref = body.credentialsRef ?? `secret://${tenantId}/${id}`;
    if (current.provider === "generic_webhook") {
      // A webhook connects only when it can really deliver: valid destination + a
      // usable signing secret (never a bare, unresolvable pointer).
      this.assertWebhookConfig(config);
      const existing = current.credentials_ref;
      if (body.credentialsRef === undefined && (existing === null || !existing.startsWith(ENC_PREFIX))) {
        throw new ApiError("VALIDATION_FAILED", "Generate a signing secret before connecting this webhook");
      }
      if (body.credentialsRef === undefined && existing !== null) ref = existing; // keep the sealed secret
    }
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

  /**
   * Configure a `generic_webhook`: destination URL, subscribed events, and the
   * signing secret. The URL is validated against the SSRF policy; the secret is
   * server-generated (high entropy), sealed with AES-GCM into `credentials_ref`,
   * and returned ONCE in this response, never by any read. A secret is
   * generated when none is usable yet or when `rotateSecret` is set (the old one
   * stops verifying immediately). Optimistic (`version`) and audited; the audit
   * row records url/events/whether the secret rotated, never the secret. Replays
   * are safe: set-semantics on url/events, and a replayed rotate carries a stale
   * `version`, so it can neither double-rotate nor re-reveal a secret.
   */
  async configureWebhook(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: ConfigureWebhookBody,
    ctx: AuditContext,
  ): Promise<ConfigureWebhookResult> {
    const current = await this.load(tx, id);
    if (current.provider !== "generic_webhook") {
      throw new ApiError("VALIDATION_FAILED", "Only webhook endpoints have a URL and signing secret");
    }
    assertVersion(current.lock_version, body.version);
    const events = encodeWebhookEvents(body.events);
    const nextConfig: Record<string, string> = { ...(current.config as Record<string, string>), url: body.url.trim(), events };
    this.assertWebhookConfig(nextConfig);

    const existing = current.credentials_ref;
    const usable = existing !== null && !existing.startsWith("secret://");
    const rotate = body.rotateSecret || !usable;
    const signingSecret = rotate ? WebhookSecretBox.generateSecret() : null;
    const ref = signingSecret !== null ? this.box.seal(signingSecret) : existing;
    const before = current.config as Record<string, string>;

    const integration = await withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", id, ctx, {
        before: { url: before["url"] ?? null, events: before["events"] ?? null },
        after: { url: nextConfig["url"], events, secretRotated: rotate },
      }),
      async (t) => {
        const { rows } = await t.query<Row>(
          `UPDATE integrations SET config=$3, credentials_ref=$4, updated_by=$5
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, body.version, JSON.stringify(nextConfig), ref, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw staleWrite();
        return toDto(row);
      },
    );
    return { integration, signingSecret };
  }

  /**
   * Send a test event to a webhook endpoint — a real signed `webhook.ping`
   * through the exact delivery path a live event takes (same `deliverToEndpoint`,
   * same signature, same `integration_events` log row), so "it works" in the UI
   * means the real thing works, not a mock. Foreign/unknown ids 404 via `load`
   * (RLS); only `generic_webhook` endpoints can be pinged. Audited as an
   * `integration` update because it touches the endpoint's delivery state.
   */
  async sendTest(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    ctx: AuditContext,
  ): Promise<WebhookTestResultDto> {
    const row = await this.load(tx, id);
    if (row.provider !== "generic_webhook") {
      throw new ApiError("VALIDATION_FAILED", "Test events can only be sent to webhook endpoints");
    }
    const config = (row.config ?? {}) as Record<string, string>;
    const now = this.clock();
    const event: OutboxEvent = {
      id: randomUUID(),
      tenantId,
      eventType: "webhook.ping",
      entityKind: "webhook",
      entityId: id,
      action: "created",
      actorId,
      actorKind: "user",
      payload: { entityId: id, at: now.toISOString() },
      attempts: 0,
      createdAt: now,
    };

    const outcome = await withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", id, ctx, { after: { test: "webhook.ping" } }),
      (t) =>
        deliverToEndpoint(
          t,
          { id, url: config["url"] ?? "", credentialsRef: row.credentials_ref },
          event,
          { secrets: this.secrets, transport: this.transport, clock: this.clock },
        ),
    );

    return { ok: outcome.ok, status: outcome.status, detail: outcome.detail, at: now.toISOString() };
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
