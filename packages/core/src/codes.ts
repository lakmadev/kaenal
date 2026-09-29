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
  | "supplier"
  | "ppap"
  // Sprint 04 R1/M1 — the risk register and MSA/Gauge R&R studies. The jsx's
  // mock codes (`R-NNN`, `MSA-NNN`) conflicted with this module's one
  // established `PREFIX-YYYY-NNNN` pattern, so both were corrected to it.
  | "risk"
  | "msa"
  // Sprint 05 C1 — the calibration instrument register. Competency codes are
  // NOT in this list: a competency `code` is a short, author-chosen slug
  // (`iatf`, `fmea`) set once by an admin, never sequence-generated via
  // `counters` (§3.1 item 12) — only instruments get a `PREFIX-YYYY-NNNN` code.
  | "instrument";

const PREFIXES: Readonly<Record<CodeKind, string>> = {
  ncr: "NCR",
  inspection: "INS",
  eight_d: "8D",
  capa: "CAPA",
  audit: "AUD",
  document: "DOC",
  scar: "SCAR",
  supplier: "SUP",
  ppap: "PPAP",
  risk: "RISK",
  msa: "MSA",
  instrument: "CAL",
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
