/**
 * Recurrence expansion (02 §2, 06 `schedule`, 08 §1.2).
 *
 * A scheduled-inspection series carries a `recurrence` rule; the `schedule` job
 * expands it into concrete occurrence dates a bounded window ahead (14 days) and
 * materialises one inspection per date, idempotent on `(seriesId, date)`. This
 * module is the pure calendar math — no I/O, no clock — so the tricky cases the
 * spec calls out (Feb 29, month-end "31st" → last day) are exhaustively unit-
 * testable without a database or a fixed "now".
 *
 * Dates are handled as UTC calendar dates (midnight UTC). Occurrences are whole
 * days, so this deliberately avoids wall-clock/DST math — a date is a date. The
 * anchor's time-of-day is reapplied by the caller when it writes `scheduled_at`.
 */

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export interface RecurrenceRule {
  readonly freq: RecurrenceFreq;
  readonly interval: number;
  /** 0=Sunday … 6=Saturday (JS getUTCDay). Only meaningful for `weekly`. */
  readonly byweekday?: readonly number[];
  /** Inclusive end of the series (ISO datetime or date); null/absent = open. */
  readonly until?: string | null;
}

export interface ExpandWindow {
  /** The series start — the first occurrence and the phase reference. */
  readonly anchor: Date;
  /** Window start, exclusive of nothing — occurrences on/after this date count. */
  readonly from: Date;
  /** Window end (inclusive) — 14 days ahead of `from` in the caller. */
  readonly to: Date;
}

/** How many days ahead the schedule job materialises (06 §1). */
export const SCHEDULE_HORIZON_DAYS = 14;

/** `YYYY-MM-DD` of a Date's UTC calendar day. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Midnight-UTC Date for a `YYYY-MM-DD`, or the UTC day of a datetime. */
function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Last calendar day (28–31) of a given UTC year/month (month is 0-based). */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

/**
 * Add `n` months to a date, clamping the day to the target month's last day —
 * so a 31st recurs on the 30th/28th/29th of shorter months, and a Feb-29 anchor
 * lands on Feb 28 in non-leap years, never spilling into the next month.
 */
function addMonthsClamped(anchor: Date, n: number): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + n;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), lastDayOfMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

/**
 * Expand a recurrence into the occurrence dates within `[from, to]` (inclusive),
 * as `YYYY-MM-DD` strings in ascending order. Never returns dates before the
 * anchor or after `until`. The window is bounded, so an open-ended rule still
 * terminates.
 */
export function expandOccurrences(rule: RecurrenceRule, window: ExpandWindow): string[] {
  const anchor = utcDay(window.anchor);
  const from = utcDay(window.from);
  const to = utcDay(window.to);
  const until = rule.until != null ? utcDay(new Date(rule.until)) : null;
  const hardEnd = until !== null && until.getTime() < to.getTime() ? until : to;
  if (hardEnd.getTime() < anchor.getTime() || hardEnd.getTime() < from.getTime()) return [];

  const interval = Math.max(1, Math.trunc(rule.interval));
  const out: string[] = [];
  const emit = (d: Date): void => {
    if (d.getTime() < anchor.getTime() || d.getTime() > hardEnd.getTime()) return;
    if (d.getTime() < from.getTime()) return;
    out.push(toIsoDate(d));
  };

  if (rule.freq === "daily") {
    for (let d = anchor; d.getTime() <= hardEnd.getTime(); d = addDays(d, interval)) emit(d);
    return out;
  }

  if (rule.freq === "weekly") {
    const weekdays =
      rule.byweekday && rule.byweekday.length > 0
        ? [...new Set(rule.byweekday)].sort((a, b) => a - b)
        : [anchor.getUTCDay()];
    // Walk week by week from the anchor's week start; a week is "active" when its
    // index is a multiple of `interval`. Within an active week, emit each named
    // weekday that falls in range.
    const anchorWeekStart = addDays(anchor, -anchor.getUTCDay()); // back to Sunday
    for (
      let weekStart = anchorWeekStart, week = 0;
      weekStart.getTime() <= hardEnd.getTime();
      weekStart = addDays(weekStart, 7), week += 1
    ) {
      if (week % interval !== 0) continue;
      for (const wd of weekdays) emit(addDays(weekStart, wd));
    }
    return out;
  }

  // monthly
  for (let k = 0; ; k += 1) {
    const d = addMonthsClamped(anchor, k * interval);
    if (d.getTime() > hardEnd.getTime()) break;
    emit(d);
  }
  return out;
}
