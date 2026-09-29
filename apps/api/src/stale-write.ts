import type { Tx } from "@kaenal/db";
import type { StaleWriteDetails } from "@kaenal/types";
import { ApiError } from "./errors.js";

/**
 * Optimistic-concurrency 409s (03 §6): one place builds the STALE_WRITE detail
 * so every site carries {expected, actual, updatedAt, updatedBy}. Table names
 * come from this closed map (never caller strings) and the lookups run in the
 * caller's tenant-scoped tx, so RLS bounds both the row and the actor.
 */
const KEY_COLUMN = {
  legal_holds: "id",
  ncr_validation_rules: "id",
  dlp_policies: "id",
  eight_ds: "id",
  tenant_settings: "namespace",
  cost_centers: "id",
  audits: "id",
  audit_findings: "id",
  suppliers: "id",
  capas: "id",
  capa_actions: "id",
  scars: "id",
  inspection_templates: "id",
  inspections: "id",
  fmeas: "id",
  fmea_items: "id",
  ncrs: "id",
  ncr_actions: "id",
  findings: "id",
  files: "id",
  documents: "id",
  document_versions: "id",
  integrations: "id",
  report_definitions: "id",
  ppap_submissions: "id",
  import_runs: "id",
  import_profiles: "id",
  user_preferences: "user_id",
  // Sprint 04 R1/M1.
  risks: "id",
  msa_studies: "id",
} as const;

export type StaleTable = keyof typeof KEY_COLUMN;

interface StaleRow {
  updated_at: Date | string | null;
  updated_by: string | null;
}

export interface StaleWriteInput {
  readonly table: StaleTable;
  /** Row key (uuid, or the namespace for tenant_settings). */
  readonly key: string;
  readonly message: string;
  readonly expected?: number;
  readonly actual?: number;
}

/** Pure shape builder, exported for tests. */
export function buildStaleDetails(
  row: StaleRow | undefined,
  actor: { id: string; name: string } | undefined,
  versions: { expected?: number; actual?: number },
): StaleWriteDetails {
  const at = row?.updated_at ?? null;
  return {
    ...(versions.expected !== undefined ? { expected: versions.expected } : {}),
    ...(versions.actual !== undefined ? { actual: versions.actual } : {}),
    updatedAt: at === null ? null : new Date(at).toISOString(),
    updatedBy: actor ?? null,
  };
}

export async function staleWriteError(tx: Tx, input: StaleWriteInput): Promise<ApiError> {
  const col = KEY_COLUMN[input.table];
  const { rows } = await tx.query<StaleRow>(
    `SELECT updated_at, updated_by FROM ${input.table} WHERE ${col} = $1`,
    [input.key],
  );
  const row = rows[0];
  let actor: { id: string; name: string } | undefined;
  if (row?.updated_by) {
    // memberships is RLS-scoped: a user outside this tenant resolves to nothing.
    const { rows: u } = await tx.query<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM memberships m JOIN control.users u ON u.id = m.user_id
        WHERE m.user_id = $1 LIMIT 1`,
      [row.updated_by],
    );
    actor = u[0];
  }
  return new ApiError(
    "STALE_WRITE",
    input.message,
    { ...buildStaleDetails(row, actor, input) },
  );
}
