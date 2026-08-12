import { z } from "zod";

/**
 * Bulk-import pipeline (09-INTEGRATIONS §6; operations.jsx `BulkImport`).
 * A run walks Source → Map → Validate → Dry-run → Commit. The mapping (which
 * source column feeds each target field) + value transforms + a duplicate policy
 * are reusable as an `import_profile`; a `run` is one execution over staged rows.
 * The target's field schema + natural key live in `packages/core` (the authority
 * the API validates and upserts against) — these are the wire shapes.
 */

/** Entities a bulk import can target. Mirrors the core IMPORT_TARGETS registry. */
export const IMPORT_TARGETS = ["suppliers"] as const;
export const ImportTarget = z.enum(IMPORT_TARGETS);
export type ImportTarget = z.infer<typeof ImportTarget>;

/** What to do when a row's natural key already exists in the workspace. */
export const DEDUPE_POLICIES = ["skip", "update", "create"] as const;
export const DedupePolicy = z.enum(DEDUPE_POLICIES);
export type DedupePolicy = z.infer<typeof DedupePolicy>;

export const IMPORT_RUN_STATUSES = ["pending", "validated", "committing", "completed", "failed"] as const;
export const ImportRunStatus = z.enum(IMPORT_RUN_STATUSES);
export type ImportRunStatus = z.infer<typeof ImportRunStatus>;

/** Max rows a single run may stage/commit (09 §6). */
export const IMPORT_MAX_ROWS = 50_000;
/** Max row-level results persisted on a run (the rest roll up into `counts`). */
export const IMPORT_RESULT_SAMPLE = 500;

/** { targetField: sourceColumn }. */
export const ImportMapping = z.record(z.string(), z.string());
export type ImportMapping = z.infer<typeof ImportMapping>;

/** { targetField: { fromValue: toValue } } — per-field value remaps. */
export const ImportTransform = z.record(z.string(), z.record(z.string(), z.string()));
export type ImportTransform = z.infer<typeof ImportTransform>;

/** A staged source row: a flat column→value map (strings, as parsed from a file). */
export const ImportSourceRow = z.record(z.string(), z.string());
export type ImportSourceRow = z.infer<typeof ImportSourceRow>;

// --- Target field schema (returned by GET /v1/import/targets) --------------

export const ImportFieldDto = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "num"]),
  required: z.boolean(),
  /** True for the field(s) forming the natural key (duplicate detection). */
  naturalKey: z.boolean(),
  /** For an enum field, the allowed values (validation surfaces bad ones). */
  options: z.array(z.string()).nullable(),
});
export type ImportFieldDto = z.infer<typeof ImportFieldDto>;

export const ImportTargetDto = z.object({
  id: ImportTarget,
  label: z.string(),
  fields: z.array(ImportFieldDto),
});
export type ImportTargetDto = z.infer<typeof ImportTargetDto>;

export const ImportTargetsResult = z.object({ items: z.array(ImportTargetDto) });
export type ImportTargetsResult = z.infer<typeof ImportTargetsResult>;

// --- Profiles ---------------------------------------------------------------

export const ImportProfileDto = z.object({
  id: z.string(),
  name: z.string(),
  targetEntity: ImportTarget,
  mapping: ImportMapping,
  transform: ImportTransform,
  dedupePolicy: DedupePolicy,
  sourceRef: z.string().nullable(),
  lockVersion: z.number(),
  createdAt: z.string(),
});
export type ImportProfileDto = z.infer<typeof ImportProfileDto>;

export const CreateImportProfileBody = z.object({
  name: z.string().min(1).max(120),
  targetEntity: ImportTarget,
  mapping: ImportMapping.default({}),
  transform: ImportTransform.default({}),
  dedupePolicy: DedupePolicy.default("update"),
  sourceRef: z.string().max(400).optional(),
});
export type CreateImportProfileBody = z.infer<typeof CreateImportProfileBody>;

// --- Runs -------------------------------------------------------------------

/** One row's validation/commit outcome. */
export const ImportRowResult = z.object({
  /** 1-based index into the submitted source rows. */
  row: z.number(),
  /** The row's natural-key value (for duplicate reporting), or null if unmapped. */
  key: z.string().nullable(),
  status: z.enum(["create", "update", "skip", "error"]),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ImportRowResult = z.infer<typeof ImportRowResult>;

export const ImportCounts = z.object({
  total: z.number(),
  valid: z.number(),
  errors: z.number(),
  warnings: z.number(),
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
});
export type ImportCounts = z.infer<typeof ImportCounts>;

export const ImportRunDto = z.object({
  id: z.string(),
  profileId: z.string().nullable(),
  targetEntity: ImportTarget,
  status: ImportRunStatus,
  mapping: ImportMapping,
  transform: ImportTransform,
  dedupePolicy: DedupePolicy,
  counts: ImportCounts,
  /** A capped sample of per-row results (errors/warnings first). */
  result: z.array(ImportRowResult),
  error: z.string().nullable(),
  lockVersion: z.number(),
  createdAt: z.string(),
});
export type ImportRunDto = z.infer<typeof ImportRunDto>;

/**
 * Create a run: stage rows + a mapping (inline, or inherited from a profile) and
 * immediately validate + dry-run them — the response carries the counts and the
 * row-level sample. NOTHING is written until an explicit commit.
 */
export const CreateImportRunBody = z
  .object({
    profileId: z.string().uuid().optional(),
    targetEntity: ImportTarget,
    mapping: ImportMapping.default({}),
    transform: ImportTransform.default({}),
    dedupePolicy: DedupePolicy.default("update"),
    rows: z.array(ImportSourceRow).max(IMPORT_MAX_ROWS),
  })
  .strict();
export type CreateImportRunBody = z.infer<typeof CreateImportRunBody>;

/** Commit a validated run — optimistic on the run's lock_version. */
export const CommitImportRunBody = z.object({ version: z.number().int().nonnegative() });
export type CommitImportRunBody = z.infer<typeof CommitImportRunBody>;
