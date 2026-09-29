/**
 * Calibration instrument due/overdue math (Sprint 05 C1/C2/C5; §3.1 items 1,
 * 3, 13, 14, 15).
 *
 * Every function here takes and returns ISO date strings (`YYYY-MM-DD`),
 * never JS `Date` objects — a deliberate deviation from `document-expiry.ts`'s
 * `Date`-based signature, scoped to this sprint's two new modules (§0/B4):
 * `pg` returns a `date` column as a local-midnight `Date`, which silently
 * shifts under a non-UTC server timezone. Parsing the string ourselves as a
 * UTC calendar date sidesteps that entirely.
 *
 * `nextDueDate`'s month-end clamping must agree, at every boundary, with
 * Postgres's own `(last_calibrated + make_interval(months => interval_months))
 * ::date` generated column (C1 AC1, §3.1 item 13) — this is what a later
 * slice's integration test (§4/§8: "SQL and core function agree at every
 * boundary") extends against a real Postgres 16 instance. The cases this file
 * pins today (Jan 31 -> Feb 28/29, Dec 31 -> Jan 31, etc.) are exactly the
 * worked examples the sprint file states Postgres produces.
 */

/** Parses `YYYY-MM-DD` as a UTC calendar date (midnight UTC), never local time. */
function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Not an ISO date (YYYY-MM-DD): ${iso}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `a` to `b` (`b - a`), positive when `b` is later. */
function isoDaysBetween(a: string, b: string): number {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / DAY_MS);
}

/**
 * `lastCalibrated + intervalMonths`, clamped to the target month's last valid
 * day — matching Postgres's real `date + make_interval(months => n)`
 * behaviour exactly (confirmed, not assumed, §3.1 item 13): adding a month-
 * valued interval to a date never overflows into the next month; a day that
 * doesn't exist in the target month (e.g. day 31 landing in February) clamps
 * down to that month's actual last day.
 *
 * `'2026-01-31' + 1 month = '2026-02-28'` (2026 not a leap year).
 * `'2028-01-31' + 1 month = '2028-02-29'` (2028 is a leap year).
 * `'2026-12-31' + 1 month = '2027-01-31'` (31 exists in January, no clamp).
 */
export function nextDueDate(lastCalibrated: string, intervalMonths: number): string {
  if (!Number.isInteger(intervalMonths) || intervalMonths <= 0) {
    throw new Error(`intervalMonths must be a positive integer, got ${intervalMonths}`);
  }
  const start = parseIsoDate(lastCalibrated);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth(); // 0-11
  const day = start.getUTCDate();

  const targetMonthIndex = month + intervalMonths; // may be >= 12, Date.UTC normalizes the year
  // The last valid day of the target month: day 0 of the *following* month.
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return formatIsoDate(new Date(Date.UTC(year, targetMonthIndex, clampedDay)));
}

export type CalibrationResult = "pass" | "adjusted" | "fail";
export type InstrumentDueStatus = "ok" | "warn" | "overdue" | "unscheduled";

/** Calibration warn window, in days (§3.1 item 1 — resolves P16 §5). */
export const CALIBRATION_WARN_WINDOW_DAYS = 30;

/**
 * An instrument's due status (C1 AC2, §3.1 items 3/14).
 *
 * Priority order, exactly as approved:
 * 1. `lastResult === "fail"` -> always `"overdue"`, regardless of `nextDue`
 *    (B3 — a failed check means the instrument is not fit for use right now,
 *    no matter what the computed due date says; this is the real IATF 7.1.5
 *    correctness fix this sprint centers on).
 * 2. `nextDue` is `null` -> `"unscheduled"` (never calibrated yet).
 * 3. `nextDue < today` -> `"overdue"`.
 * 4. `nextDue` within the warn window (30 days) OR `nextDue === today` ->
 *    `"warn"` (the due day itself reads `warn`, not `overdue` — B4(b)).
 * 5. else `"ok"`.
 */
export function instrumentDueStatus(input: {
  readonly nextDue: string | null;
  readonly lastResult: CalibrationResult | null;
  readonly today: string;
}): InstrumentDueStatus {
  if (input.lastResult === "fail") return "overdue";
  if (input.nextDue === null) return "unscheduled";

  const daysUntilDue = isoDaysBetween(input.today, input.nextDue);
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= CALIBRATION_WARN_WINDOW_DAYS) return "warn";
  return "ok";
}

/** Approach-side thresholds, largest first — mirrors `EXPIRY_THRESHOLDS`. */
const CALIBRATION_APPROACH_THRESHOLDS = [30, 7, 0] as const;

/**
 * The reminder threshold currently in effect for an instrument approaching
 * its `nextDue` date (C5 AC1, §3.1 item 15).
 *
 * Approach side (not yet due): the **smallest threshold crossed on every day**
 * inside the window — the same algorithm as `document-expiry.ts`'s real
 * `activeExpiryThreshold` (BLOCKING B correction: an earlier round wrongly
 * claimed this fires only on an exact-match day, and wrongly cited that file
 * as precedent for that wrong behaviour). Any day 8-30 out returns `30`; any
 * day 1-7 out returns `7`; day 0 (due today) returns `0`; more than 30 days
 * out returns `null`.
 *
 * Overdue side: `-7 * floor(daysOverdue / 7)` — the smallest (most recently
 * crossed) 7-day mark, uncapped (an out-of-calibration instrument is a
 * standing nonconformance, unlike a document that typically renews before
 * lapsing long). `daysOverdue` 0-6 all resolve to a plain `0` (already
 * notified on the due day itself via the threshold-0 approach case; the `-0`
 * JavaScript's `-7 * 0` would otherwise produce is normalized away so a
 * strict `toBe(0)` assertion never spuriously fails).
 *
 * Returns `null` when more than 30 days from `nextDue` and not yet overdue.
 */
export function activeCalibrationThreshold(input: {
  readonly nextDue: string;
  readonly today: string;
}): number | null {
  const daysUntilDue = isoDaysBetween(input.today, input.nextDue);

  if (daysUntilDue >= 0) {
    let active: number | null = null;
    for (const t of CALIBRATION_APPROACH_THRESHOLDS) {
      if (daysUntilDue <= t) active = t; // keep narrowing; the last (smallest) wins
    }
    return active;
  }

  const daysOverdue = -daysUntilDue;
  const result = -7 * Math.floor(daysOverdue / 7);
  return Object.is(result, -0) ? 0 : result;
}
