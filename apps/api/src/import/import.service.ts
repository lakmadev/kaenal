import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  getImportTarget,
  IMPORT_TARGETS,
  planImport,
  toImportTargetDto,
  type ImportTargetSpec,
} from "@kaenal/core";
import {
  IMPORT_RESULT_SAMPLE,
  type CommitImportRunBody,
  type CreateImportProfileBody,
  type CreateImportRunBody,
  type DedupePolicy,
  type ImportCounts,
  type ImportMapping,
  type ImportProfileDto,
  type ImportRowResult,
  type ImportRunDto,
  type ImportSourceRow,
  type ImportTargetsResult,
  type ImportTransform,
  type Page,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProfileRow {
  id: string;
  name: string;
  target_entity: string;
  mapping: unknown;
  transform: unknown;
  dedupe_policy: string;
  source_ref: string | null;
  lock_version: number;
  created_at: Date;
}

interface RunRow {
  id: string;
  profile_id: string | null;
  target_entity: string;
  status: string;
  mapping: unknown;
  transform: unknown;
  dedupe_policy: string;
  source_rows: unknown;
  counts: unknown;
  result: unknown;
  error: string | null;
  lock_version: number;
  created_at: Date;
}

const PROFILE_COLS =
  "id, name, target_entity, mapping, transform, dedupe_policy, source_ref, lock_version, created_at";
const RUN_COLS =
  "id, profile_id, target_entity, status, mapping, transform, dedupe_policy, source_rows, counts, result, error, lock_version, created_at";

/**
 * Bulk-import pipeline (09 §6; tables 0033). A run walks Source → Map → Validate
 * → Dry-run → Commit; the mapping is reusable as a profile. All the safety lives
 * in `@kaenal/core`: target tables/columns come only from the IMPORT_TARGETS
 * registry, values are always bound params, and `planImport` computes the exact
 * plan that {@link commit} executes — so a dry run and the real commit can never
 * diverge. Commit is idempotent by the target's natural key (ON CONFLICT), so a
 * re-run of the same file writes nothing new. Every write is audited; the whole
 * surface needs `import:run`.
 */
@Injectable()
export class ImportService {
  targets(): ImportTargetsResult {
    return { items: Object.values(IMPORT_TARGETS).map(toImportTargetDto) };
  }

  // --- Profiles -------------------------------------------------------------

  async listProfiles(tx: Tx): Promise<Page<ImportProfileDto>> {
    const { rows } = await tx.query<ProfileRow>(
      `SELECT ${PROFILE_COLS} FROM import_profiles WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC`,
    );
    return { items: rows.map(toProfileDto), nextCursor: null };
  }

  async createProfile(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateImportProfileBody,
    ctx: AuditContext,
  ): Promise<ImportProfileDto> {
    requireTarget(body.targetEntity);
    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "created", "import_profile", id, ctx, { after: { name: body.name, target: body.targetEntity } }),
      async (t) => {
        const { rows } = await t.query<ProfileRow>(
          `INSERT INTO import_profiles
             (id, tenant_id, name, target_entity, mapping, transform, dedupe_policy, source_ref, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING ${PROFILE_COLS}`,
          [
            id,
            tenantId,
            body.name,
            body.targetEntity,
            JSON.stringify(body.mapping),
            JSON.stringify(body.transform),
            body.dedupePolicy,
            body.sourceRef ?? null,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Import profile was not created");
        return toProfileDto(row);
      },
    );
  }

  async removeProfile(tx: Tx, tenantId: string, actorId: string, id: string, ctx: AuditContext): Promise<ImportProfileDto> {
    const row = await this.loadProfile(tx, id);
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "deleted", "import_profile", id, ctx, { before: { name: row.name } }),
      async (t) => {
        const { rows } = await t.query<ProfileRow>(
          `UPDATE import_profiles SET deleted_at = now(), updated_by = $2
            WHERE id = $1 AND deleted_at IS NULL RETURNING ${PROFILE_COLS}`,
          [id, actorId],
        );
        return toProfileDto(rows[0] ?? row);
      },
    );
  }

  private async loadProfile(tx: Tx, id: string): Promise<ProfileRow> {
    if (!UUID_RE.test(id)) throw notFound();
    const { rows } = await tx.query<ProfileRow>(
      `SELECT ${PROFILE_COLS} FROM import_profiles WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  // --- Runs -----------------------------------------------------------------

  async listRuns(tx: Tx): Promise<Page<ImportRunDto>> {
    const { rows } = await tx.query<RunRow>(
      `SELECT ${RUN_COLS} FROM import_runs WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC`,
    );
    return { items: rows.map(toRunDto), nextCursor: null };
  }

  async getRun(tx: Tx, id: string): Promise<ImportRunDto> {
    return toRunDto(await this.loadRun(tx, id));
  }

  private async loadRun(tx: Tx, id: string): Promise<RunRow> {
    if (!UUID_RE.test(id)) throw notFound();
    const { rows } = await tx.query<RunRow>(`SELECT ${RUN_COLS} FROM import_runs WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const row = rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  /**
   * Create a run: resolve the mapping (inline, or inherited from a profile),
   * stage the rows, and immediately validate + dry-run them against the live set
   * of existing natural keys. NOTHING is written — the run lands in `validated`
   * with counts + a capped row-level sample. A blocked mapping (unknown target,
   * missing natural-key mapping) is a 422.
   */
  async createRun(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateImportRunBody,
    ctx: AuditContext,
  ): Promise<ImportRunDto> {
    const target = requireTarget(body.targetEntity);

    // Inherit the mapping from a saved profile when one is named; inline wins if
    // provided. Either way the target must match the profile's target.
    let mapping: ImportMapping = body.mapping;
    let transform: ImportTransform = body.transform;
    let dedupePolicy: DedupePolicy = body.dedupePolicy;
    let profileId: string | null = null;
    if (body.profileId !== undefined) {
      const profile = await this.loadProfile(tx, body.profileId);
      if (profile.target_entity !== body.targetEntity) {
        throw new ApiError("VALIDATION_FAILED", "Profile targets a different entity than the run");
      }
      profileId = profile.id;
      if (Object.keys(mapping).length === 0) mapping = profile.mapping as ImportMapping;
      if (Object.keys(transform).length === 0) transform = profile.transform as ImportTransform;
      dedupePolicy = body.dedupePolicy;
    }

    if (mapping[target.naturalKey] === undefined) {
      throw new ApiError("VALIDATION_FAILED", `The natural key \`${target.naturalKey}\` must be mapped`);
    }

    const existingKeys = await this.existingKeys(tx, target);
    const { results, counts } = planImport(target, body.rows, mapping, transform, existingKeys, dedupePolicy);

    const id = randomUUID();
    return withAudit(
      tx,
      tenantId,
      audit(actorId, "created", "import_run", id, ctx, { after: { target: body.targetEntity, total: counts.total } }),
      async (t) => {
        const { rows } = await t.query<RunRow>(
          `INSERT INTO import_runs
             (id, tenant_id, profile_id, target_entity, status, mapping, transform, dedupe_policy, source_rows, counts, result, created_by, updated_by)
           VALUES ($1,$2,$3,$4,'validated',$5,$6,$7,$8,$9,$10,$11,$11) RETURNING ${RUN_COLS}`,
          [
            id,
            tenantId,
            profileId,
            body.targetEntity,
            JSON.stringify(mapping),
            JSON.stringify(transform),
            dedupePolicy,
            JSON.stringify(body.rows),
            JSON.stringify(counts),
            JSON.stringify(sampleResults(results)),
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Import run was not created");
        return toRunDto(row);
      },
    );
  }

  /**
   * Commit a validated run: re-plan against the CURRENT keys (the workspace may
   * have changed since validate), then upsert every non-error row idempotently by
   * natural key. `ON CONFLICT (tenant_id, natural_key)` means a re-run of the same
   * file updates in place rather than duplicating — the commit is safe to retry.
   * Runs in the request transaction under RLS; see PROGRESS for the async-at-scale
   * note (the body is already a standalone tenant-tx step ready to move to a job).
   */
  async commit(
    tx: Tx,
    tenantId: string,
    actorId: string,
    id: string,
    body: CommitImportRunBody,
    ctx: AuditContext,
  ): Promise<ImportRunDto> {
    const run = await this.loadRun(tx, id);
    assertVersion(run.lock_version, body.version);
    if (run.status !== "validated") {
      throw new ApiError("VALIDATION_FAILED", `Only a validated run can be committed (this run is ${run.status})`);
    }
    const target = requireTarget(run.target_entity);
    const rows = run.source_rows as ImportSourceRow[];
    const mapping = run.mapping as ImportMapping;
    const transform = run.transform as ImportTransform;
    const dedupePolicy = run.dedupe_policy as DedupePolicy;

    return withAudit(
      tx,
      tenantId,
      audit(actorId, "updated", "import_run", id, ctx, { before: { status: run.status }, after: { status: "committing" } }),
      async (t) => {
        const existingKeys = await this.existingKeys(t, target);
        const { results, counts } = planImport(target, rows, mapping, transform, existingKeys, dedupePolicy);

        for (let i = 0; i < rows.length; i++) {
          const result = results[i];
          if (result === undefined || result.status === "error" || result.status === "skip") continue;
          await this.upsertRow(t, tenantId, actorId, target, rows[i]!, mapping, transform);
        }

        const { rows: updated } = await t.query<RunRow>(
          `UPDATE import_runs SET status='completed', counts=$2, result=$3, error=NULL, updated_by=$4
            WHERE id=$1 AND lock_version=$5 AND deleted_at IS NULL RETURNING ${RUN_COLS}`,
          [id, JSON.stringify(counts), JSON.stringify(sampleResults(results)), actorId, body.version],
        );
        const row = updated[0];
        if (row === undefined) throw staleWrite();
        return toRunDto(row);
      },
    );
  }

  /** Upsert one row into the target, idempotent by the tenant-scoped natural key. */
  private async upsertRow(
    t: Tx,
    tenantId: string,
    actorId: string,
    target: ImportTargetSpec,
    row: ImportSourceRow,
    mapping: ImportMapping,
    transform: ImportTransform,
  ): Promise<void> {
    // Re-derive the mapped values here (planImport already validated them). Column
    // identifiers come ONLY from the registry; values are bound params.
    const cols: string[] = ["tenant_id", "created_by", "updated_by"];
    const vals: unknown[] = [tenantId, actorId, actorId];
    for (const field of target.fields) {
      const sourceCol = mapping[field.key];
      if (sourceCol === undefined) continue;
      const raw = row[sourceCol];
      if (raw === undefined) continue;
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const value = transform[field.key]?.[trimmed] ?? trimmed;
      cols.push(field.column);
      vals.push(field.type === "num" ? Number(value) : value);
    }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    // Update every mapped non-key column on conflict; never the natural key.
    const updatable = cols.filter((c) => c !== "tenant_id" && c !== target.naturalKeyColumn && c !== "created_by");
    const setClause = updatable.map((c) => `${c} = EXCLUDED.${c}`).concat("updated_at = now()").join(", ");
    await t.query(
      `INSERT INTO ${target.table} (${cols.join(", ")}) VALUES (${placeholders})
       ON CONFLICT (tenant_id, ${target.naturalKeyColumn}) DO UPDATE SET ${setClause}`,
      vals,
    );
  }

  /** The set of natural-key values already present in the target for this tenant. */
  private async existingKeys(tx: Tx, target: ImportTargetSpec): Promise<Set<string>> {
    const { rows } = await tx.query<{ key: string }>(
      `SELECT ${target.naturalKeyColumn} AS key FROM ${target.table} WHERE deleted_at IS NULL`,
    );
    return new Set(rows.map((r) => r.key));
  }
}

function requireTarget(id: string): ImportTargetSpec {
  const target = getImportTarget(id);
  if (target === undefined) throw new ApiError("VALIDATION_FAILED", `Unknown import target: ${id}`);
  return target;
}

/** Persist errors/warnings first so the capped sample is the useful rows. */
function sampleResults(results: ImportRowResult[]): ImportRowResult[] {
  const flagged = results.filter((r) => r.errors.length > 0 || r.warnings.length > 0);
  const clean = results.filter((r) => r.errors.length === 0 && r.warnings.length === 0);
  return [...flagged, ...clean].slice(0, IMPORT_RESULT_SAMPLE);
}

function toProfileDto(row: ProfileRow): ImportProfileDto {
  return {
    id: row.id,
    name: row.name,
    targetEntity: row.target_entity as ImportProfileDto["targetEntity"],
    mapping: (row.mapping ?? {}) as ImportMapping,
    transform: (row.transform ?? {}) as ImportTransform,
    dedupePolicy: row.dedupe_policy as DedupePolicy,
    sourceRef: row.source_ref,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
  };
}

const ZERO_COUNTS: ImportCounts = { total: 0, valid: 0, errors: 0, warnings: 0, created: 0, updated: 0, skipped: 0 };

function toRunDto(row: RunRow): ImportRunDto {
  return {
    id: row.id,
    profileId: row.profile_id,
    targetEntity: row.target_entity as ImportRunDto["targetEntity"],
    status: row.status as ImportRunDto["status"],
    mapping: (row.mapping ?? {}) as ImportMapping,
    transform: (row.transform ?? {}) as ImportTransform,
    dedupePolicy: row.dedupe_policy as DedupePolicy,
    counts: { ...ZERO_COUNTS, ...((row.counts ?? {}) as Partial<ImportCounts>) },
    result: (row.result ?? []) as ImportRowResult[],
    error: row.error,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
  };
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) throw new ApiError("STALE_WRITE", "This import run changed since you loaded it", { expected, actual });
}
function staleWrite(): ApiError {
  return new ApiError("STALE_WRITE", "This import run changed since you loaded it");
}

type AuditVerb = "created" | "updated" | "deleted";
function audit(
  actorId: string,
  action: AuditVerb,
  entityKind: string,
  entityId: string,
  ctx: AuditContext,
  data: { before?: Record<string, unknown>; after?: Record<string, unknown> },
) {
  return {
    actorId,
    actorKind: "user" as const,
    entityKind,
    entityId,
    action,
    ...(data.before !== undefined ? { before: data.before } : {}),
    ...(data.after !== undefined ? { after: data.after } : {}),
    requestId: ctx.requestId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}
