import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { hasCapability, type Capability, type Membership } from "@kaenal/core";
import type { CreateEntityLinkBody, EntityKind, EntityLinkDto, Page } from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import { assertEntityVisible, isEntityVisible } from "./entity-ref.js";

/**
 * Per-kind label resolution (SPRINT-04 R3 `[AMENDED-2]`, doc-accuracy item).
 * Today's consumers (`capa-detail.tsx`/`document-detail.tsx`/
 * `supplier-detail.tsx`) just truncate the raw link id — a real linked-
 * records panel needs a human-readable label. `capability` is the SAME
 * `:view` capability that already gates that kind's own detail route, so a
 * label is resolved only when the caller could open the target record
 * directly; a caller lacking it (or a target that no longer exists — a
 * foreign-tenant id RLS already hides) gets `label: undefined`, never a raw
 * or guessed value (rule 8's spirit extended to a partial-visibility read).
 */
/** A label column always arrives as a string (`code`/`title`/`name`/…) —
 *  narrowed explicitly rather than templated as `unknown`. */
function str(v: unknown): string {
  return typeof v === "string" ? v : String(v);
}

interface LabelConfig {
  readonly capability: Capability;
  readonly table: string;
  readonly build: (row: Record<string, unknown>) => string;
}
const LABEL_CONFIG: Readonly<Record<EntityKind, LabelConfig>> = {
  inspection: { capability: "inspection:view", table: "inspections", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  ncr: { capability: "ncr:view", table: "ncrs", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  eight_d: { capability: "ncr:view", table: "eight_ds", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  audit: { capability: "audit:view", table: "audits", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  capa: { capability: "capa:view", table: "capas", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  document: { capability: "document:view", table: "documents", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  supplier: { capability: "supplier:view", table: "suppliers", build: (r) => `${str(r["name"])} (${str(r["code"])})` },
  scar: { capability: "scar:view", table: "scars", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  finding: {
    capability: "inspection:view",
    table: "findings",
    build: (r) => `${str(r["item_ref"])} — ${str(r["description"]).slice(0, 80)}`,
  },
  risk: { capability: "risk:view", table: "risks", build: (r) => `${str(r["code"])} — ${str(r["title"])}` },
  fmea: { capability: "fmea:view", table: "fmeas", build: (r) => `${str(r["part_code"])} — ${str(r["part_name"])}` },
};

const LABEL_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  inspections: ["code", "title"],
  ncrs: ["code", "title"],
  eight_ds: ["code", "title"],
  audits: ["code", "title"],
  capas: ["code", "title"],
  documents: ["code", "title"],
  suppliers: ["name", "code"],
  scars: ["code", "title"],
  findings: ["item_ref", "description"],
  risks: ["code", "title"],
  fmeas: ["part_code", "part_name"],
};

interface LinkRow {
  id: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string;
  created_at: Date;
}

const LINK_COLUMNS = "id, from_kind, from_id, to_kind, to_id, relation, created_at";
// Related records are few per entity; one capped page covers every real case.
const LINK_CAP = 200;

function toDto(row: LinkRow, label?: string | null): EntityLinkDto {
  return {
    id: row.id,
    fromKind: row.from_kind as EntityKind,
    fromId: row.from_id,
    toKind: row.to_kind as EntityKind,
    toId: row.to_id,
    relation: row.relation,
    createdAt: row.created_at.toISOString(),
    ...(label !== undefined ? { label } : {}),
  };
}

/**
 * Cross-module related records (FEATURES §329). A link is a directed edge stored
 * once; the detail view of a record reads edges touching it on EITHER side, so
 * the queried record sees both what it points at and what points at it. Creating
 * a link requires both endpoints to resolve within the tenant (rule 8 — a
 * foreign-tenant id is a 404, never a leak). Every link/unlink is audited on the
 * `from` record so it shows up in that record's access log.
 */
@Injectable()
export class EntityLinksService {
  async list(tx: Tx, kind: EntityKind, entityId: string, membership: Membership): Promise<Page<EntityLinkDto>> {
    await assertEntityVisible(tx, kind, entityId, membership);
    const { rows } = await tx.query<LinkRow>(
      `SELECT ${LINK_COLUMNS} FROM entity_links
        WHERE deleted_at IS NULL
          AND ((from_kind = $1 AND from_id = $2) OR (to_kind = $1 AND to_id = $2))
        ORDER BY created_at DESC, id DESC LIMIT $3`,
      [kind, entityId, LINK_CAP],
    );
    const items = await Promise.all(
      rows.map(async (row) => {
        const other: { kind: EntityKind; id: string } =
          row.from_kind === kind && row.from_id === entityId
            ? { kind: row.to_kind as EntityKind, id: row.to_id }
            : { kind: row.from_kind as EntityKind, id: row.from_id };
        const label = await this.resolveLabel(tx, other.kind, other.id, membership);
        return toDto(row, label);
      }),
    );
    return { items, nextCursor: null };
  }

  /** `undefined` (omitted on the wire) when the caller lacks that kind's own
   *  `:view` capability, the target sits in a plant outside the caller's
   *  `membership.plantIds` (SECURITY FIX — same plant-scope boundary
   *  `assertEntityVisible` enforces for the primary entity, extended here to
   *  every *linked* target so a plant-scoped caller can never read a
   *  foreign-plant inspection/NCR/audit/finding's real code+title through an
   *  unscoped CAPA/document/supplier link), or the target row no longer
   *  resolves — never a raw or guessed value (rule 8's spirit, extended to
   *  partial visibility). */
  private async resolveLabel(
    tx: Tx,
    kind: EntityKind,
    id: string,
    membership: Membership,
  ): Promise<string | undefined> {
    const config = LABEL_CONFIG[kind];
    if (!hasCapability(membership.role, config.capability)) return undefined;
    if (!(await isEntityVisible(tx, kind, id, membership))) return undefined;
    const cols = LABEL_COLUMNS[config.table] ?? [];
    if (cols.length === 0) return undefined;
    const { rows } = await tx.query<Record<string, unknown>>(
      `SELECT ${cols.join(", ")} FROM ${config.table} WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? undefined : config.build(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateEntityLinkBody,
    context: AuditContext,
    membership: Membership,
  ): Promise<EntityLinkDto> {
    if (body.fromKind === body.toKind && body.fromId === body.toId) {
      throw new ApiError("VALIDATION_FAILED", "A record cannot be linked to itself");
    }
    await assertEntityVisible(tx, body.fromKind, body.fromId, membership);
    await assertEntityVisible(tx, body.toKind, body.toId, membership);

    const relation = body.relation ?? "linked";
    const { rows: existing } = await tx.query(
      `SELECT 1 FROM entity_links
        WHERE deleted_at IS NULL AND from_kind = $1 AND from_id = $2
          AND to_kind = $3 AND to_id = $4 AND relation = $5`,
      [body.fromKind, body.fromId, body.toKind, body.toId, relation],
    );
    if (existing.length > 0) throw new ApiError("CONFLICT", "These records are already linked");

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: body.fromKind,
        entityId: body.fromId,
        action: "linked",
        after: { toKind: body.toKind, toId: body.toId, relation },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<LinkRow>(
          `INSERT INTO entity_links
             (id, tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
           RETURNING ${LINK_COLUMNS}`,
          [id, tenantId, body.fromKind, body.fromId, body.toKind, body.toId, relation, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Link was not created");
        const label = await this.resolveLabel(t, body.toKind, body.toId, membership);
        return toDto(row, label);
      },
    );
  }

  async remove(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
  ): Promise<EntityLinkDto> {
    const { rows } = await tx.query<LinkRow>(
      `SELECT ${LINK_COLUMNS} FROM entity_links WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: row.from_kind,
        entityId: row.from_id,
        action: "unlinked",
        before: { toKind: row.to_kind, toId: row.to_id, relation: row.relation },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<LinkRow>(
          `UPDATE entity_links SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${LINK_COLUMNS}`,
          [id, actorId],
        );
        return toDto(updated[0] ?? row);
      },
    );
  }
}
