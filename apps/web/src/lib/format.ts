import { DEFAULT_LOCALE, formatDate, formatRelative } from "@kaenal/core";

/** Shared display formatters (04 §8 — dates via `Intl`, in the active locale). */

/** The page locale (`<html lang>` is set from the resolved locale); "en" on the server. */
function activeLocale(): string {
  return typeof document === "undefined" ? DEFAULT_LOCALE : document.documentElement.lang || DEFAULT_LOCALE;
}

/** Short date like "Mar 4". Returns "—" for null/empty. */
export function shortDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return formatDate(iso, activeLocale(), { month: "short", day: "numeric" });
}

/** Full date like "4 Mar 2026". */
export function longDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return formatDate(iso, activeLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/** Relative time like "just now", "8m ago", "3h ago", "2d ago"; falls back to a
 *  short date beyond a week. Used by the notification feeds. */
export function relativeTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return formatRelative(iso, activeLocale()) ?? shortDate(iso);
}

/** Title-case an enum-ish token: `in_progress` → `In Progress`. */
export function titleCase(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Whole days between two ISO instants (inclusive), for the audits "Duration"
 *  row — the schema stores start/end, not a duration, so this is display-only
 *  arithmetic, not business logic. Null when either end is missing. */
export function durationDays(startAt: string | null, endAt: string | null): number | null {
  if (startAt === null || endAt === null) return null;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Whole days from today (UTC calendar date) to an ISO `YYYY-MM-DD` date —
 *  positive when in the future, negative when past. Display-only arithmetic
 *  (the register's "24d"/"Overdue 15d" day-count chips, Sprint 05 C1); the
 *  authoritative `warn`/`overdue` classification always comes from the
 *  server's own `dueStatus` field, computed in the instrument's plant
 *  timezone — this is never used to derive that classification itself. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

/** "Manjunath Kumar" -> "Manjunath K." (top-bar profile button, shell.jsx). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return last !== undefined && last !== "" ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
