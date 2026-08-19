import { Injectable } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import type {
  AuditAction,
  AuditEventDto,
  AuditLogEntryDto,
  AuditLogQuery,
  EntityKind,
  Page,
} from "@kaenal/types";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";
import { ApiError } from "../errors.js";
import { assertEntityVisible } from "./entity-ref.js";

interface AuditEventRow {
  id: string;
  entity_kind: string;
  entity_id: string;
  actor_id: string | null;
  actor_kind: string;
  action: string;
  reason: string | null;
  created_at: Date;
}

interface TenantAuditRow extends AuditEventRow {
  ip: string | null;
  /** Full-microsecond `created_at` as text — the keyset cursor value. See
   *  `encodeAuditCursor` for why the JS `Date` (millisecond) form is not enough. */
  cursor_ts: string;
}

// Deliberately excludes before/after — the access log shows who/what/when
// without leaking the changed field values those columns can carry (07 §1).
const AUDIT_COLUMNS = "id, entity_kind, entity_id, actor_id, actor_kind, action, reason, created_at";

// The tenant-wide log adds the source IP (an admin-only forensic column); still
// no before/after payloads, so it never becomes a side channel for field values.
// `cursor_ts` carries created_at at full precision (see the cursor helpers).
const TENANT_AUDIT_COLUMNS = `${AUDIT_COLUMNS}, host(ip) AS ip, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts`;

interface AuditCursor {
  readonly ts: string;
  readonly id: string;
}

/**
 * Keyset cursor for the tenant-wide log, carrying `created_at` at FULL
 * microsecond precision. The shared `encodeCursor` derives the timestamp from a
 * JS `Date`, which node-pg truncates to milliseconds. That is fine when rows
 * have distinct timestamps, but an audit log routinely writes many events in one
 * transaction (a single `withAudit` batch), giving them an identical
 * microsecond `created_at`; a millisecond-truncated cursor value then sorts
 * *before* every one of them and the next page comes back empty. Keeping the raw
 * `to_char(...US...)` text keeps `(created_at, id) < ($ts, $id)` exact while
 * still hitting the `(tenant_id, created_at DESC)` index.
 */
function encodeAuditCursor(row: TenantAuditRow): string {
  return Buffer.from(`${row.cursor_ts}|${row.id}`, "utf8").toString("base64url");
}

function decodeAuditCursor(raw: string): AuditCursor {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  }
  const sep = decoded.lastIndexOf("|");
  const ts = sep === -1 ? "" : decoded.slice(0, sep);
  const id = sep === -1 ? "" : decoded.slice(sep + 1);
  if (ts === "" || id === "" || Number.isNaN(Date.parse(ts))) {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  }
  return { ts, id };
}

/**
 * Actions that carry a security / permission / governance signal — the rows an
 * auditor scans for first. Derived server-side (never trusted from the client)
 * so the UI highlights them consistently. Kept narrow on purpose: flagging
 * everyday create/update as "sensitive" would drown the signal.
 */
const SENSITIVE_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "role_changed",
  "settings_changed",
  "entitlement_changed",
  "support_accessed",
  "sign_in_failed",
  "signed",
  "purged",
  "deleted",
  "exported",
]);

/**
 * Whitelist mapping a Kaenal entity kind to the table its human `code` lives in.
 * The table name comes ONLY from this static map — never from the request — so
 * the batched code lookup can never be steered at an arbitrary relation. Kinds
 * absent here (e.g. `membership`, `tenant_settings` from a role/settings change)
 * simply fall back to a humanised label + short id.
 */
const TARGET_TABLES: Partial<Record<EntityKind, string>> = {
  inspection: "inspections",
  ncr: "ncrs",
  eight_d: "eight_ds",
  audit: "audits",
  capa: "capas",
  document: "documents",
  supplier: "suppliers",
  scar: "scars",
};

const KIND_LABEL: Partial<Record<string, string>> = {
  inspection: "Inspection",
  ncr: "NCR",
  eight_d: "8D",
  audit: "Audit",
  capa: "CAPA",
  document: "Document",
  supplier: "Supplier",
  scar: "SCAR",
  membership: "Member",
  tenant_settings: "Workspace settings",
  session: "Session",
  api_key: "API key",
};

