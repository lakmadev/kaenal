import type { Tx } from "@kaenal/db";
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
};

export function tableFor(kind: EntityKind): string {
  return ENTITY_TABLES[kind];
}

/**
 * Throws 404 if the referenced record is not visible in the current tenant.
 * RLS scopes the query to the tenant, so a foreign-tenant id simply returns no
 * row — surfaced as NOT_FOUND, never revealing cross-tenant existence (rule 8).
 */
export async function assertEntityVisible(tx: Tx, kind: EntityKind, id: string): Promise<void> {
  const { rows } = await tx.query(`SELECT 1 FROM ${ENTITY_TABLES[kind]} WHERE id = $1`, [id]);
  if (rows.length === 0) throw notFound();
}
