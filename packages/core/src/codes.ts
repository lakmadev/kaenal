/**
 * Human-facing entity codes (01 §4): `NCR-2026-0142`.
 *
 * Separate from the uuid PK — people read, say and file these, so they are
 * per-tenant, per-year, and never recycled even if the row is deleted (02 §7).
 * The sequence value itself comes from the `counters` table via
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, which serialises concurrent
 * creates on the row lock; this module only formats and parses.
 */

export type CodeKind =
  | "ncr"
  | "inspection"
  | "eight_d"
  | "capa"
  | "audit"
  | "document"
  | "scar"
  | "supplier";

const PREFIXES: Readonly<Record<CodeKind, string>> = {
  ncr: "NCR",
  inspection: "INS",
  eight_d: "8D",
  capa: "CAPA",
  audit: "AUD",
  document: "DOC",
  scar: "SCAR",
  supplier: "SUP",
};

/** Sequence width. Numbers beyond 9999 simply get longer rather than wrapping. */
const SEQUENCE_PAD = 4;

export function formatCode(kind: CodeKind, year: number, sequence: number): string {
  const prefix = PREFIXES[kind];
  if (!prefix) throw new Error(`Unknown code kind '${kind}'`);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Sequence must be a positive integer, got ${sequence}`);
  }
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`Year out of range: ${year}`);
  }
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_PAD, "0")}`;
}

export interface ParsedCode {
  readonly kind: CodeKind;
  readonly year: number;
  readonly sequence: number;
}

/** Parses a code back to its parts, or null if it isn't one. */
export function parseCode(code: string): ParsedCode | null {
  const match = /^([A-Z0-9]+)-(\d{4})-(\d+)$/.exec(code.trim().toUpperCase());
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const entry = Object.entries(PREFIXES).find(([, prefix]) => prefix === match[1]);
  if (!entry) return null;

  const sequence = Number(match[3]);
  if (sequence < 1) return null;

  return { kind: entry[0] as CodeKind, year: Number(match[2]), sequence };
}

/**
 * The counter key for a create. The year comes from the tenant's timezone, not
 * UTC: a plant in Auckland creating an NCR at 13:00 local on 1 January must get
 * a `-2026-` code, even though it is still 31 December in UTC (02 §7).
 */
export function counterYear(now: Date, tz: string): number {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
  }).format(now);
  return Number(formatted);
}