/** Title-case an unknown snake_case entity kind for the fallback target label. */
function humanizeKind(kind: string): string {
  return (
    KIND_LABEL[kind] ??
    kind
      .split("_")
      .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
      .join(" ")
  );
}

function toDto(row: AuditEventRow, actorNames?: ReadonlyMap<string, string>): AuditEventDto {
  return {
    id: row.id,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorName: row.actor_id !== null ? (actorNames?.get(row.actor_id) ?? null) : null,
    actorKind: row.actor_kind,
    action: row.action as AuditAction,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  };
}

/** Filters for the tenant-wide log (the query DTO minus the page controls). */
export type AuditLogFilters = Omit<AuditLogQuery, "cursor" | "limit">;

/**
 * A record's access log (FEATURES §9, 07 §1) — a read-only projection of the
 * append-only `audit_events` for one entity, newest first. Gated by the same
 * parent-visibility check as comments: you can read the history of a record you
 * can see. Payloads are omitted (see AUDIT_COLUMNS), so this never becomes a
 * side channel for field values a role otherwise can't read.
 *
 * The tenant-wide view (`listTenant` / `exportRows`) is a different surface: the
 * whole-workspace security trail, admin-gated by `auditlog:read` at the
 * controller. Its hot query hits `audit_events` alone on the
 * `(tenant_id, created_at DESC)` index; actor names and target codes are then
 * resolved in two batched `= ANY(...)` lookups per page rather than an N-way
 * join, so enrichment cost is bounded by the page size, not the table size.
 */
