/**
 * Training & competency matrix cell-state math (Sprint 05 T1; §3.1 items 6, 7,
 * 15).
 *
 * Takes ISO date strings (`YYYY-MM-DD`), never JS `Date` objects — same
 * reasoning as `calibration.ts` (B4(c)): `pg` returns a `date` column as a
 * local-midnight `Date`, which silently shifts under a non-UTC server
 * timezone.
 */

/** Parses `YYYY-MM-DD` as a UTC calendar date (midnight UTC), never local time. */
function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Not an ISO date (YYYY-MM-DD): ${iso}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `a` to `b` (`b - a`), positive when `b` is later. */
function isoDaysBetween(a: string, b: string): number {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / DAY_MS);
}

export type CompetencyCellState = "ok" | "warn" | "overdue" | "gap" | "na";

/** Training expiry warn window, in days — matches the matrix's KPI tile. */
export const TRAINING_WARN_WINDOW_DAYS = 30;

/**
 * A single (member, competency) matrix cell's state (T1 AC2, §3.1 items 6/7).
 *
 * Rule, in the exact priority order approved:
 * 1. no record + mandatory -> `"gap"` (red — a required certification never
 *    taken; the literal, honest reading of the single `mandatory` boolean).
 * 2. no record + not mandatory -> `"na"` (gray — never assigned, not
 *    required).
 * 3. record exists + `expiresAt < today` -> `"overdue"` (red).
 * 4. record exists + `expiresAt` within the warn window (30 days), including
 *    `expiresAt === today` -> `"warn"` (amber) — the due day itself reads
 *    `warn`, matching `instrumentDueStatus`'s own due-day rule (B4(b)) for
 *    consistency across both modules.
 * 5. record exists + `expiresAt` is `null` (never expires) or beyond the warn
 *    window -> `"ok"` (green).
 */
export function competencyCellState(input: {
  readonly hasRecord: boolean;
  readonly mandatory: boolean;
  readonly expiresAt: string | null;
  readonly today: string;
}): CompetencyCellState {
  if (!input.hasRecord) return input.mandatory ? "gap" : "na";
  if (input.expiresAt === null) return "ok";

  const daysUntilExpiry = isoDaysBetween(input.today, input.expiresAt);
  if (daysUntilExpiry < 0) return "overdue";
  if (daysUntilExpiry <= TRAINING_WARN_WINDOW_DAYS) return "warn";
  return "ok";
}
