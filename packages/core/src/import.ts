/**
 * Bulk-import target registry + the pure pipeline logic (Data Platform B4;
 * 09-INTEGRATIONS §6). This is the authority the API validates and upserts
 * against — like the query engine's source registry, target tables and columns
 * come ONLY from here, never from request input, so a mapping can never name a
 * column that isn't a real, importable field. The functions are pure (no DB): the
 * service supplies the set of existing natural keys, so validate + dry-run are
 * testable in isolation and identical to what commit will do.
 */

import type {
  DedupePolicy,
  ImportCounts,
  ImportFieldDto,
  ImportMapping,
  ImportRowResult,
  ImportSourceRow,
  ImportTarget,
  ImportTargetDto,
  ImportTransform,
} from "@kaenal/types";
import type { Capability } from "./rbac.js";

export interface ImportFieldSpec {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "num";
  readonly required: boolean;
  /** The db column this field writes to (whitelisted — never from request input). */
  readonly column: string;
  /** For an enum column, the allowed values; null otherwise. */
  readonly options: readonly string[] | null;
}

export interface ImportTargetSpec {
  readonly id: ImportTarget;
  readonly label: string;
  readonly table: string;
  /** The field key forming the natural key (duplicate detection / ON CONFLICT). */
  readonly naturalKey: string;
  /** The db column of the natural key (part of the tenant-scoped unique index). */
  readonly naturalKeyColumn: string;
  readonly fields: readonly ImportFieldSpec[];
  /** Capability that owns this target's authoring surface (defence in depth). */
  readonly capability: Capability;
}

const SUPPLIER_STATUS = ["active", "probation", "suspended", "inactive"] as const;
const RISK_TIER = ["low", "medium", "high", "critical"] as const;

/**
 * The importable targets. Suppliers is the canonical masters-data target (09 §55:
 * "match by supplier code"); the natural key is `code`, unique per tenant. Adding
 * a target is a registry entry + the CHECK in 0033 — the pipeline is generic.
 */
export const IMPORT_TARGETS: Readonly<Record<ImportTarget, ImportTargetSpec>> = {
  suppliers: {
    id: "suppliers",
    label: "Suppliers",
    table: "suppliers",
    naturalKey: "code",
    naturalKeyColumn: "code",
    capability: "supplier:manage",
    fields: [
      { key: "code", label: "Supplier code", type: "text", required: true, column: "code", options: null },
      { key: "name", label: "Name", type: "text", required: true, column: "name", options: null },
      { key: "status", label: "Status", type: "text", required: false, column: "status", options: SUPPLIER_STATUS },
      { key: "riskTier", label: "Risk tier", type: "text", required: false, column: "risk_tier", options: RISK_TIER },
      { key: "tier", label: "Tier", type: "num", required: false, column: "tier", options: null },
    ],
  },
};

export function getImportTarget(id: string): ImportTargetSpec | undefined {
  return Object.prototype.hasOwnProperty.call(IMPORT_TARGETS, id)
    ? IMPORT_TARGETS[id as ImportTarget]
    : undefined;
}

export function toImportTargetDto(target: ImportTargetSpec): ImportTargetDto {
  const fields: ImportFieldDto[] = target.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    naturalKey: f.key === target.naturalKey,
    options: f.options === null ? null : [...f.options],
  }));
  return { id: target.id, label: target.label, fields };
}

/** A mapped, transformed row: target-field-key → string value (present keys only). */
export type MappedRow = Record<string, string>;

/**
 * Project one source row through the mapping + transforms into target fields.
 * A blank/whitespace value is treated as absent, so an empty cell doesn't count
 * as "provided". Unknown target keys in the mapping are ignored (the target
 * registry is the whitelist).
 */
export function applyMapping(
  target: ImportTargetSpec,
  row: ImportSourceRow,
  mapping: ImportMapping,
  transform: ImportTransform,
): MappedRow {
  const out: MappedRow = {};
  for (const field of target.fields) {
    const sourceCol = mapping[field.key];
    if (sourceCol === undefined) continue;
    const raw = row[sourceCol];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const remap = transform[field.key];
    out[field.key] = remap?.[trimmed] ?? trimmed;
  }
  return out;
}

/** Validate a mapped row against the target's field rules. Pure. */
export function validateMappedRow(
  target: ImportTargetSpec,
  mapped: MappedRow,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const field of target.fields) {
    const value = mapped[field.key];
    if (value === undefined) {
      if (field.required) errors.push(`Required field \`${field.label}\` is missing or empty`);
      else if (field.options !== null) warnings.push(`\`${field.label}\` not provided — the default applies`);
      continue;
    }
    if (field.type === "num" && !Number.isFinite(Number(value))) {
      errors.push(`\`${field.label}\` must be a number — got "${value}"`);
    }
    if (field.options !== null && !field.options.includes(value)) {
      errors.push(`\`${field.label}\` must be one of {${field.options.join(", ")}} — got "${value}"`);
    }
  }
  return { errors, warnings };
}

const emptyCounts = (): ImportCounts => ({
  total: 0,
  valid: 0,
  errors: 0,
  warnings: 0,
  created: 0,
  updated: 0,
  skipped: 0,
});

/**
 * Validate + dry-run every row against the target and the set of natural keys
 * that already exist in the workspace. Returns a per-row result plus roll-up
 * counts. Nothing is written — this is exactly the plan `commit` executes, so a
 * dry run and the real commit can never diverge.
 *
 * Dedupe policy on an existing key: `skip` → skip, `update` → update in place,
 * `create` → still an insert (the DB's unique index will reject a true dup at
 * commit, surfaced as a row error there).
 */
export function planImport(
  target: ImportTargetSpec,
  rows: readonly ImportSourceRow[],
  mapping: ImportMapping,
  transform: ImportTransform,
  existingKeys: ReadonlySet<string>,
  dedupePolicy: DedupePolicy,
): { results: ImportRowResult[]; counts: ImportCounts } {
  const counts = emptyCounts();
  const results: ImportRowResult[] = [];
  // Within-file duplicates on the natural key: the first wins, the rest are
  // flagged so a commit is deterministic.
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    counts.total += 1;
    const mapped = applyMapping(target, row, mapping, transform);
    const key = mapped[target.naturalKey] ?? null;
    const { errors, warnings } = validateMappedRow(target, mapped);

    if (key !== null) {
      if (seen.has(key)) errors.push(`Duplicate \`${target.naturalKey}\` "${key}" earlier in this file`);
      else seen.add(key);
    }

    let status: ImportRowResult["status"];
    if (errors.length > 0) {
      status = "error";
      counts.errors += 1;
    } else {
      const exists = key !== null && existingKeys.has(key);
      if (exists && dedupePolicy === "skip") {
        status = "skip";
        counts.skipped += 1;
      } else if (exists && dedupePolicy === "update") {
        status = "update";
        counts.updated += 1;
      } else {
        status = "create";
        counts.created += 1;
      }
      counts.valid += 1;
    }
    if (warnings.length > 0) counts.warnings += 1;

    results.push({ row: i + 1, key, status, errors, warnings });
  });

  return { results, counts };
}
