/**
 * Tables that are intentionally NOT tenant-owned, and why.
 *
 * The RLS lint (02 §6) and the tenancy suite (08 §1.1) both enumerate tenant
 * tables dynamically from pg_tables, so a newly added table is in scope by
 * default and must be explicitly excused here. That default-deny direction is
 * the point: forgetting to add a table to a list can't create a hole, only
 * adding one to this list can — and that's a visible, reviewable diff.
 */
export const NON_TENANT_TABLES: ReadonlyMap<string, string> = new Map([
  [
    "_migrations",
    "Migration ledger. Infrastructure, written only by the migrator role.",
  ],
]);

/** Schemas outside the tenant data plane entirely. */
export const NON_TENANT_SCHEMAS: readonly string[] = [
  "control", // tenant registry — the control plane (01 §3.2)
  "information_schema",
  "pg_catalog",
];

export function isTenantTable(schema: string, table: string): boolean {
  if (NON_TENANT_SCHEMAS.includes(schema)) return false;
  return !NON_TENANT_TABLES.has(table);
}