@Injectable()
export class AuditLogService {
  async list(
    tx: Tx,
    kind: EntityKind,
    entityId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<AuditEventDto>> {
    await assertEntityVisible(tx, kind, entityId);
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [kind, entityId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<AuditEventRow>(
      `SELECT ${AUDIT_COLUMNS} FROM audit_events
        WHERE entity_kind = $1 AND entity_id = $2 ${keyset.sql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    // Resolve actor display names in one batched lookup so the activity feed
    // reads "Raised by Sara Chen" without an N-way join or a client round-trip.
    const actorNames = await resolveActorNames(tx, rows);
    return toPage(rows, limit, (r) => toDto(r, actorNames));
  }

  /**
   * The tenant-wide audit log, newest first, with structured filters. Tenant
   * scoping is RLS only (the request tx already `SET LOCAL app.tenant_id`) — the
   * builder never adds a tenant predicate, matching every other service.
   */
  async listTenant(
    tx: Tx,
    filters: AuditLogFilters,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<AuditLogEntryDto>> {
    const limit = clampLimit(opts.limit);
    const cursor = opts.cursor !== undefined ? decodeAuditCursor(opts.cursor) : null;

    const { where, params } = buildTenantWhere(filters);
    let keysetSql = "";
    if (cursor !== null) {
      keysetSql = `AND (created_at, id) < ($${params.length + 1}::timestamptz, $${params.length + 2}::uuid)`;
      params.push(cursor.ts, cursor.id);
    }
    params.push(limit + 1);

    const { rows } = await tx.query<TenantAuditRow>(
      `SELECT ${TENANT_AUDIT_COLUMNS} FROM audit_events
        WHERE ${where} ${keysetSql}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );

    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const items = await this.enrich(tx, visible);
    const last = visible[visible.length - 1];
    const nextCursor = hasMore && last !== undefined ? encodeAuditCursor(last) : null;
    return { items, nextCursor };
  }

  /**
   * The same filtered result as `listTenant`, flattened for a compliance export,
   * newest first and hard-capped. Not paginated — an auditor needs the whole
   * matching set — but the cap keeps a single request bounded (a broader export
   * belongs in the async jobs pipeline, flagged as a follow-up).
   */
  async exportRows(tx: Tx, filters: AuditLogFilters, cap = 10_000): Promise<AuditLogEntryDto[]> {
    const limit = Math.min(cap, 50_000);
    const { where, params } = buildTenantWhere(filters);
    params.push(limit);
    const { rows } = await tx.query<TenantAuditRow>(
      `SELECT ${TENANT_AUDIT_COLUMNS} FROM audit_events
        WHERE ${where}
        ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return this.enrich(tx, rows);
  }

  /** Resolve actor names + target codes for a page and map to DTOs. */
  private async enrich(tx: Tx, rows: readonly TenantAuditRow[]): Promise<AuditLogEntryDto[]> {
    const [names, codes] = await Promise.all([
      resolveActorNames(tx, rows),
      resolveTargetCodes(tx, rows),
    ]);
    return rows.map((row) => toTenantDto(row, names, codes));
  }
}

/** Builds the parameterised WHERE fragment (never string-concatenates values). */
function buildTenantWhere(filters: AuditLogFilters): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const push = (sql: (n: number) => string, value: unknown): void => {
    params.push(value);
    clauses.push(sql(params.length));
  };

  if (filters.actorId !== undefined) push((n) => `actor_id = $${n}`, filters.actorId);
  if (filters.action !== undefined) push((n) => `action = $${n}`, filters.action);
  if (filters.entityKind !== undefined) push((n) => `entity_kind = $${n}`, filters.entityKind);
  if (filters.sensitiveOnly === true) {
    push((n) => `action = ANY($${n})`, [...SENSITIVE_ACTIONS]);
  }
  if (filters.from !== undefined) push((n) => `created_at >= $${n}::timestamptz`, filters.from);
  if (filters.to !== undefined) push((n) => `created_at <= $${n}::timestamptz`, filters.to);

  return { where: clauses.length === 0 ? "TRUE" : clauses.join(" AND "), params };
}

/** Batched actor → display name, resolved from shared identity (`control.users`). */
async function resolveActorNames(
  tx: Tx,
  rows: readonly { actor_id: string | null }[],
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => id !== null))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { rows: users } = await tx.query<{ id: string; name: string }>(
    `SELECT id, name FROM control.users WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  for (const u of users) out.set(u.id, u.name);
  return out;
}

/** Batched target → human code, one small PK lookup per entity kind present. */
async function resolveTargetCodes(
  tx: Tx,
  rows: readonly TenantAuditRow[],
): Promise<Map<string, string>> {
  const byKind = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!(row.entity_kind in TARGET_TABLES)) continue;
    const set = byKind.get(row.entity_kind) ?? new Set<string>();
    set.add(row.entity_id);
    byKind.set(row.entity_kind, set);
  }

  const out = new Map<string, string>();
  await Promise.all(
    [...byKind.entries()].map(async ([kind, idSet]) => {
      const table = TARGET_TABLES[kind as EntityKind];
      if (table === undefined) return;
      // `table` is a hard-coded whitelist value, never user input.
      const { rows: found } = await tx.query<{ id: string; code: string | null }>(
        `SELECT id, code FROM ${table} WHERE id = ANY($1::uuid[])`,
        [[...idSet]],
      );
      for (const r of found) {
        if (r.code !== null) out.set(`${kind}:${r.id}`, r.code);
      }
    }),
  );
  return out;
}

function actorName(row: TenantAuditRow, names: Map<string, string>): string {
  switch (row.actor_kind) {
    case "system":
      return "System";
    case "api_key":
      return row.actor_id !== null ? (names.get(row.actor_id) ?? "API key") : "API key";
    case "support": {
      const name = row.actor_id !== null ? names.get(row.actor_id) : undefined;
      return name !== undefined ? `${name} · Support` : "Support";
    }
    default: {
      if (row.actor_id === null) return "System";
      return names.get(row.actor_id) ?? "Former member";
    }
  }
}

function targetLabel(row: TenantAuditRow, codes: Map<string, string>): string {
  const code = codes.get(`${row.entity_kind}:${row.entity_id}`);
  if (code !== undefined) return code;
  return `${humanizeKind(row.entity_kind)} ·${row.entity_id.slice(0, 8)}`;
}

function toTenantDto(
  row: TenantAuditRow,
  names: Map<string, string>,
  codes: Map<string, string>,
): AuditLogEntryDto {
  const action = row.action as AuditAction;
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    actorId: row.actor_id,
    actorKind: row.actor_kind,
    actorName: actorName(row, names),
    action,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    targetLabel: targetLabel(row, codes),
    reason: row.reason,
    ip: row.ip,
    sensitive: SENSITIVE_ACTIONS.has(action),
  };
}
