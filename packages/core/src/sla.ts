import { TZDate } from "@date-fns/tz";
import type { NcrPriority, SlaState } from "@kaenal/types";

/**
 * SLA due-date math (03 §10, 08 §1.2).
 *
 * Due dates are computed in the TENANT's timezone and business hours, not the
 * server's and not the user's. A German plant's "resolve within 24 business
 * hours" must mean the same thing whether the API pod is in Frankfurt or
 * Oregon, and whether the manager checking it is travelling or not.
 */

export interface BusinessHours {
  /** Working days, 0 = Sunday … 6 = Saturday, in the tenant's timezone. */
  readonly days: readonly number[];
  /** Local wall-clock start, "HH:MM". */
  readonly start: string;
  /** Local wall-clock end, "HH:MM". */
  readonly end: string;
  /** Non-working dates as "YYYY-MM-DD" in the tenant's timezone. */
  readonly holidays?: readonly string[];
}

export interface SlaConfig {
  readonly respondHours: number;
  readonly resolveHours: number;
  readonly businessHours: BusinessHours;
}

export type SlaConfigByPriority = Readonly<Record<NcrPriority, SlaConfig>>;

const MS_PER_HOUR = 3_600_000;
/** A year of calendar days: if we haven't found capacity by then, config is wrong. */
const MAX_DAYS_SCANNED = 366;

function parseTimeOfDay(value: string, label: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid ${label} time '${value}' — expected "HH:MM"`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Invalid ${label} time '${value}' — out of range`);
  }
  return { hour, minute };
}

function dateKey(d: TZDate): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The business window for a given calendar day, as real UTC instants.
 *
 * Returning instants rather than wall-clock durations is what makes DST
 * correct for free: on a spring-forward day an 08:00–17:00 window really is
 * eight elapsed hours, and on a fall-back day it really is ten. Since the
 * shop floor works clock hours, consuming *elapsed* time is the honest
 * reading of "24 business hours".
 */
function windowFor(
  day: TZDate,
  bh: BusinessHours,
  tz: string,
): { start: Date; end: Date } | null {
  if (!bh.days.includes(day.getDay())) return null;
  if (bh.holidays?.includes(dateKey(day))) return null;

  const s = parseTimeOfDay(bh.start, "business hours start");
  const e = parseTimeOfDay(bh.end, "business hours end");

  const start = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), s.hour, s.minute, 0, 0, tz);
  const end = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), e.hour, e.minute, 0, 0, tz);

  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) {
    throw new Error(
      `Business hours end (${bh.end}) must be after start (${bh.start}); ` +
        `overnight shifts are not modelled yet`,
    );
  }
  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * Adds `hours` of business time to `from`, walking the tenant's working
 * windows.
 *
 * If `from` falls outside a working window the clock starts at the next one —
 * an NCR raised at 22:00 Friday gets its full allowance starting Monday
 * morning, rather than silently burning the weekend.
 */
export function addBusinessHours(
  from: Date,
  hours: number,
  bh: BusinessHours,
  tz: string,
): Date {
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error(`hours must be a non-negative finite number, got ${hours}`);
  }
  if (bh.days.length === 0) {
    throw new Error("Business hours define no working days — cannot compute a due date");
  }
  if (hours === 0) return new Date(from.getTime());

  let remainingMs = hours * MS_PER_HOUR;
  let cursor = from.getTime();
  let day = new TZDate(from.getTime(), tz);

  for (let scanned = 0; scanned <= MAX_DAYS_SCANNED; scanned++) {
    const window = windowFor(day, bh, tz);

    if (window !== null) {
      const startMs = window.start.getTime();
      const endMs = window.end.getTime();

      // Before today's window opens: jump the cursor to the opening bell.
      if (cursor < startMs) cursor = startMs;

      if (cursor < endMs) {
        const capacity = endMs - cursor;
        if (remainingMs <= capacity) {
          return new Date(cursor + remainingMs);
        }
        remainingMs -= capacity;
        cursor = endMs;
      }
    }

    // Advance to 00:00 of the next calendar day in the tenant's timezone.
    day = new TZDate(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0, tz);
    cursor = Math.max(cursor, day.getTime());
  }

  throw new Error(
    `Could not consume ${hours} business hours within ${MAX_DAYS_SCANNED} days — ` +
      `check the business-hours configuration`,
  );
}

/**
 * The due date for an NCR of a given priority (03 §10).
 * `computeDueAt(now, priority, slaConfig, tz)`.
 */
export function computeDueAt(
  now: Date,
  priority: NcrPriority,
  config: SlaConfigByPriority,
  tz: string,
): Date {
  const sla = config[priority];
  if (!sla) throw new Error(`No SLA configured for priority '${priority}'`);
  return addBusinessHours(now, sla.resolveHours, sla.businessHours, tz);
}

/** Fraction of the SLA window consumed at which an item is flagged at-risk. */
export const AT_RISK_THRESHOLD = 0.8;

/**
 * Classifies where an item sits against its SLA.
 *
 * Measured in business time, not wall-clock: an NCR raised Friday afternoon
 * should not show as "at risk" on Sunday just because calendar hours passed
 * while the plant was closed.
 */
export function computeSlaState(
  now: Date,
  startedAt: Date,
  dueAt: Date,
  bh: BusinessHours,
  tz: string,
): SlaState {
  if (now.getTime() >= dueAt.getTime()) return "breached";

  const total = businessHoursBetween(startedAt, dueAt, bh, tz);
  if (total <= 0) return "breached";

  const elapsed = businessHoursBetween(startedAt, now, bh, tz);
  return elapsed / total >= AT_RISK_THRESHOLD ? "at_risk" : "on_track";
}

/** Business hours between two instants. Returns 0 if `to` precedes `from`. */
export function businessHoursBetween(
  from: Date,
  to: Date,
  bh: BusinessHours,
  tz: string,
): number {
  if (to.getTime() <= from.getTime()) return 0;
  if (bh.days.length === 0) return 0;

  let total = 0;
  let day = new TZDate(from.getTime(), tz);

  for (let scanned = 0; scanned <= MAX_DAYS_SCANNED; scanned++) {
    const window = windowFor(day, bh, tz);

    if (window !== null) {
      const overlapStart = Math.max(window.start.getTime(), from.getTime());
      const overlapEnd = Math.min(window.end.getTime(), to.getTime());
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
    }

    const nextDay = new TZDate(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0, tz);
    if (nextDay.getTime() >= to.getTime()) break;
    day = nextDay;
  }

  return total / MS_PER_HOUR;
}
