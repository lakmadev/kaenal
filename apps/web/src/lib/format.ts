/** Shared display formatters (04 §8 — dates via `Intl`). */

/** Short date like "Mar 4". Returns "—" for null/empty. */
export function shortDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full date like "4 Mar 2026". */
export function longDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Relative time like "just now", "8m ago", "3h ago", "2d ago"; falls back to a
 *  short date beyond a week. Used by the notification feeds. */
export function relativeTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate(iso);
}

/** Title-case an enum-ish token: `in_progress` → `In Progress`. */
export function titleCase(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
