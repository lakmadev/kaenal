import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import { isTenantWideScope, type LegalHoldScope } from "@kaenal/core";
import {
  LegalHoldEntityKind,
  type CreateLegalHoldBody,
  type LegalHoldDto,
  type LegalHoldScopeInput,
  type Page,
  type UpdateLegalHoldBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface HoldRow {
  id: string;
  reference: string;
  name: string;
  matter: string;
  scope: LegalHoldScope;
  reason: string;
  released_at: Date | string | null;
  opened_at: Date | string;
  lock_version: number;
}

const COLS =
  "id, reference, name, matter, scope, reason, released_at, created_at AS opened_at, lock_version";
const ENTITY_KIND = "legal_hold";

/** pg returns timestamptz as a Date (or string, depending on parser) — normalize. */
function iso(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

/** API scope → the stored jsonb shape the purge job reads (07 §5). */
function storedFromInput(input: LegalHoldScopeInput): Record<string, unknown> {
  switch (input.mode) {
    case "tenant":
      return {};
    case "kinds":
      return { entityKinds: input.entityKinds };
    case "record":
      return input.entityId !== undefined
        ? { entityKind: input.entityKind, entityId: input.entityId }
        : { entityKind: input.entityKind };
  }
}

/** Stored jsonb → API scope. Defensive: any kind outside the register vocabulary
 *  (e.g. a legacy/programmatic hold) reads back as tenant-wide, the safe display
 *  that never understates coverage. */
function inputFromStored(scope: LegalHoldScope): LegalHoldScopeInput {
  if (isTenantWideScope(scope)) return { mode: "tenant" };
  if (Array.isArray(scope.entityKinds) && scope.entityKinds.length > 0) {
    const kinds = scope.entityKinds.filter(
      (k): k is LegalHoldEntityKind => LegalHoldEntityKind.safeParse(k).success,
    );
    return kinds.length > 0 ? { mode: "kinds", entityKinds: kinds } : { mode: "tenant" };
  }
  if (scope.entityKind !== undefined && LegalHoldEntityKind.safeParse(scope.entityKind).success) {
    const entityKind = scope.entityKind as LegalHoldEntityKind;
    return scope.entityId !== undefined
      ? { mode: "record", entityKind, entityId: scope.entityId }
      : { mode: "record", entityKind };
  }
  return { mode: "tenant" };
}

function toDto(row: HoldRow): LegalHoldDto {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    matter: row.matter,
    scope: inputFromStored(row.scope),
    status: row.released_at === null ? "active" : "released",
    notes: row.reason,
    openedAt: iso(row.opened_at) ?? new Date().toISOString(),
    releasedAt: iso(row.released_at),
    lockVersion: row.lock_version,
  };
}

/**
 * Legal-hold register CRUD (04 §Settings > Compliance & Privacy) on the
 * foundational `legal_holds` table (0001, extended 0028). A hold is `active`
 * while `released_at IS NULL`; releasing it stamps `released_at` (the one domain
 * transition in the design). Holds are genuinely enforced — the nightly purge
 * job won't permanently erase soft-deleted rows an active hold's `scope` covers.
 * Managed under `settings:manage`, audited in the same transaction (rule 3), and
 * optimistic on edit/release (rule 6).
 */
@Injectable()
export class LegalHoldsService {
  async list(tx: Tx): Promise<Page<LegalHoldDto>> {
    const { rows } = await tx.query<HoldRow>(
      `SELECT ${COLS} FROM legal_holds WHERE deleted_at IS NULL
        ORDER BY created_at DESC, id DESC`,
    );
    return { items: rows.map(toDto), nextCursor: null };
  }

  /** Best-effort human reference `LH-YYYY-NNN`, sequential within the tenant-year. */
  private async nextReference(tx: Tx): Promise<string> {
    const { rows } = await tx.query<{ year: number; n: number }>(
      `SELECT date_part('year', now())::int AS year,
              count(*)::int AS n
         FROM legal_holds
        WHERE date_part('year', created_at) = date_part('year', now())`,
    );
    const { year, n } = rows[0] ?? { year: new Date().getFullYear(), n: 0 };
    return `LH-${year}-${String(n + 1).padStart(3, "0")}`;
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateLegalHoldBody,
    context: AuditContext,
  ): Promise<LegalHoldDto> {
    const id = randomUUID();
    const reference = await this.nextReference(tx);
    const scope = storedFromInput(body.scope);
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        after: { reference, name: body.name, matter: body.matter, scope, status: "active" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<HoldRow>(
          `INSERT INTO legal_holds
             (id, tenant_id, reference, name, matter, scope, reason, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$8)
           RETURNING ${COLS}`,
          [id, tenantId, reference, body.name, body.matter, JSON.stringify(scope), body.notes, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Hold was not created");
        return toDto(row);
      },
    );
  }

  private async load(tx: Tx, id: string): Promise<HoldRow> {
    const { rows } = await tx.query<HoldRow>(
      `SELECT ${COLS} FROM legal_holds WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async update(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: UpdateLegalHoldBody,
    context: AuditContext,
  ): Promise<LegalHoldDto> {
    const current = await this.load(tx, id);
    if (current.lock_version !== body.version) {
      throw new ApiError("STALE_WRITE", "This hold changed since you loaded it", {
        expected: body.version,
        actual: current.lock_version,
      });
    }
    const scope = storedFromInput(body.scope);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        before: { name: current.name, matter: current.matter, scope: current.scope },
        after: { name: body.name, matter: body.matter, scope },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<HoldRow>(
          `UPDATE legal_holds
              SET name=$3, matter=$4, scope=$5::jsonb, reason=$6, updated_by=$7
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL
            RETURNING ${COLS}`,
          [id, body.version, body.name, body.matter, JSON.stringify(scope), body.notes, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "This hold changed since you loaded it");
        return toDto(row);
      },
    );
  }

  /** Release a hold: stamp released_at so the purge job stops protecting its scope. */
  async release(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    version: number,
    context: AuditContext,
  ): Promise<LegalHoldDto> {
    const current = await this.load(tx, id);
    if (current.lock_version !== version) {
      throw new ApiError("STALE_WRITE", "This hold changed since you loaded it", {
        expected: version,
        actual: current.lock_version,
      });
    }
    if (current.released_at !== null) {
      throw new ApiError("CONFLICT", "This hold is already released");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        before: { status: "active" },
        after: { status: "released" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<HoldRow>(
          `UPDATE legal_holds
              SET released_at=now(), updated_by=$3
            WHERE id=$1 AND lock_version=$2 AND deleted_at IS NULL
            RETURNING ${COLS}`,
          [id, version, actorId],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "This hold changed since you loaded it");
        return toDto(row);
      },
    );
  }

  /**
   * Retract a hold from the register. Soft-deletes it AND releases it in the same
   * write, so a hidden row can never keep silently blocking purge (the purge job
   * keys off `released_at`, not `deleted_at`).
   */
  async remove(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    context: AuditContext,
  ): Promise<LegalHoldDto> {
    const row = await this.load(tx, id);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: ENTITY_KIND,
        entityId: id,
        action: "settings_changed",
        before: { reference: row.reference, deleted: false },
        after: { reference: row.reference, deleted: true },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows: updated } = await t.query<HoldRow>(
          `UPDATE legal_holds
              SET deleted_at = now(), released_at = COALESCE(released_at, now()), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`,
          [id, actorId],
        );
        return toDto(updated[0] ?? row);
      },
    );
  }
}
