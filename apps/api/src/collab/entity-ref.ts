import type { Tx } from "@kaenal/db";
import { isPlantScoped, type Membership } from "@kaenal/core";
import type { EntityKind } from "@kaenal/types";
import { notFound } from "../errors.js";

/**
 * The physical table backing each top-level `EntityKind`. Used by the
 * collaboration features (comments, links, access log) to confirm a referenced
 * record actually exists in the current tenant before attaching to it.
 *
 * The map is closed and hard-coded — the table name never comes from a request
 * — so interpolating it into SQL carries no injection risk, while `EntityKind`
 * being a validated enum guarantees a key is always present.
 */
const ENTITY_TABLES: Record<EntityKind, string> = {
  inspection: "inspections",
  ncr: "ncrs",
  eight_d: "eight_ds",
  audit: "audits",
  capa: "capas",
  document: "documents",
  supplier: "suppliers",
  scar: "scars",
  finding: "findings",
  // Sprint 04 R3 AC1 — risk register + FMEA become real graph nodes.
  risk: "risks",
  fmea: "fmeas",
};

export function tableFor(kind: EntityKind): string {
  return ENTITY_TABLES[kind];
}

/**
 * Kinds whose rows carry their own plant scoping (SECURITY FIX, Sprint 04
 * follow-up). Source of truth: `graph.service.ts`'s `PLANT_SCOPED_KINDS` /
 * `chat.ts`'s `ENTITY_SPECS.plantScoped` — the same four kinds every other
 * cross-module surface already treats as plant-scoped. `finding` has no
 * `plant_id` column of its own (0001_core.sql); it is scoped through its
 * parent inspection, exactly like `graph.service.ts` joins it. The rest
 * (`capa`, `document`, `supplier`, `scar`, `eight_d`, `risk`, `fmea`) have no
 * `plant_id` column at all and stay unscoped, per the same source.
 */
const PLANT_SCOPED_KINDS = new Set<EntityKind>(["inspection", "ncr", "audit", "finding"]);

function plantColumnFor(kind: EntityKind): string {
  return kind === "finding" ? "f.plant_id" : "plant_id";
}

/**
 * Resolves the plant a referenced record belongs to, or `undefined` if the
 * record isn't visible in the current tenant at all (RLS already scopes the
 * query to the tenant, so a foreign-tenant id simply returns no row).
 */
async function fetchPlantId(tx: Tx, kind: EntityKind, id: string): Promise<string | null | undefined> {
  if (kind === "finding") {
    const { rows } = await tx.query<{ plant_id: string | null }>(
      `SELECT fi.plant_id FROM findings f JOIN inspections fi ON fi.id = f.inspection_id WHERE f.id = $1`,
      [id],
    );
    return rows[0]?.plant_id;
  }
  const { rows } = await tx.query<{ plant_id: string | null }>(
    `SELECT ${plantColumnFor(kind)} FROM ${ENTITY_TABLES[kind]} WHERE id = $1`,
    [id],
  );
  return rows[0]?.plant_id;
}

/**
 * Throws 404 if the referenced record is not visible to the caller: either it
 * doesn't exist in the current tenant (RLS scopes the query to the tenant, so
 * a foreign-tenant id simply returns no row), or — when `membership` is
 * passed — it does exist but sits in a plant outside the caller's
 * `membership.plantIds` (SECURITY FIX — a plant-scoped role must 404 on a
 * foreign-plant `inspection`/`ncr`/`audit`/`finding` here exactly like it
 * already does on a direct fetch, e.g. `inspections.service.ts`'s
 * `assertInScope`). Either case surfaces as NOT_FOUND, never revealing
 * cross-tenant or cross-plant existence (rule 8).
 *
 * `membership` is optional (not just for `entity-links.service.ts`'s own
 * callers): `comments.service.ts` and `audit-log.service.ts` also call this
 * without a plant check today, and giving them the check unasked would widen
 * this fix beyond its scope — that pre-existing gap is a separate, narrower
 * finding (see security review report). Every call this fix touches passes
 * `membership` explicitly.
 */
export async function assertEntityVisible(tx: Tx, kind: EntityKind, id: string, membership?: Membership): Promise<void> {
  if (membership === undefined || !PLANT_SCOPED_KINDS.has(kind) || !isPlantScoped(membership.role) || membership.plantIds.length === 0) {
    const { rows } = await tx.query(`SELECT 1 FROM ${ENTITY_TABLES[kind]} WHERE id = $1`, [id]);
    if (rows.length === 0) throw notFound();
    return;
  }
  const plantId = await fetchPlantId(tx, kind, id);
  if (plantId === undefined) throw notFound();
  if (plantId === null || !membership.plantIds.includes(plantId)) throw notFound();
}

/**
 * Same visibility check as {@link assertEntityVisible}, but returns whether
 * the record is visible instead of throwing — used to decide whether a
 * *linked* (not primary) entity's label may be resolved, where an invisible
 * target should simply be omitted, not fail the whole request.
 */
export async function isEntityVisible(tx: Tx, kind: EntityKind, id: string, membership: Membership): Promise<boolean> {
  try {
    await assertEntityVisible(tx, kind, id, membership);
    return true;
  } catch {
    return false;
  }
}
